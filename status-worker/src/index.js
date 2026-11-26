// Status dos serviços da StoreApps (storeapps.com.br/services).
//
// A cada 5 minutos (cron) bate em cada serviço de servicos.js e guarda, no KV,
// o estado atual e um resumo por dia dos últimos 90 dias. GET /status devolve
// isso para a página, sem URLs.
//
// Estados: operacional · degradado (lento ou saúde parcial) · offline ·
// desligado (homologação sob demanda fora do ar: de propósito, não é incidente).

import { GRUPOS, SERVICOS } from './servicos.js';

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

async function verificar(s) {
  const inicio = Date.now();
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
    const precisaCorpo = s.esperado.json || s.esperado.texto || s.degradado;
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
  const resultados = await Promise.all(SERVICOS.map(async (s) => [s, await verificar(s)]));
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
