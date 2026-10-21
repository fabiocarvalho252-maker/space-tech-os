# Crediário — App de proteção do aparelho (especificação técnica)

Documento para contratar um desenvolvedor Android. Descreve **o que** o
aplicativo de proteção deve fazer e como ele conversa com o SPACE TECH. A
implementação do app (o código Android) é responsabilidade do desenvolvedor;
o lado do servidor (API, banco, painel) é do SPACE TECH e está descrito aqui.

> **Modelo legítimo, consentido.** O app é instalado com o consentimento do
> cliente (termo de bloqueio aceito na venda, já gerado em PDF pelo sistema) e
> usa exclusivamente os mecanismos **oficiais e documentados** do Android para
> gestão de dispositivos (Device Owner / Android Enterprise) ou o **Samsung
> Knox Guard**. Não se trata de um app oculto nem de qualquer técnica de
> evasão, root ou espionagem. O bloqueio **sempre** permite chamadas de
> emergência e o app **não** acessa fotos, mensagens, contatos, câmera,
> microfone ou localização.

---

## 1. Objetivo

Quando o cliente compra um aparelho parcelado (crediário) na loja, o aparelho
recebe um app de proteção. Enquanto houver parcela vencida além da tolerância,
o aparelho é **bloqueado**; ao pagar, é **liberado**; ao quitar o contrato, a
proteção é **removida** de vez. Toda a regra de negócio (quando bloquear,
quanto cobrar, quando liberar) já existe no servidor SPACE TECH — o app apenas
**obedece ao estado** que o servidor informa e mostra ao cliente como pagar.

---

## 2. Escopo

### No escopo do app
- Provisionar-se como administrador do aparelho (Device Owner) na configuração
  inicial, via QR code, ou integrar-se ao Knox Guard (ver seção 4).
- Autenticar-se no servidor SPACE TECH e sincronizar o estado periodicamente.
- Aplicar o estado `liberado` / `bloqueado` / `removido`.
- Exibir uma tela de bloqueio com o valor devido e o Pix copia-e-cola, sempre
  permitindo chamadas de emergência.
- Confirmar ao servidor que executou cada comando.
- Sobreviver a reinício do aparelho (reaplicar o estado no boot).

### Fora do escopo (NÃO fazer)
- Acessar ou transmitir dados pessoais do usuário (fotos, mensagens, contatos,
  localização, câmera, microfone, histórico).
- Qualquer técnica de ocultação, root, exploração de falhas ou evasão das
  proteções do Android ou do usuário.
- Rastreamento/vigilância do aparelho.
- Impedir chamadas de emergência em qualquer situação.

---

## 3. Base técnica recomendada (escolher uma)

O "travar o aparelho resistindo a reset de fábrica" só é possível, de forma
legítima, quando o app é **Device Owner** — e isso exige provisionamento na
configuração de fábrica (aparelho novo ou recém-resetado). Três caminhos:

| Opção | O que é | Prós | Contras |
|---|---|---|---|
| **A. Device Owner próprio (Android Enterprise / AOSP)** | App que o dev constrói usando `DevicePolicyManager`, provisionado por QR na tela de boas-vindas do Android | Funciona em qualquer Android 7+; sem custo por aparelho; controle total | Exige provisionamento no setup de fábrica de cada aparelho; manutenção por sua conta |
| **B. Samsung Knox Guard** | Serviço oficial da Samsung para bloquear aparelhos financiados | Painel pronto, robusto, suporte Samsung | Só Samsung; custo por licença; cadastro como parceiro |
| **C. Provedor brasileiro de "trava de financiado"** | Empresa que revende o app + painel prontos | Pronto para CDC/Procon; menos trabalho | Depende de terceiro; custo recorrente |

**Recomendação:** começar pela **Opção A (Device Owner próprio)** se você quer
"o seu próprio" app e aceita provisionar cada aparelho no setup; avaliar a
**Opção B (Knox Guard)** se a maior parte do seu estoque for Samsung. As duas
usam a **mesma API de servidor** descrita na seção 6 — o que muda é só como o
app aplica o bloqueio.

---

## 4. Provisionamento (como o app vira Device Owner)

> Referência oficial: Android Enterprise — *Provision a fully managed device*
> e *Device Owner QR code provisioning*. O dev deve seguir a documentação
> oficial do Google; abaixo está o fluxo esperado do ponto de vista da loja.

1. O aparelho precisa estar **de fábrica** (novo ou após reset).
2. Na primeira tela de configuração do Android, toca-se 6× na tela para abrir o
   leitor de QR de provisionamento.
3. O vendedor, no painel SPACE TECH, abre o contrato e gera o **QR de
   provisionamento**, que contém:
   - o pacote/checksum do APK do app (para o Android baixar e instalar o app
     como Device Owner);
   - o **código de ativação** do contrato (ver seção 5), passado como `extra`
     de provisionamento.
4. O aparelho lê o QR, instala o app como Device Owner e dispara o fluxo de
   ativação (seção 5).
5. A partir daí o app é administrador do aparelho e aplica os bloqueios.

**Importante:** o APK precisa ser assinado com uma **chave estável** cujo
checksum vai no QR. Se a chave mudar depois que houver aparelhos em campo, os
QRs antigos deixam de funcionar. Guarde a keystore com segurança e nunca a
versione no git.

---

## 5. Ativação (primeira troca de credenciais)

O código de ativação é de **uso único**, com validade de 24h, gerado no painel.
O app o troca por um **segredo próprio do aparelho**. O servidor guarda só o
hash do segredo.

```
POST /api/crediario/dispositivo/ativar
Content-Type: application/json

{ "codigo": "W9N82KGS", "imei": "490154203237518", "modelo": "SM-A155M", "app_versao": "1.0.0" }
```

Resposta `200`:
```json
{ "token": "<contrato_id>.<segredo>", "estado": { ... ver seção 6 ... } }
```

- O app guarda o `token` em armazenamento privado do app (não exportado).
- `imei` é usado só para conferir que é o aparelho do contrato; se não bater, a
  ativação é recusada.
- Erros: `404` código inválido/expirado, `409` contrato encerrado ou IMEI
  diferente.

---

## 6. Sincronização (o coração do app)

A cada ~15 minutos (e no boot, e ao receber um push, se houver), o app chama:

```
POST /api/crediario/dispositivo/sincronizar
Authorization: Bearer <contrato_id>.<segredo>
Content-Type: application/json

{ "app_versao": "1.0.0", "confirmados": ["<id de comando já executado>", ...] }
```

Resposta `200` — **este é o estado que o app deve aplicar**:
```json
{
  "status_aparelho": "liberado | bloqueado | removido",
  "bloqueado": false,
  "remover_protecao": false,
  "contrato": "CR-0001",
  "loja": { "nome": "SPACE TECH", "whatsapp": "5574999294500" },
  "parcela": {
    "numero": 1, "total": 3,
    "vencimento": "2026-10-21",
    "valor": 340.22,
    "dias_atraso": 2
  },
  "comandos": [
    { "id": "uuid", "tipo": "bloquear", "motivo": "Atraso de 2 dia(s)", "payload": {} }
  ],
  "proxima_sincronizacao_min": 15
}
```

Regras que o app aplica a partir da resposta:
- `status_aparelho = "bloqueado"` → mostrar a tela de bloqueio (seção 7).
- `status_aparelho = "liberado"` → remover a tela de bloqueio; aparelho normal.
- `status_aparelho = "removido"` → **desativar-se**: remover políticas, sair do
  modo Device Owner e se desinstalar (contrato quitado/cancelado).
- `comandos[]` → executar na ordem; depois de executado, mandar o `id` em
  `confirmados` na próxima sincronização.
- O campo `status_aparelho` é a **fonte da verdade**. Mesmo sem comando novo na
  fila, se `bloqueado` divergir do estado atual do aparelho, o app corrige.

### Pedido de Pix pela tela de bloqueio
```
POST /api/crediario/dispositivo/pix
Authorization: Bearer <contrato_id>.<segredo>
```
Resposta `200`:
```json
{ "valor": 340.22, "copia_e_cola": "000201...", "qr_code_base64": "iVBORw0K...", "expira_em": "2026-10-21T23:59:00-03:00" }
```
Erro `409` se a loja não tiver Pix (Mercado Pago) configurado — nesse caso a
tela mostra "procure a loja para pagar".

---

## 7. Tela de bloqueio

Quando `bloqueado = true`, o app apresenta uma tela que:
- **Cobre o uso normal** do aparelho (via Device Owner / lock task / HOME
  gerenciado — mecanismos oficiais), reaparecendo após reinício.
- Mostra: nome da loja, número do contrato, parcela em atraso, valor
  atualizado (com multa/juros) e **dias de atraso**.
- Mostra o **QR Pix e o copia-e-cola** (botão "copiar"), obtidos no endpoint de
  Pix. A baixa é automática: quando o pagamento é confirmado, a próxima
  sincronização retorna `liberado` e a tela some.
- Oferece um botão de **chamada de emergência** sempre acessível.
- Mostra o WhatsApp da loja para contato.
- **Nunca** pede senha, dado bancário, nem qualquer dado pessoal.

Assim que o cliente paga (Pix ou na loja), em até ~15 min (ou na hora, se o app
tiver um botão "já paguei, verificar") o aparelho é liberado automaticamente.

---

## 8. Reinício e persistência

- No `BOOT_COMPLETED` e após atualização do app, sincronizar e reaplicar o
  estado atual.
- Entre sincronizações, manter o último estado conhecido (se estava bloqueado e
  ficou sem rede, continua bloqueado; a tela de bloqueio mostra os dados em
  cache).
- Isso é feito com os recursos padrão de Device Owner — não há (e não deve
  haver) nenhum truque fora do modelo oficial.

---

## 9. Segurança

- Toda comunicação por **HTTPS** com o domínio do SPACE TECH.
- O segredo do aparelho fica em armazenamento privado do app; o servidor guarda
  só o **SHA-256**.
- O `Authorization: Bearer <contrato_id>.<segredo>` identifica o aparelho; o
  servidor só devolve dados **daquele** contrato.
- Regenerar o código de ativação no painel invalida o segredo anterior (serve
  para reinstalar após troca de aparelho).
- O app não expõe nenhum serviço/porta; só faz chamadas de saída.

---

## 10. Lado do servidor (responsabilidade do SPACE TECH)

Já existe no SPACE TECH: contratos, parcelas, a **fila de comandos**
(`crediario_comandos` com `bloquear`/`liberar`/`mensagem`/`remover_protecao`),
cálculo de atraso, Pix por parcela e o estado desejado do aparelho
(`crediario_contratos.status_aparelho`, `provisionado_em`, `ultimo_contato`).

Falta (re)construir, e **pode ser feito pelo próprio SPACE TECH**:
- Tabela `crediario_dispositivos` (código de ativação, hash do segredo).
- Função para **gerar o código de ativação** no painel.
- Endpoints `POST /api/crediario/dispositivo/ativar | sincronizar | pix`
  (contrato descrito nas seções 5–6).
- Tela no painel para gerar o **QR de provisionamento** e o código de ativação,
  e para acompanhar `último contato` / versão do app por contrato.

> Esse lado do servidor (banco, API, painel) é a "ponte" entre o app e o
> sistema. É trabalho de back-end comum e pode ser implementado no próprio
> projeto SPACE TECH, separado do app Android.

---

## 11. Conformidade legal (revisar com advogado)

- **Consentimento:** o cliente aceita o termo de bloqueio na venda; o contrato
  em PDF (gerado pelo sistema) deve ser assinado e arquivado.
- **CDC (Código de Defesa do Consumidor):** multa de mora limitada a 2% e juros
  a 1% ao mês — já respeitado pelo sistema.
- **Chamadas de emergência** sempre disponíveis, inclusive com o aparelho
  bloqueado.
- **LGPD:** o app não coleta dados pessoais; a única informação técnica é
  IMEI/modelo/versão, para identificar o aparelho do contrato.
- **Procon:** recomenda-se transparência total — informar o cliente, no ato da
  venda, que o aparelho tem o app e como o bloqueio funciona.

Confirme tudo isso com um advogado antes de operar.

---

## 12. Entregáveis esperados do desenvolvedor

1. APK Device Owner (ou integração Knox Guard) com o comportamento das seções
   4–8.
2. Keystore de release documentada (checksum para o QR de provisionamento).
3. Procedimento de provisionamento passo a passo para a equipe da loja.
4. Teste em pelo menos 2 fabricantes (ex.: Samsung + Motorola) e 2 versões de
   Android.
5. Código-fonte entregue à SPACE TECH.

## 13. Critérios de aceite

- Provisionar um aparelho de fábrica por QR e ativá-lo com um código do painel.
- Bloquear/liberar pelo painel reflete no aparelho em até 15 min.
- Atraso real bloqueia; pagamento (Pix) libera automaticamente.
- Reiniciar o aparelho bloqueado mantém o bloqueio.
- Quitar o contrato remove a proteção e o app se desinstala.
- Chamada de emergência funciona com o aparelho bloqueado.
- O app não solicita nem envia nenhum dado pessoal.
