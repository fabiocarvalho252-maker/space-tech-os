# aprovacao/ — aguardando a sua decisão

Cada arquivo é **um** conteúdo com status **AGUARDANDO APROVAÇÃO**.

Pelo painel: abra o conteúdo em `/admin/marketing`, marque as plataformas em
"Sua decisão" e clique em **Aprovar** (ou **Recusar**, com o motivo).

Pela conversa, para aprovar um conteúdo (um de cada vez):

1. Leia o arquivo; se quiser mudar algo, peça a alteração (ele continua aqui).
2. Diga explicitamente, por exemplo: *"Aprovo o IG-01 para Instagram e Facebook"*.
3. O arquivo vai para `../aprovados/` com status `APROVADO` e o bloco
   "Aprovação" preenchido com o seu nome, a data e as plataformas autorizadas.

Aprovar um conteúdo **não** aprova outros, nem autoriza publicar em plataformas
que não estejam escritas na aprovação, nem autoriza gasto com anúncio.

Para recusar: diga *"Recuso o XX-00"* (com o motivo, se quiser) — ele volta
para `../conteudos/` como `RASCUNHO`.
