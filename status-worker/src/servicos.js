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
  { id: 'querido-hml-parceiro', grupo: 'querido', nome: 'Painel do parceiro · homologação', url: 'https://parceiro-hml.queridodelivery.com.br/', esperado: { status: [200, 302, 307, 308] }, sobDemanda: true },
];
