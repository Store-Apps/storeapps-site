# StoreApps — site institucional

Site estático publicado pelo GitHub Pages a partir de `main`, na raiz, com domínio `storeapps.com.br`. Não exige build; `index.html`, `styles.css`, `site.js` e `img/` são os arquivos publicados.

## Contato por chamado

O formulário envia JSON para `https://vumborala.com.br/api/public/contato` com `app: "site"`, nome, produto, tópico, mensagem e contatos. A API grava na fila existente **Chamados → Contato externo**, com origem **Site StoreApps**, e devolve o protocolo `CE-…`. O nome e o produto entram no relato no servidor e seguem a retenção existente. O visitante não precisa de conta. A equipe responde pelo e-mail/telefone informado; não existe conversa pública nem e-mail automático de confirmação.

Antes de publicar o formulário, publicar a alteração da API/painel do repositório Vumborala e aplicar `133_contato_site_storeapps.sql`. O CORS libera somente `https://storeapps.com.br` e `https://www.storeapps.com.br`, exclusivamente na rota pública do contato. Limites e sanitização são os mesmos do canal existente.

O site só mostra sucesso quando recebe HTTP de sucesso, `success: true` e um protocolo válido da API. Falhas preservam o formulário, sem reenvio automático. Não há credenciais no navegador. O comprovante pode ser copiado ou baixado como TXT.

Para visualizar localmente: `python -m http.server 4180 --bind 127.0.0.1`. A API permite CORS de localhost para desenvolvimento. Não enviar formulários de teste para produção; usar interceptação no navegador ou o banco local de testes do Vumborala.

Fonte Rubik distribuída com sua licença em `img/OFL-Rubik.txt`.

## Links para iPhone e iPad

Os dois aplicativos VumboraLá estão na App Store. Links confirmados na API pública da Apple pelo bundle ID e pelo vendedor STOREAPPS TECNOLOGIA LTDA:

- Passageiro (`br.com.vumborala.passenger`): https://apps.apple.com/br/app/vumborala/id6831323631
- Motorista (`br.com.vumborala.driver`): https://apps.apple.com/br/app/vumborala-motorista/id6831854412

Cada aplicativo apresenta seus próprios botões Google Play e App Store no site.

## Artes oficiais

As imagens são cópias diretas dos arquivos usados pelos aplicativos, sem redesenho ou alteração de cores:

- `img/vumborala-oficial.png`: `vumboraLA/packages/shared/assets/images/passenger_mark.png`.
- `img/vumborala-motorista-oficial.png`: `vumboraLA/packages/shared/assets/images/driver_mark.png`.
- `img/vumborala-logo-oficial.png`: `vumboraLA/packages/shared/assets/images/logo_horizontal.png`.
- `img/hubgamers-enviado.png`: arquivo `hub_gamers_mark.png` enviado pelo usuário, copiado sem alterações.
- `img/storeapps-logo-oficial.jpeg`: logo horizontal enviado pelo usuário em `WhatsApp Image 2026-08-27 at 11.14.01.jpeg`.
- `img/storeapps-simbolo-oficial.jpeg`: símbolo enviado em `WhatsApp Image 2026-08-27 at 11.14.00 (1).jpeg`.

O visual usa a paleta das imagens da StoreApps: azul-marinho `#040A28`, azul vivo `#0646ED`, ciano `#00BFF3`, branco e os tons coloridos do símbolo original. O logo horizontal aparece no cabeçalho, rodapé e página de privacidade. Não redesenhar a marca nem recolorir as artes fornecidas.

Os selos das lojas são arquivos oficiais em português, sem alterações:

- Apple: https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/pt-br → `img/app-store-oficial.svg`.
- Google: https://play.google.com/intl/en_us/badges/static/images/badges/pt-br_badge_web_generic.png → `img/google-play-oficial.png`.

Preservar a proporção e o espaço de proteção dos selos. As imagens ficam hospedadas no próprio site. A revisão da folha de estilos na URL deve ser atualizada quando o visual mudar, para evitar que o navegador conserve uma versão anterior.
