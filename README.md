# StoreApps — site institucional

Site estático publicado pelo GitHub Pages a partir de `main`, na raiz, com domínio `storeapps.com.br`. Não exige build; `index.html`, `styles.css`, `site.js` e `img/` são os arquivos publicados.

## Contato por chamado

O formulário envia JSON para `https://vumborala.com.br/api/public/contato` com `app: "site"`, nome, produto, tópico, mensagem e contatos. A API grava na fila existente **Chamados → Contato externo**, com origem **Site StoreApps**, e devolve o protocolo `CE-…`. O nome e o produto entram no relato no servidor e seguem a retenção existente. O visitante não precisa de conta. A equipe responde pelo e-mail/telefone informado; não existe conversa pública nem e-mail automático de confirmação.

Antes de publicar o formulário, publicar a alteração da API/painel do repositório Vumborala e aplicar `133_contato_site_storeapps.sql`. O CORS libera somente `https://storeapps.com.br` e `https://www.storeapps.com.br`, exclusivamente na rota pública do contato. Limites e sanitização são os mesmos do canal existente.

O site só mostra sucesso quando recebe HTTP de sucesso, `success: true` e um protocolo válido da API. Falhas preservam o formulário, sem reenvio automático. Não há credenciais no navegador. O comprovante pode ser copiado ou baixado como TXT.

Para visualizar localmente: `python -m http.server 4180 --bind 127.0.0.1`. A API permite CORS de localhost para desenvolvimento. Não enviar formulários de teste para produção; usar interceptação no navegador ou o banco local de testes do Vumborala.

Fonte Rubik distribuída com sua licença em `img/OFL-Rubik.txt`.

## Artes oficiais

As imagens são cópias diretas dos arquivos usados pelos aplicativos, sem redesenho ou alteração de cores:

- `img/vumborala-oficial.png`: `vumboraLA/packages/shared/assets/images/passenger_mark.png`.
- `img/vumborala-motorista-oficial.png`: `vumboraLA/packages/shared/assets/images/driver_mark.png`.
- `img/vumborala-logo-oficial.png`: `vumboraLA/packages/shared/assets/images/logo_horizontal.png`.
- `img/hubgamers-oficial.png`: `HUBGAMERS/apps/frontend/mobile/assets/images/hub_gamers_mark.png`.

A StoreApps mantém a assinatura em texto do site original. Não usar símbolos inventados como identidade oficial. Um arquivo de marca da StoreApps deve ser fornecido para substituir essa assinatura por imagem.
