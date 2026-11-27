// Tudo o que a página de status (storeapps.com.br/services) acompanha.
//
// Cada serviço: onde bater, o que conta como "no ar" e, se for homologação ou
// algo ainda não publicado, `sobDemanda: true` (fora do ar = "desligado", não
// "offline"). A URL fica só aqui, no Worker: a página pública recebe nome e
// estado, nunca o endereço (não expõe painéis administrativos).
//
// esperado.status : códigos aceitos (redirect não é seguido)
// esperado.json   : campos que o JSON precisa ter, com o valor
// esperado.texto  : trecho que a resposta precisa conter
// degradado.json  : campos que, se baterem, contam como "degradado"
// frescor         : { caminho, degradadoHoras, foraHoras }: data no JSON (ex.: a última
//                   notícia); mais velha que isso = degradado / offline (worker parado)
// dependeDe       : id de outro serviço; se ele está desligado, este também está
//                   (painel atrás do Cloudflare Access responde mesmo com a máquina desligada)

const HEALTH_VUMBORALA = { status: [200], json: { status: 'healthy', connected_database: 'vumborala' } };

export const GRUPOS = [
  { id: 'storeapps', nome: 'StoreApps' },
  { id: 'vumborala', nome: 'VumboraLá' },
  { id: 'vumborala-hml', nome: 'VumboraLá · homologação' },
  { id: 'hubgamers', nome: 'Hub Gamers' },
  { id: 'oxe', nome: 'Oxe Sushi' },
  { id: 'querido', nome: 'Querido Delivery' },
  { id: 'provedores', nome: 'Provedores que usamos' },
  { id: 'dominios', nome: 'Domínios' },
];

export const SERVICOS = [
  // StoreApps
  { id: 'storeapps-site', grupo: 'storeapps', nome: 'Site storeapps.com.br', url: 'https://storeapps.com.br/', esperado: { status: [200], texto: 'StoreApps' } },
  { id: 'storeapps-privacidade', grupo: 'storeapps', nome: 'Política de privacidade', url: 'https://storeapps.com.br/privacidade.html', esperado: { status: [200] } },

  // VumboraLá · produção
  { id: 'vumborala-api', grupo: 'vumborala', nome: 'API do app do passageiro', url: 'https://vumborala.com.br/api/health', esperado: HEALTH_VUMBORALA },
  { id: 'vumborala-api-motorista', grupo: 'vumborala', nome: 'API do app do motorista', url: 'https://driver.vumborala.com.br/api/health', esperado: HEALTH_VUMBORALA },
  { id: 'vumborala-admin', grupo: 'vumborala', nome: 'Painel administrativo', url: 'https://admin.vumborala.com.br/', esperado: { status: [200, 307, 308] } },
  { id: 'vumborala-master', grupo: 'vumborala', nome: 'Painel das cooperativas', url: 'https://master.vumborala.com.br/', esperado: { status: [200, 307, 308] } },
  { id: 'vumborala-play-passageiro', grupo: 'vumborala', nome: 'Google Play · Passageiro', url: 'https://play.google.com/store/apps/details?id=br.com.vumborala.passenger&hl=pt_BR', esperado: { status: [200] } },
  { id: 'vumborala-play-motorista', grupo: 'vumborala', nome: 'Google Play · Motorista', url: 'https://play.google.com/store/apps/details?id=br.com.vumborala.driver&hl=pt_BR', esperado: { status: [200] } },

  // VumboraLá · homologação (liga sob demanda, desliga às 23h30)
  { id: 'vumborala-hml-api', grupo: 'vumborala-hml', nome: 'API do passageiro', url: 'https://hml.vumborala.com.br/api/health', esperado: HEALTH_VUMBORALA, sobDemanda: true },
  { id: 'vumborala-hml-api-motorista', grupo: 'vumborala-hml', nome: 'API do motorista', url: 'https://driver-hml.vumborala.com.br/api/health', esperado: HEALTH_VUMBORALA, sobDemanda: true },
  // Atrás do Cloudflare Access: o esperado é o redirect para o login da equipe.
  { id: 'vumborala-hml-admin', grupo: 'vumborala-hml', nome: 'Painel administrativo', url: 'https://admin-hml.vumborala.com.br/', esperado: { status: [302] }, sobDemanda: true, dependeDe: 'vumborala-hml-api' },
  { id: 'vumborala-hml-master', grupo: 'vumborala-hml', nome: 'Painel das cooperativas', url: 'https://master-hml.vumborala.com.br/', esperado: { status: [302] }, sobDemanda: true, dependeDe: 'vumborala-hml-api' },

  // Hub Gamers
  { id: 'hubgamers-site', grupo: 'hubgamers', nome: 'Site e app web', url: 'https://hubgamers.com.br/', esperado: { status: [200] } },
  { id: 'hubgamers-api', grupo: 'hubgamers', nome: 'API', url: 'https://api.hubgamers.com.br/v1/health', esperado: { status: [200], json: { status: 'ok' } } },
  // /ready responde 200 até quando degradado: quem decide é o campo status.
  { id: 'hubgamers-api-dados', grupo: 'hubgamers', nome: 'Banco e cache da API', url: 'https://api.hubgamers.com.br/v1/health/ready', esperado: { status: [200], json: { status: 'ok' } }, degradado: { json: { status: 'degraded' } } },
  { id: 'hubgamers-crawler', grupo: 'hubgamers', nome: 'Crawler de notícias', url: 'https://api.hubgamers.com.br/v1/news?limit=1', esperado: { status: [200] }, frescor: { caminho: 'items.0.published_at', degradadoHoras: 12, foraHoras: 24 } },
  { id: 'hubgamers-admin', grupo: 'hubgamers', nome: 'Painel administrativo', url: 'https://admin.hubgamers.com.br/', esperado: { status: [200, 307, 308] } },
  { id: 'hubgamers-extensao', grupo: 'hubgamers', nome: 'Download da extensão Match Lens', url: 'https://hubgamers.com.br/downloads/extension.json', esperado: { status: [200], texto: '"version"' } },
  // Bucket R2 público sem página inicial: 404 do R2 = bucket respondendo.
  { id: 'hubgamers-cdn', grupo: 'hubgamers', nome: 'Imagens e mídia (CDN)', url: 'https://cdn.hubgamers.com.br/', esperado: { status: [200, 404] } },

  // Oxe Sushi
  { id: 'oxe-cardapio', grupo: 'oxe', nome: 'Cardápio digital', url: 'https://oxesushi.com.br/', esperado: { status: [200] } },
  { id: 'oxe-cardapio-dados', grupo: 'oxe', nome: 'Pratos e categorias do cardápio', url: 'https://oxesushi.com.br/api/public/home', esperado: { status: [200], texto: '"categories"' } },
  { id: 'oxe-tv', grupo: 'oxe', nome: 'Tela da TV da loja', url: 'https://tv.oxesushi.com.br/', esperado: { status: [200] } },
  { id: 'oxe-midia', grupo: 'oxe', nome: 'Fotos e vídeos dos pratos', url: 'https://media.oxesushi.com.br/', esperado: { status: [200, 404] } },
  { id: 'oxe-financeiro', grupo: 'oxe', nome: 'Financeiro', url: 'https://financeiro.oxesushi.com.br/login', esperado: { status: [200] } },
  { id: 'oxe-entregas', grupo: 'oxe', nome: 'Gestor de entregas', url: 'https://entregas.oxesushi.com.br/login', esperado: { status: [200] } },
  { id: 'oxe-entregas-sessao', grupo: 'oxe', nome: 'Login do gestor de entregas', url: 'https://entregas.oxesushi.com.br/api/auth/session', esperado: { status: [200] } },

  // Querido Delivery (homologação sob demanda; domínio ainda propagando)
  { id: 'querido-hml-api', grupo: 'querido', nome: 'API · homologação', url: 'https://api-hml.queridodelivery.com.br/api/health', esperado: { status: [200], texto: '"status":"ok"' }, sobDemanda: true },
  { id: 'querido-hml-admin', grupo: 'querido', nome: 'Painel da plataforma · homologação', url: 'https://admin-hml.queridodelivery.com.br/', esperado: { status: [200, 302, 307, 308] }, sobDemanda: true },
  // Domínio ainda em registro no Registro.br (comprado em 26/11)
  { id: 'querido-dominio', grupo: 'querido', nome: 'Domínio queridodelivery.com.br', tipo: 'rdap', intervaloMin: 720, dominio: 'queridodelivery.com.br', sobDemanda: true },
  { id: 'querido-hml-parceiro', grupo: 'querido', nome: 'Painel do parceiro · homologação', url: 'https://parceiro-hml.queridodelivery.com.br/', esperado: { status: [200, 302, 307, 308] }, sobDemanda: true },

  // Provedores: a página de status de cada um, só nos componentes que usamos.
  // tipo statuspage: componentes com estes nomes exatos (o pior manda).
  { id: 'prov-cloudflare', grupo: 'provedores', nome: 'Cloudflare (DNS, túneis, Workers, R2, Access)', tipo: 'statuspage', url: 'https://www.cloudflarestatus.com/api/v2/components.json', componentes: ['Authoritative DNS', 'Tunnel', 'Workers', 'Workers KV', 'R2', 'Access', 'SSL Certificate Provisioning', 'São Paulo, Brazil - (GRU)'] },
  { id: 'prov-github', grupo: 'provedores', nome: 'GitHub (Actions, Pages, pacotes)', tipo: 'statuspage', url: 'https://www.githubstatus.com/api/v2/components.json', componentes: ['Actions', 'Pages', 'Packages', 'Git Operations', 'API Requests'] },
  { id: 'prov-claude', grupo: 'provedores', nome: 'Claude API (Anthropic)', tipo: 'statuspage', url: 'https://status.claude.com/api/v2/components.json', componentes: ['Claude API (api.anthropic.com)'] },
  { id: 'prov-openai', grupo: 'provedores', nome: 'OpenAI API', tipo: 'statuspage', url: 'https://status.openai.com/api/v2/components.json', componentes: ['Chat Completions', 'Responses'] },
  { id: 'prov-firebase', grupo: 'provedores', nome: 'Firebase (notificações push)', tipo: 'google-incidentes', url: 'https://status.firebase.google.com/incidents.json', produtos: ['Cloud Messaging', 'Firebase Cloud Messaging'] },
  { id: 'prov-maps', grupo: 'provedores', nome: 'Google Maps Platform', tipo: 'google-incidentes', url: 'https://status.cloud.google.com/maps-platform/incidents.json' },
  { id: 'prov-aws', grupo: 'provedores', nome: 'AWS São Paulo (EC2, Secrets Manager)', tipo: 'aws', url: 'https://health.aws.amazon.com/public/currentevents', regiao: 'sa-east-1' },
  { id: 'prov-hostinger', grupo: 'provedores', nome: 'Hostinger (servidor do Oxe)', tipo: 'statuspage', url: 'https://statuspage.hostinger.com/api/v2/components.json', componentes: ['BR Datacenter', 'BR-ASC Cloud servers (São Paulo, BR)'] },

  // Domínios: vencimento no Registro.br (menos de 30 dias = aviso; menos de 7 = fora)
  { id: 'dom-storeapps', grupo: 'dominios', nome: 'storeapps.com.br', tipo: 'rdap', intervaloMin: 720, dominio: 'storeapps.com.br' },
  { id: 'dom-vumborala', grupo: 'dominios', nome: 'vumborala.com.br', tipo: 'rdap', intervaloMin: 720, dominio: 'vumborala.com.br' },
  { id: 'dom-hubgamers', grupo: 'dominios', nome: 'hubgamers.com.br', tipo: 'rdap', intervaloMin: 720, dominio: 'hubgamers.com.br' },
  { id: 'dom-oxesushi', grupo: 'dominios', nome: 'oxesushi.com.br', tipo: 'rdap', intervaloMin: 720, dominio: 'oxesushi.com.br' },

  // ---- Contas, saldos e cotas (tipo conta: precisa dos segredos do Worker) ----
  // StoreApps / infraestrutura comum
  { id: 'infra-github', grupo: 'storeapps', nome: 'GitHub Actions (deploys e CI)', tipo: 'conta', checagem: 'github', segredos: ['GITHUB_STATUS_TOKEN'], intervaloMin: 15, repos: ['Store-Apps/vumborala', 'Store-Apps/delivery', 'Store-Apps/storeapps-site'] },

  // VumboraLá
  { id: 'vumborala-ec2', grupo: 'vumborala', nome: 'Servidor (EC2 São Paulo)', tipo: 'conta', checagem: 'ec2', segredos: ['AWS_STATUS_KEY_ID', 'AWS_STATUS_SECRET'], regiao: 'sa-east-1', instancia: 'i-0283329b1f23b2cd5' },
  { id: 'vumborala-neon', grupo: 'vumborala', nome: 'Banco de dados (Neon)', tipo: 'conta', checagem: 'neon', segredos: ['NEON_KEY_VUMBORALA'], projeto: 'floral-mud-98354488', intervaloMin: 15 },
  { id: 'vumborala-sms', grupo: 'vumborala', nome: 'SMS de cadastro (saldo SMS Fire)', tipo: 'conta', checagem: 'smsfire', segredos: ['SMSFIRE_USERNAME_VUMBORALA', 'SMSFIRE_TOKEN_VUMBORALA'], intervaloMin: 15, minimo: 100 },
  { id: 'vumborala-push', grupo: 'vumborala', nome: 'Notificações push (Firebase)', tipo: 'conta', checagem: 'fcm', segredos: ['FIREBASE_SA_VUMBORALA'], intervaloMin: 30 },
  { id: 'vumborala-r2-midia', grupo: 'vumborala', nome: 'Fotos de perfil (R2)', tipo: 'conta', checagem: 'r2', binding: 'R2_VUMBORALA_MEDIA', segredos: [] },
  { id: 'vumborala-r2-docs', grupo: 'vumborala', nome: 'Documentos dos motoristas (R2)', tipo: 'conta', checagem: 'r2', binding: 'R2_VUMBORALA_PRIVATE', segredos: [] },
  { id: 'vumborala-r2-ajuda', grupo: 'vumborala', nome: 'Vídeos da Ajuda (R2)', tipo: 'conta', checagem: 'r2', binding: 'R2_VUMBORALA_AJUDA', segredos: [] },
  { id: 'vumborala-hml-ec2', grupo: 'vumborala-hml', nome: 'Servidor (EC2)', tipo: 'conta', checagem: 'ec2', segredos: ['AWS_STATUS_KEY_ID', 'AWS_STATUS_SECRET'], regiao: 'sa-east-1', instancia: 'i-02bde296c119c9bee', sobDemanda: true },

  // Hub Gamers
  { id: 'hubgamers-ec2', grupo: 'hubgamers', nome: 'Servidor (EC2 São Paulo)', tipo: 'conta', checagem: 'ec2', segredos: ['AWS_STATUS_KEY_ID', 'AWS_STATUS_SECRET'], regiao: 'sa-east-1', instancia: 'i-0038b9390e4aeeb71' },
  { id: 'hubgamers-ia', grupo: 'hubgamers', nome: 'IA da leitura de print do MVP (saldo Claude)', tipo: 'conta', checagem: 'anthropic', segredos: ['ANTHROPIC_KEY_HUBGAMERS'], intervaloMin: 30 },
  { id: 'hubgamers-ia-gpt', grupo: 'hubgamers', nome: 'OpenAI do Hub Gamers (saldo GPT)', tipo: 'conta', checagem: 'openai', segredos: ['OPENAI_KEY_HUBGAMERS'], intervaloMin: 30, modelo: 'gpt-4.1-mini' },
  { id: 'hubgamers-sms', grupo: 'hubgamers', nome: 'SMS de login (saldo SMS Fire)', tipo: 'conta', checagem: 'smsfire', segredos: ['SMSFIRE_USERNAME_HUBGAMERS', 'SMSFIRE_TOKEN_HUBGAMERS'], intervaloMin: 15, minimo: 100 },
  { id: 'hubgamers-x', grupo: 'hubgamers', nome: 'X/Twitter das notícias (teto do mês)', tipo: 'conta', checagem: 'xapi', segredos: ['X_BEARER_HUBGAMERS'], intervaloMin: 60 },
  { id: 'hubgamers-proxy', grupo: 'hubgamers', nome: 'Proxy da sala da FACEIT (saldo IPRoyal)', tipo: 'conta', checagem: 'iproyal', segredos: ['IPROYAL_TOKEN_HUBGAMERS'], intervaloMin: 30 },
  { id: 'hubgamers-faceit', grupo: 'hubgamers', nome: 'FACEIT Data API', tipo: 'conta', checagem: 'faceit', segredos: ['FACEIT_KEY_HUBGAMERS'], intervaloMin: 15 },
  { id: 'hubgamers-steam', grupo: 'hubgamers', nome: 'Steam Web API', tipo: 'conta', checagem: 'steam', segredos: ['STEAM_KEY_HUBGAMERS'], intervaloMin: 15 },
  { id: 'hubgamers-push', grupo: 'hubgamers', nome: 'Notificações push (Firebase)', tipo: 'conta', checagem: 'fcm', segredos: ['FIREBASE_SA_HUBGAMERS'], intervaloMin: 30 },
  { id: 'hubgamers-r2-midia', grupo: 'hubgamers', nome: 'Mídia (R2)', tipo: 'conta', checagem: 'r2', binding: 'R2_HUBGAMERS_MEDIA', segredos: [] },
  { id: 'hubgamers-r2-privado', grupo: 'hubgamers', nome: 'Arquivos privados (R2)', tipo: 'conta', checagem: 'r2', binding: 'R2_HUBGAMERS_PRIVATE', segredos: [] },

  // Oxe Sushi
  { id: 'oxe-ia-claude', grupo: 'oxe', nome: 'IA das notas e maquininha (saldo Claude)', tipo: 'conta', checagem: 'anthropic', segredos: ['ANTHROPIC_KEY_OXE'], intervaloMin: 30 },
  { id: 'oxe-ia-gpt', grupo: 'oxe', nome: 'IA das notas e maquininha (saldo GPT)', tipo: 'conta', checagem: 'openai', segredos: ['OPENAI_KEY_OXE'], intervaloMin: 30, modelo: 'gpt-4.1-mini' },
  { id: 'oxe-github', grupo: 'oxe', nome: 'GitHub Actions (deploys do Oxe)', tipo: 'conta', checagem: 'github', segredos: ['GITHUB_STATUS_TOKEN_OXE'], intervaloMin: 15, repos: ['BrunoCarvalhoSI/oxe-sushi'] },
  { id: 'oxe-telegram', grupo: 'oxe', nome: 'Avisos no Telegram', tipo: 'conta', checagem: 'telegram', segredos: ['TELEGRAM_TOKEN_OXE'], intervaloMin: 15 },

  // Querido Delivery
  { id: 'querido-ec2', grupo: 'querido', nome: 'Servidor da homologação (EC2)', tipo: 'conta', checagem: 'ec2', segredos: ['AWS_STATUS_KEY_ID', 'AWS_STATUS_SECRET'], regiao: 'sa-east-1', instancia: 'i-03fa95110df0fe345', sobDemanda: true },
  { id: 'querido-neon', grupo: 'querido', nome: 'Banco de dados (Neon)', tipo: 'conta', checagem: 'neon', segredos: ['NEON_KEY_QUERIDO'], projeto: 'curly-morning-96033755', intervaloMin: 15, sobDemanda: true },
];
