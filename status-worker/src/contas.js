// Checagens que precisam de chave: saldo, cota e situação das contas que
// fazem os produtos funcionarem. Cada uma lê os segredos do Worker
// (`npx wrangler@4 secret put NOME`); sem eles, o item aparece como
// "falta configurar" e não conta como falha.
//
// Todas devolvem { estado, detalhe } com estado: operacional | degradado |
// offline | desligado.

import { AwsClient } from 'aws4fetch';

const T = 10_000;
const ok = (detalhe = '') => ({ estado: 'operacional', detalhe });
const aviso = (detalhe) => ({ estado: 'degradado', detalhe });
const fora = (detalhe) => ({ estado: 'offline', detalhe });

async function corpo(r) {
  const t = await r.text();
  try { return { t, j: JSON.parse(t) } } catch { return { t, j: null } }
}

/** Procura o primeiro número num JSON cujo nome pareça saldo. */
function numeroDeSaldo(j, chaves = /saldo|balance|credit|credito|available|remaining|traffic/i) {
  let achado = null;
  (function andar(o) {
    if (achado !== null || o == null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (achado !== null) return;
      if (chaves.test(k) && (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))))) achado = Number(v);
      else if (typeof v === 'object') andar(v);
    }
  })(j);
  return achado;
}


/** JWT ES256 do App Store Connect (chave .p8 do ASC). */
async function tokenAsc(env, s) {
  const [kid, iss, p8] = s.segredos.map((n) => env[n]);
  const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const txt = (o) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const agora = Math.floor(Date.now() / 1000);
  const cab = txt({ alg: 'ES256', kid, typ: 'JWT' });
  const corpoJwt = txt({ iss, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const der = Uint8Array.from(atob(p8.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const ass = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, new TextEncoder().encode(`${cab}.${corpoJwt}`)));
  return `${cab}.${corpoJwt}.${b64(ass)}`;
}

async function asc(env, s, caminho) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${caminho}`, {
    signal: AbortSignal.timeout(T),
    headers: { authorization: `Bearer ${await tokenAsc(env, s)}` },
  });
  return { r, j: r.ok ? await r.json() : null };
}

export const CHECAGENS = {
  /** Claude: 1 token no modelo mais barato. "credit balance" = sem saldo. */
  async anthropic(env, s) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(T),
      headers: { 'x-api-key': env[s.segredos[0]], 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (r.ok) return ok('responde e tem saldo');
    const { t } = await corpo(r);
    if (/credit balance|billing|insufficient/i.test(t)) return fora('sem saldo');
    if (r.status === 401 || r.status === 403) return fora('chave inválida ou vencida');
    if (r.status === 429 || r.status === 529) return aviso('limite de uso ou API sobrecarregada');
    return aviso(`respondeu ${r.status}`);
  },

  /** OpenAI: 1 token. insufficient_quota = sem saldo. */
  async openai(env, s) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(T),
      headers: { authorization: `Bearer ${env[s.segredos[0]]}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: s.modelo || 'gpt-4.1-mini', max_completion_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (r.ok) return ok('responde e tem saldo');
    const { t } = await corpo(r);
    if (/insufficient_quota|billing/i.test(t)) return fora('sem saldo');
    if (r.status === 401 || r.status === 403) return fora('chave inválida');
    if (r.status === 429) return aviso('limite de uso por minuto');
    return aviso(`respondeu ${r.status}`);
  },

  /** SMS Fire: GET /account/balance (cache de alguns minutos do lado deles). */
  async smsfire(env, s) {
    const r = await fetch('https://api-v3.smsfire.com.br/account/balance', {
      signal: AbortSignal.timeout(T),
      headers: { Username: env[s.segredos[0]], Api_Token: env[s.segredos[1]] },
    });
    if (r.status === 401 || r.status === 403) return fora('usuário ou token inválido');
    if (!r.ok) return aviso(`respondeu ${r.status}`);
    const { j, t } = await corpo(r);
    const saldo = numeroDeSaldo(j) ?? (t.trim() !== '' && !isNaN(Number(t)) ? Number(t) : null);
    if (saldo === null) return aviso('saldo em formato desconhecido');
    const minimo = Number(s.minimo ?? 100);
    if (saldo <= 0) return fora('sem saldo');
    if (saldo < minimo) return aviso(`saldo baixo: ${saldo}`);
    return ok(`saldo ${saldo}`);
  },

  /** X (Twitter) API: uso do mês contra o teto do projeto. */
  async xapi(env, s) {
    const r = await fetch('https://api.x.com/2/usage/tweets', { signal: AbortSignal.timeout(T), headers: { authorization: `Bearer ${env[s.segredos[0]]}` } });
    if (r.status === 401 || r.status === 403) return fora('token inválido');
    if (!r.ok) return aviso(`respondeu ${r.status}`);
    const { j } = await corpo(r);
    const uso = Number(j?.data?.project_usage), teto = Number(j?.data?.project_cap);
    if (!teto) return ok('sem teto informado');
    const pct = Math.round((uso / teto) * 100);
    if (pct >= 100) return fora(`teto do mês atingido (${uso}/${teto})`);
    if (pct >= 80) return aviso(`${pct}% do teto do mês`);
    return ok(`${pct}% do teto do mês`);
  },

  /** IPRoyal (proxy residencial da sala da FACEIT): tráfego que resta. */
  async iproyal(env, s) {
    const r = await fetch('https://resi-api.iproyal.com/v1/me', { signal: AbortSignal.timeout(T), headers: { authorization: `Bearer ${env[s.segredos[0]]}` } });
    if (r.status === 401 || r.status === 403) return fora('token inválido');
    if (!r.ok) return aviso(`respondeu ${r.status}`);
    const { j } = await corpo(r);
    const resta = numeroDeSaldo(j);
    if (resta === null) return ok('conta responde (saldo não informado)');
    if (resta <= 0) return fora('sem tráfego/saldo');
    return ok(`restam ${resta}`);
  },

  async telegram(env, s) {
    const r = await fetch(`https://api.telegram.org/bot${env[s.segredos[0]]}/getMe`, { signal: AbortSignal.timeout(T) });
    return r.ok ? ok('bot responde') : fora(r.status === 401 ? 'token inválido' : `respondeu ${r.status}`);
  },

  async faceit(env, s) {
    const r = await fetch('https://open.faceit.com/data/v4/games?limit=1', { signal: AbortSignal.timeout(T), headers: { authorization: `Bearer ${env[s.segredos[0]]}` } });
    if (r.ok) return ok();
    return r.status === 401 || r.status === 403 ? fora('chave inválida') : r.status === 429 ? aviso('limite de uso') : aviso(`respondeu ${r.status}`);
  },

  async steam(env, s) {
    const r = await fetch(`https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?key=${encodeURIComponent(env[s.segredos[0]])}`, { signal: AbortSignal.timeout(T) });
    if (r.ok) return ok();
    return r.status === 403 ? fora('chave inválida') : aviso(`respondeu ${r.status}`);
  },

  /** Neon: projeto existe e nenhum endpoint de banco está desabilitado (cota). */
  async neon(env, s) {
    const h = { authorization: `Bearer ${env[s.segredos[0]]}`, accept: 'application/json' };
    const r = await fetch(`https://console.neon.tech/api/v2/projects/${s.projeto}/endpoints`, { signal: AbortSignal.timeout(T), headers: h });
    if (r.status === 401 || r.status === 403) return fora('chave sem acesso ao projeto');
    if (!r.ok) return aviso(`respondeu ${r.status}`);
    const { j } = await corpo(r);
    const eps = j?.endpoints || [];
    const desab = eps.filter((e) => e.disabled);
    if (desab.length) return fora('banco desabilitado (cota do plano?)');
    const ativos = eps.filter((e) => e.current_state === 'active').length;
    return ok(`${eps.length} endpoint(s), ${ativos} ativo(s) agora`);
  },

  /**
   * GitHub Actions: o último run de cada repositório. Falha sem nenhum passo
   * executado é o sintoma do bloqueio por cobrança (o job morre em 2 s).
   */
  async github(env, s) {
    const h = { authorization: `Bearer ${env[s.segredos[0]]}`, accept: 'application/vnd.github+json', 'user-agent': 'StoreApps-Status' };
    const ruins = [];
    for (const repo of s.repos) {
      const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1&exclude_pull_requests=true`, { signal: AbortSignal.timeout(T), headers: h });
      if (r.status === 401) return fora('token inválido');
      if (!r.ok) { ruins.push(`${repo}: ${r.status}`); continue; }
      const run = (await r.json()).workflow_runs?.[0];
      if (!run || run.conclusion !== 'failure') continue;
      const jr = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs`, { signal: AbortSignal.timeout(T), headers: h });
      const jobs = jr.ok ? (await jr.json()).jobs || [] : [];
      if (jobs.length && jobs.every((j) => !(j.steps || []).length)) return fora(`Actions bloqueado (cobrança?) em ${repo}`);
    }
    return ruins.length ? aviso(ruins.join(' · ')) : ok('runs rodando');
  },

  /** EC2: estado e checagens de status da AWS. Homologação parada = desligado. */
  async ec2(env, s) {
    const aws = new AwsClient({ accessKeyId: env[s.segredos[0]], secretAccessKey: env[s.segredos[1]], region: s.regiao, service: 'ec2' });
    const qs = new URLSearchParams({ Action: 'DescribeInstanceStatus', Version: '2016-11-15', IncludeAllInstances: 'true', 'InstanceId.1': s.instancia });
    const r = await aws.fetch(`https://ec2.${s.regiao}.amazonaws.com/?${qs}`, { signal: AbortSignal.timeout(T) });
    const t = await r.text();
    if (!r.ok) return r.status === 401 || r.status === 403 ? fora('chave AWS sem permissão') : aviso(`respondeu ${r.status}`);
    const estado = /<instanceState>[\s\S]*?<name>(\w+)<\/name>/.exec(t)?.[1];
    const sistema = /<systemStatus>[\s\S]*?<status>(\w+)<\/status>/.exec(t)?.[1];
    const inst = /<instanceStatus>[\s\S]*?<status>(\w+)<\/status>/.exec(t)?.[1];
    if (estado !== 'running') return s.sobDemanda ? { estado: 'desligado', detalhe: `máquina ${estado || 'parada'}` } : fora(`máquina ${estado || 'sem estado'}`);
    if (sistema === 'impaired' || inst === 'impaired') return fora('checagem de status da AWS falhou');
    if (sistema === 'initializing' || inst === 'initializing') return aviso('máquina iniciando');
    return ok('ligada, checagens da AWS ok');
  },

  /** Firebase Cloud Messaging: autentica a conta de serviço e faz um envio de teste (validate_only). */
  async fcm(env, s) {
    // O valor pode vir como está no .env: entre aspas simples ou duplas.
    let bruto = String(env[s.segredos[0]]).trim();
    if (/^(['"]).*\1$/s.test(bruto)) bruto = bruto.slice(1, -1);
    let sa;
    try { sa = JSON.parse(bruto); } catch { return fora('JSON da conta de serviço inválido (cole o conteúdo do arquivo)'); }
    if (!sa.private_key || !sa.client_email) return fora('JSON sem private_key/client_email');
    const agora = Math.floor(Date.now() / 1000);
    const b64 = (o) => btoa(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const cab = b64({ alg: 'RS256', typ: 'JWT' });
    const corpoJwt = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 });
    const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const chave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const ass = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cab}.${corpoJwt}`)));
    const jwt = `${cab}.${corpoJwt}.${b64(String.fromCharCode(...ass))}`;
    const tk = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(T),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    if (!tk.ok) return fora('conta de serviço recusada pelo Google');
    const { access_token } = await tk.json();
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', signal: AbortSignal.timeout(T),
      headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ validate_only: true, message: { token: 'storeapps-status-check', notification: { title: 'status' } } }),
    });
    // Token inventado: o esperado é o FCM aceitar a autenticação e recusar o destino.
    if (r.ok || r.status === 400 || r.status === 404) return ok('push autenticado');
    if (r.status === 401 || r.status === 403) return fora('push sem permissão');
    return aviso(`respondeu ${r.status}`);
  },

  /** Última versão enviada à Apple: rejeitada = aviso (a anterior segue na loja). */
  async ascVersao(env, s) {
    const { r, j } = await asc(env, s, `/v1/apps/${s.appId}/appStoreVersions?filter[platform]=IOS&limit=5&fields[appStoreVersions]=versionString,appStoreState,createdDate`);
    if (r.status === 401) return fora('chave do App Store Connect recusada');
    if (r.status === 403 || r.status === 404) return aviso('a chave não tem acesso a este app');
    if (!r.ok) return aviso(`respondeu ${r.status}`);
    const v = (j.data || []).map((x) => x.attributes).sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate))[0];
    if (!v) return aviso('nenhuma versão enviada');
    const estados = {
      READY_FOR_SALE: ['operacional', 'à venda'], READY_FOR_DISTRIBUTION: ['operacional', 'à venda'],
      WAITING_FOR_REVIEW: ['operacional', 'aguardando revisão'], IN_REVIEW: ['operacional', 'em revisão'],
      PENDING_DEVELOPER_RELEASE: ['operacional', 'aprovada, esperando liberar'], PENDING_APPLE_RELEASE: ['operacional', 'aprovada'],
      PROCESSING_FOR_APP_STORE: ['operacional', 'processando'], PREPARE_FOR_SUBMISSION: ['operacional', 'em preparação'],
      REJECTED: ['degradado', 'REJEITADA pela Apple'], METADATA_REJECTED: ['degradado', 'metadados rejeitados'],
      DEVELOPER_REJECTED: ['degradado', 'retirada da revisão'], INVALID_BINARY: ['degradado', 'binário inválido'],
      REMOVED_FROM_SALE: ['offline', 'removida da venda'], DEVELOPER_REMOVED_FROM_SALE: ['offline', 'retirada da venda'],
    };
    const [estado, txt] = estados[v.appStoreState] || ['operacional', v.appStoreState];
    return { estado, detalhe: `${v.versionString}: ${txt}` };
  },

  /** Certificados e perfis de distribuição: vencimento (30 dias = aviso; vencido = fora). */
  async ascCertificados(env, s) {
    const c = await asc(env, s, '/v1/certificates?limit=200&fields[certificates]=name,certificateType,expirationDate');
    if (c.r.status === 401) return fora('chave do App Store Connect recusada');
    if (!c.r.ok) return aviso(`respondeu ${c.r.status}`);
    const p = await asc(env, s, '/v1/profiles?limit=200&filter[profileState]=ACTIVE&fields[profiles]=name,expirationDate');
    const itens = [
      ...(c.j.data || []).filter((x) => /DISTRIBUTION/.test(x.attributes.certificateType || '')).map((x) => ({ nome: x.attributes.name, vence: x.attributes.expirationDate })),
      ...((p.j && p.j.data) || []).map((x) => ({ nome: x.attributes.name, vence: x.attributes.expirationDate })),
    ].filter((x) => x.vence);
    if (!itens.length) return ok('nenhum certificado de distribuição (assinatura automática)');
    itens.sort((a, b) => Date.parse(a.vence) - Date.parse(b.vence));
    const prox = itens[0];
    const dias = Math.floor((Date.parse(prox.vence) - Date.now()) / 86_400_000);
    const quando = new Date(prox.vence).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (dias < 0) return fora(`${prox.nome} venceu em ${quando}`);
    if (dias < 30) return aviso(`${prox.nome} vence em ${dias} dias`);
    return ok(`o próximo vence em ${quando}`);
  },

  /** R2 pelo binding do próprio Worker (mesma conta Cloudflare): listar 1 objeto. */
  async r2(env, s) {
    const bucket = env[s.binding];
    if (!bucket) return { estado: 'desligado', detalhe: 'falta configurar', naoConfigurado: true };
    await bucket.list({ limit: 1 });
    return ok('bucket responde');
  },
};
