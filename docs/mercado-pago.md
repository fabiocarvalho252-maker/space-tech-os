# Mercado Pago — assinatura SaaS

Como a SPACE TECH cobra as empresas clientes pelo plano Básico/Profissional.
**Não confundir** com `pagamento_config` (Configurações → Mercado Pago
dentro do app) — aquilo é o Mercado Pago de cada empresa cliente pra cobrar
os clientes *dela* (usado em Cobranças). São duas contas Mercado Pago
diferentes, dois módulos diferentes:

| | Quem cobra quem | Token | Onde mora |
|---|---|---|---|
| Cobranças (Pix) | empresa cliente → cliente dela | `pagamento_config.mercado_pago_access_token` (por empresa) | `src/lib/pix/` |
| Assinatura SaaS | SPACE TECH → empresa cliente | `process.env.MERCADOPAGO_ACCESS_TOKEN` (plataforma) | `src/lib/mercadopago/` |

## Como configurar

1. Crie (ou use) uma Application no [painel de desenvolvedores do Mercado
   Pago](https://www.mercadopago.com.br/developers/panel) — a conta da
   própria SPACE TECH, não a de um cliente.
2. Copie o **Access Token** e a **Public Key** de teste (modo sandbox) pra
   `MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_PUBLIC_KEY` no `.env`.
3. Em "Suas integrações" → a Application → "Notificações webhook",
   configure a URL `https://SEU-DOMINIO/api/subscriptions/mercadopago/webhook`
   e copie o segredo gerado pra `MERCADOPAGO_WEBHOOK_SECRET`.
4. Mantenha `MERCADOPAGO_ENVIRONMENT=test` até ter certeza de que o fluxo
   funciona ponta a ponta. Trocar pra `production` é manual — nada no
   código troca isso sozinho.

Sem `MERCADOPAGO_ACCESS_TOKEN`, tentar contratar um plano retorna "Mercado
Pago não configurado" em vez de travar — o app inteiro continua funcionando
normalmente sem essa variável.

## Regra de preço

Nenhuma cobrança é criada enquanto o preço do plano (`plans.monthly_price`/
`annual_price`) estiver `NULL`. Isso é verificado no backend
(`iniciarAssinatura`, `src/lib/mercadopago/subscription-service.ts`), não
só escondido na tela — mandar `planId`/`billingCycle` direto pra API não
contorna a checagem, porque o preço é sempre buscado do banco, nunca
aceito do chamador.

## Cartão vs Pix

- **Cartão**: usa a API oficial de Assinaturas do Mercado Pago
  (`/preapproval`) — débito automático recorrente de verdade. O checkout
  é o hospedado pelo próprio Mercado Pago (`init_point`); o navegador é
  redirecionado pra lá, então nenhum dado de cartão passa pelo nosso
  backend.
- **Pix**: o Mercado Pago não tem débito automático recorrente via Pix. A
  cada ciclo de cobrança gera-se uma cobrança avulsa (mesmo mecanismo que
  já existe em Cobranças, reaproveitado de `src/lib/pix/mercadopago-api.ts`),
  vinculada à assinatura via `subscription_payments`.

## Webhook

`POST /api/subscriptions/mercadopago/webhook`, wired direto em
`src/server.ts` (fora do dispatcher de server functions, porque o Mercado
Pago não passa pela checagem de CSRF same-origin — mesmo motivo do webhook
do WhatsApp e do webhook de Cobranças).

Regra de segurança: **o corpo do webhook nunca é confiável sozinho**.
Todo evento recebido dispara uma re-consulta direta à API do Mercado Pago
(`GET /preapproval/{id}` ou `GET /v1/payments/{id}`) antes de qualquer
mudança de status — um webhook forjado só pode, no máximo, causar uma
re-checagem antecipada de um pagamento real, nunca injetar um status
"pago" falso. A validação `x-signature` (HMAC, quando
`MERCADOPAGO_WEBHOOK_SECRET` está configurado) é uma segunda camada contra
spam de requisições, não a única defesa.

Idempotência: cada tentativa de cobrança tem uma `external_reference`
única (`ST-{empresaId}-{subscriptionId}-{uuid}`), e a reconciliação só
grava se o status mudou de fato — o mesmo webhook chegando duas vezes não
duplica pagamento nem ativação.

## Testar

Sem uma credencial de teste (sandbox) da SPACE TECH, o único teste possível
é confirmar que a trava de segurança funciona: sem
`MERCADOPAGO_ACCESS_TOKEN` ou com o preço do plano em `NULL`,
`iniciarAssinatura` recusa antes de tentar qualquer chamada de rede. Com
credenciais de teste em mãos, use os [usuários de teste do Mercado
Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/accounts)
pra simular uma contratação completa.
