// Status dos serviços da StoreApps (storeapps.com.br/services).
//
// A cada 5 minutos (cron) bate em cada serviço de servicos.js e guarda, no KV,
// o estado atual e um resumo por dia dos últimos 90 dias. GET /status devolve
// isso para a página, sem URLs.
//
// Estados: operacional · degradado (lento ou saúde parcial) · offline ·
// desligado (homologação sob demanda fora do ar: de propósito, não é incidente).

import { GRUPOS, SERVICOS } from './servicos.js';
import { CHECAGENS } from './contas.js';

const CHAVE = 'estado-v1';
const DIAS = 90;
const TIMEOUT_MS = 10_000;
const LENTO_MS = 4_000;
const ORIGENS = ['https://storeapps.com.br', 'https://www.storeapps.com.br', 'http://localhost:8080', 'http://127.0.0.1:8080'];

/** Data local de Brasília (AAAA-MM-DD): o "dia" das barras. */
function diaDe(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

function bate(obj, esperado) {
  return Object.entries(esperado).every(([k, v]) => obj && obj[k] === v);
}

const PIOR = { operacional: 0, degradado: 1, offline: 2 };
const pior = (a, b) => (PIOR[b] > PIOR[a] ? b : a);

/** Lê o corpo como texto, aceitando UTF-16 com BOM (a AWS manda assim). */
async function texto(r) {
  const b = new Uint8Array(await r.arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  return new TextDecoder().decode(b);
}

/** Páginas de status de terceiros e o Registro.br: vale o que elas dizem, não só responder. */
async function verificarEspecial(s, inicio) {
  const url = s.tipo === 'rdap' ? `https://rdap.registro.br/domain/${s.dominio}` : s.url;
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json', 'user-agent': 'StoreApps-Status/1.0' } });
  const ms = Date.now() - inicio;
  if (!r.ok) return { estado: 'offline', codigo: r.status, ms, detalhe: `página de status respondeu ${r.status}` };
  const d = JSON.parse(await texto(r));

  if (s.tipo === 'statuspage') {
    const mapa = { operational: 'operacional', degraded_performance: 'degradado', under_maintenance: 'degradado', partial_outage: 'offline', major_outage: 'offline' };
    let estado = 'operacional';
    const ruins = [];
    for (const c of d.components || []) {
      if (!s.componentes.includes(c.name)) continue;
      const e = mapa[c.status] || 'operacional';
      if (e !== 'operacional') ruins.push(c.name);
      estado = pior(estado, e);
    }
    return { estado, codigo: r.status, ms, detalhe: ruins.length ? `com problema: ${ruins.join(', ')}` : '' };
  }
  if (s.tipo === 'google-incidentes') {
    const ativos = (d || []).filter((i) => !i.end && (!s.produtos || (i.affected_products || []).some((p) => s.produtos.includes(p.title))));
    if (!ativos.length) return { estado: 'operacional', codigo: r.status, ms, detalhe: '' };
    const grave = ativos.some((i) => i.severity === 'high' || /OUTAGE/.test(i.status_impact || ''));
    return { estado: grave ? 'offline' : 'degradado', codigo: r.status, ms, detalhe: (ativos[0].external_desc || 'incidente aberto').slice(0, 120) };
  }
  if (s.tipo === 'aws') {
    const daRegiao = (d || []).filter((e) => (e.arn || '').includes(`:${s.regiao}:`) || (e.service || '').endsWith(s.regiao));
    if (!daRegiao.length) return { estado: 'operacional', codigo: r.status, ms, detalhe: '' };
    return { estado: 'degradado', codigo: r.status, ms, detalhe: (daRegiao[0].summary || 'evento aberto na região').slice(0, 120) };
  }
  if (s.tipo === 'rdap') {
    const status = d.status || [];
    if (status.some((x) => /pending/i.test(x))) return { estado: s.sobDemanda ? 'desligado' : 'degradado', codigo: r.status, ms, detalhe: 'registro em andamento' };
    const exp = (d.events || []).find((e) => e.eventAction === 'expiration');
    if (!exp) return { estado: 'degradado', codigo: r.status, ms, detalhe: 'sem data de vencimento' };
    const dias = Math.floor((Date.parse(exp.eventDate) - Date.now()) / 86_400_000);
    const quando = new Date(exp.eventDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (dias < 7) return { estado: 'offline', codigo: r.status, ms, detalhe: `vence em ${dias} dias (${quando})` };
    if (dias < 30) return { estado: 'degradado', codigo: r.status, ms, detalhe: `vence em ${dias} dias (${quando})` };
    return { estado: 'operacional', codigo: r.status, ms, detalhe: `vence em ${quando}` };
  }
  return { estado: 'offline', codigo: 0, ms, detalhe: 'tipo de verificação desconhecido' };
}

async function verificar(s, env) {
  const inicio = Date.now();
  if (s.tipo === 'conta') {
    if (s.segredos.some((n) => !env[n])) return { estado: 'desligado', codigo: 0, ms: 0, detalhe: 'falta configurar', naoConfigurado: true };
    try {
      const r = await CHECAGENS[s.checagem](env, s);
      return { codigo: 0, ...r, ms: Date.now() - inicio };
    } catch (e) {
      return { estado: 'offline', codigo: 0, ms: Date.now() - inicio, detalhe: e?.name === 'TimeoutError' ? 'sem resposta em 10 s' : 'falhou ao checar' };
    }
  }
  if (s.tipo) {
    try {
      return await verificarEspecial(s, inicio);
    } catch (e) {
      return { estado: 'offline', codigo: 0, ms: Date.now() - inicio, detalhe: e?.name === 'TimeoutError' ? 'sem resposta em 10 s' : 'não deu para ler' };
    }
  }
  let codigo = 0;
  let detalhe = '';
  try {
    const r = await fetch(s.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'StoreApps-Status/1.0 (+https://storeapps.com.br/services)', 'cache-control': 'no-cache' },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    codigo = r.status;
    const precisaCorpo = s.esperado.json || s.esperado.texto || s.degradado || s.frescor;
    const corpo = precisaCorpo ? await r.text() : (r.body?.cancel(), '');
    const ms = Date.now() - inicio;

    if (!s.esperado.status.includes(codigo)) {
      // Túnel sem a máquina do outro lado (EC2 desligada): 530/502/503/504.
      if (s.sobDemanda && [502, 503, 504, 520, 521, 522, 523, 530].includes(codigo)) {
        return { estado: 'desligado', codigo, ms, detalhe: 'máquina desligada' };
      }
      return { estado: 'offline', codigo, ms, detalhe: `respondeu ${codigo}` };
    }
    let json = null;
    if (s.esperado.json || s.degradado?.json) {
      try { json = JSON.parse(corpo); } catch { json = null; }
    }
    if (s.degradado?.json && bate(json, s.degradado.json)) {
      return { estado: 'degradado', codigo, ms, detalhe: 'saúde parcial' };
    }
    if (s.esperado.json && !bate(json, s.esperado.json)) {
      return { estado: 'offline', codigo, ms, detalhe: 'saúde não confirmada' };
    }
    if (s.esperado.texto && !corpo.includes(s.esperado.texto)) {
      return { estado: 'offline', codigo, ms, detalhe: 'conteúdo inesperado' };
    }
    if (s.frescor) {
      let valor = null;
      try {
        valor = s.frescor.caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), JSON.parse(corpo));
      } catch { valor = null; }
      const quando = valor ? Date.parse(valor) : NaN;
      if (!Number.isFinite(quando)) return { estado: 'offline', codigo, ms, detalhe: 'sem data do último item' };
      const horas = (Date.now() - quando) / 3_600_000;
      const ha = horas < 1 ? 'há menos de 1 h' : `há ${Math.round(horas)} h`;
      if (horas >= s.frescor.foraHoras) return { estado: 'offline', codigo, ms, detalhe: `último item ${ha}` };
      if (horas >= s.frescor.degradadoHoras) return { estado: 'degradado', codigo, ms, detalhe: `último item ${ha}` };
      return { estado: 'operacional', codigo, ms, detalhe: `último item ${ha}` };
    }
    if (ms > LENTO_MS) return { estado: 'degradado', codigo, ms, detalhe: 'lento' };
    return { estado: 'operacional', codigo, ms, detalhe };
  } catch (e) {
    const ms = Date.now() - inicio;
    detalhe = e?.name === 'TimeoutError' ? 'sem resposta em 10 s' : 'sem conexão';
    if (s.sobDemanda) return { estado: 'desligado', codigo, ms, detalhe: 'desligado ou fora do ar' };
    return { estado: 'offline', codigo, ms, detalhe };
  }
}

async function rodada(env) {
  const agora = Date.now();
  const dia = diaDe(agora);
  const anterior = (await env.STATUS.get(CHAVE, 'json')) || { servicos: {}, dias: {} };
  // Checagem com intervalo próprio (as que gastam, como IA): reaproveita o último resultado.
  const resultados = await Promise.all(SERVICOS.map(async (s) => {
    const antes = anterior.servicos?.[s.id];
    if (s.intervaloMin && antes?.verificadoEm && agora - antes.verificadoEm < s.intervaloMin * 60_000) {
      const { desde, ...ultimo } = antes;
      return [s, ultimo];
    }
    return [s, { ...(await verificar(s, env)), verificadoEm: agora }];
  }));
  const porId = Object.fromEntries(resultados.map(([s, r]) => [s.id, r]));
  for (const par of resultados) {
    const [s, r] = par;
    if (s.dependeDe && porId[s.dependeDe]?.estado === 'desligado' && r.estado === 'operacional') {
      par[1] = { ...r, estado: 'desligado', detalhe: 'máquina desligada' };
    }
  }

  const servicos = {};
  const dias = anterior.dias || {};
  for (const [s, r] of resultados) {
    const antes = anterior.servicos?.[s.id];
    servicos[s.id] = { ...r, desde: antes && antes.estado === r.estado ? antes.desde : agora };
    const hist = (dias[s.id] ||= {});
    const d = (hist[dia] ||= { t: 0, op: 0, deg: 0, off: 0, des: 0, ms: 0 });
    d.t += 1;
    d[{ operacional: 'op', degradado: 'deg', offline: 'off', desligado: 'des' }[r.estado]] += 1;
    if (r.estado !== 'desligado') d.ms += r.ms;
    // só os últimos 90 dias
    for (const k of Object.keys(hist).sort().slice(0, -DIAS)) delete hist[k];
  }
  // serviço removido de servicos.js: some do histórico também
  for (const id of Object.keys(dias)) if (!SERVICOS.some((s) => s.id === id)) delete dias[id];

  await env.STATUS.put(CHAVE, JSON.stringify({ atualizado: agora, servicos, dias }));
}

function cors(req) {
  const origem = req.headers.get('origin');
  return {
    'access-control-allow-origin': ORIGENS.includes(origem) ? origem : 'https://storeapps.com.br',
    'access-control-allow-methods': 'GET, OPTIONS',
    vary: 'Origin',
  };
}

export default {
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(rodada(env));
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    if (url.pathname !== '/status') {
      return new Response('StoreApps status: GET /status', { status: 404, headers: cors(req) });
    }
    const estado = (await env.STATUS.get(CHAVE, 'json')) || { atualizado: null, servicos: {}, dias: {} };
    const corpo = {
      atualizado: estado.atualizado,
      intervaloMinutos: 5,
      grupos: GRUPOS.map((g) => ({
        ...g,
        servicos: SERVICOS.filter((s) => s.grupo === g.id).map((s) => ({
          id: s.id,
          nome: s.nome,
          sobDemanda: !!s.sobDemanda,
          conta: s.tipo === 'conta',
          atual: estado.servicos[s.id] || null,
          dias: estado.dias[s.id] || {},
        })),
      })),
    };
    return new Response(JSON.stringify(corpo), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...cors(req) },
    });
  },
};
