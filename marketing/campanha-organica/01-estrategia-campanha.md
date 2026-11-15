# Estratégia da campanha orgânica — SPACE TECH OS

- Status: RASCUNHO (15/11/2026). Nada deste documento foi publicado.
- Decisão do Fabio: nenhum gasto com anúncio. Campanha 100% orgânica.
- Fatos: somente `fatos-verificados.md` (R$ 40/mês ou R$ 456/ano, 7 dias grátis sem cartão, recursos listados lá).
- Alinhado a `calendario-30-dias.md` (campanha `lancamento-nov26`, 12/11 a 15/12/2026). Toda publicação segue o fluxo de aprovação individual do `README.md`.

## 1. Objetivo e KPIs

Objetivo: levar donos de assistência técnica de celular a criar conta no teste de 7 dias e, depois, assinar, usando conteúdo de bancada com a tela real.

| KPI | Fonte | Observação |
|---|---|---|
| Alcance | Meta Business Suite / TikTok Análises | Indicador de topo, não de decisão sozinho |
| Salvamentos e compartilhamentos | Painel de cada rede | Melhor sinal de utilidade; guia a semana 4 |
| Cliques no link da bio | Painel da rede + UTM | Instagram/TikTok |
| Cadastros com `utm_medium=bio` | `/admin` | Só mensurável depois que o site registrar UTM; hoje só grava `?ref=` |
| Testes iniciados | `/admin` | Cadastro = teste iniciado |
| Assinaturas | `/admin`, Pix/Mercado Pago | Meta principal |

Linha de base (09/11, `resultados.md`): 4 contas nos últimos 30 dias, 36 no total, 27 em teste, 4 no plano mensal, visitas sem medição. Metas numéricas só depois da primeira semana de dados, definidas com o Fabio (não inventar).

Enquanto a UTM não for registrada, perguntar a cada novo cadastro "como você conheceu o SPACE TECH OS?" e anotar na tabela de origem.

## 2. Pilares de conteúdo por público

| Público | Dor | Pilar | Exemplos do calendário |
|---|---|---|---|
| Dono-técnico | Tempo perdido respondendo cliente e anotando OS | Cliente acompanha a OS pelo link/QR; orçamento aprovado online; fotos e checklist de entrada | IG-03, IG-05, TT-01, TT-02 |
| Balcão + acessórios | Estoque some, caixa não fecha | Venda e OS baixam o estoque; alerta de mínimo; caixa e DRE | IG-06, IG-07 |
| Seminovos | Não sabe o custo real do aparelho | Compra, conserto, venda e garantia no mesmo lugar | IG-08 |
| MEI | Declaração anual | Relatório MEI: receita mês a mês, comércio e serviços | Novo (04/12) |

Transversais: preço claro (IG-04, TT-03); agendamento online e buscador de películas (07/12). Telas de exemplo com "valores ilustrativos". Tom: técnico para técnico, sem exagero, sem promessa de resultado.

## 3. Formatos e frequência por rede (conforme calendário)

| Rede | Formato | Frequência | Observações |
|---|---|---|---|
| Instagram | Reels de bancada (tela real), carrosséis, imagem | Um dia sim, um dia não, 12h BRT | Link da bio com `utm_medium=bio` |
| Facebook | Mesmos posts do Instagram | Junto com o Instagram | Agenda em `/admin/marketing` |
| TikTok | Vídeo curto POV / antes e depois | 2 a 3 por semana | Hoje só rascunho em conta sandbox; nada público até a revisão do TikTok. Copiar legenda manualmente |
| WhatsApp Status | Arte repetida (IG-04, IG-06) | Só com autorização específica do Fabio | 05/12 e 10/12 só se autorizado. Sem lista de transmissão |
| WhatsApp individual | Resposta a quem perguntar (WA-01); ajuda no 5º dia do teste (WA-02) | Sob demanda | Cada envio exige autorização. Sem mensagem em massa |
| Google Perfil da Empresa | Apresentação (GO-01), teste grátis (GO-03) | A cada 2 semanas | Só se o perfil existir; hoje adiado |

Dias sem post: responder comentários e mensagens (isso também é conteúdo de conversão).

## 4. Parcerias e indicação sem pagamento

- Programa de indicação `?ref=`: divulgar a quem já assina, sem prometer valores não cadastrados.
- Depoimentos (WA-03, 30/11): pedido individual a assinantes que o Fabio escolher; só publica com autorização escrita guardada antes. Post de 09/12 depende disso.
- Comunidades de técnicos (grupos de Facebook/WhatsApp): participar respondendo dúvidas, sem spam e sem divulgação em massa. Regras do grupo respeitadas.
- Parcerias com criadores/técnicos: apenas conversa sem pagamento, e só com aprovação do Fabio caso a caso. Nenhuma promessa de comissão ou desconto fora de `fatos-verificados.md`.

## 5. Ciclo de medição semanal

1. Toda segunda: preencher `resultados.md` com alcance, cliques no link, mensagens, visitas (se houver), cadastros e assinaturas da semana anterior. Só números conferidos na fonte.
2. Preencher "Por conteúdo" 7 dias depois de cada publicação (alcance, curtidas, comentários, salvamentos, compartilhamentos, cliques).
3. Quarta 25/11: revisão das semanas 1 e 2. Dia 14/12: balanço do mês.
4. Decisão: conteúdos com mais salvamentos e cliques viram versões novas na semana 4 (03 a 13/12); anotar em "Decisões e aprendizados".
5. Cada novo cadastro: registrar a origem informada.

## 6. Dependências no site (fora desta pasta, exigem autorização e deploy)

Registro de UTM no cadastro; og:image; sitemap e canonical; links de Termos/Privacidade no rodapé; contador de visitas ou Search Console; legenda "valores ilustrativos"; botão de contato (depende do contato oficial, pendente em `fatos-verificados.md`).

## 7. Regras

Não citar Nota Fiscal, Play Store, depoimentos sem autorização escrita, números de clientes, resultados prometidos, superlativos ou concorrentes pelo nome. Rodar `node marketing/ferramentas/verificar.mjs` nos conteúdos antes de enviar para aprovação.

## 8. Pendência de consistência

`calendario-30-dias.md` ainda menciona decidir anúncio pago (GO-02 / MA-01, na semana 3 em diante). Isso conflita com "nenhum gasto". Ajustar essa linha quando o Fabio confirmar.
