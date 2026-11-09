# Estratégia de marketing — SPACE TECH OS

> Base de fatos: `fatos-verificados.md`. Nada aqui autoriza publicação ou
> gasto: cada conteúdo passa pela aprovação individual descrita no `README.md`.

## 1. Posicionamento

**Para** donos de assistência técnica de celular (loja pequena, de 1 a poucos
técnicos), **que** ainda controlam OS, peças e caixa em caderno, planilha ou
WhatsApp, **o SPACE TECH OS é** um sistema de gestão feito para a rotina de
assistência **que** junta OS, cliente, estoque, vendas e financeiro em um lugar
só e deixa o cliente acompanhar o conserto e aprovar o orçamento pelo link.

**Frase-guia:** *"Sua assistência organizada, do balcão ao fechamento do caixa."*

### Diferenciais que podemos provar (mostrar na tela, não só falar)

1. **Cliente acompanha a OS sozinho** (QR Code / link) → menos ligação
   perguntando "meu celular ficou pronto?".
2. **Orçamento aprovado pelo link, com opções** (tela original ou paralela) →
   menos vai-e-volta no WhatsApp e registro da escolha do cliente.
3. **Fotos de entrada + checklist na OS** → proteção na hora da entrega
   ("esse risco já estava aí").
4. **Estoque que baixa sozinho** na venda e na OS + alerta de mínimo.
5. **Preço claro e baixo**: R$ 40/mês, 7 dias grátis sem cartão.

## 2. Público-alvo

| Perfil | Dor principal | Mensagem que mais conversa |
|---|---|---|
| **Dono-técnico** (trabalha sozinho ou com 1 ajudante) | Perde tempo respondendo cliente e anotando OS | "Cliente acompanha pelo link, você foca na bancada" |
| **Assistência com balcão + acessórios** | Estoque some, caixa não fecha | "Venda baixa o estoque e entra no caixa" |
| **Loja que compra e vende seminovos** | Não sabe o custo real do aparelho | "Compra, conserto e venda do seminovo no mesmo lugar" |
| **MEI** | Declaração anual e controle de receita | "Receita separada em comércio e serviços para o MEI" |

Onde estão: Instagram e TikTok (conteúdo de bancada, consertos), grupos de
Facebook e WhatsApp de técnicos, YouTube (tutoriais), Google (busca por
"sistema para assistência técnica").

**Objeções esperadas e respostas verdadeiras**

- *"É caro?"* → R$ 40/mês; 7 dias grátis sem cartão.
- *"É difícil de usar / não tenho tempo pra configurar"* → cadastro com 5
  campos e configuração inicial guiada (logo, dados, garantia, modelo do PDF).
- *"Funciona no celular?"* → funciona no navegador do celular, tablet e
  computador; app instalável.
- *"E se eu tiver tudo em planilha?"* → há importação de planilhas.

## 3. Estratégia para conquistar assinantes

Funil: **ver conteúdo → visitar o site → criar conta (teste de 7 dias) →
configurar → usar a primeira OS → assinar**.

### Fase A — gratuita (prioridade, semanas 1–4)

1. **Conteúdo orgânico de "dor da bancada"** no Instagram/Facebook/TikTok: 4
   publicações por semana, Reels/TikToks curtos mostrando a tela real.
2. **WhatsApp sem massa**: Status 3x por semana + respostas individuais para
   quem pergunta. Nada de lista de transmissão para quem não pediu.
3. **Google**: cadastro no Search Console (gratuito) e, se você decidir ter,
   Perfil da Empresa no Google com post semanal.
4. **Acompanhamento individual dos testes**: quem criou conta e está perto de
   acabar os 7 dias recebe **uma** mensagem individual oferecendo ajuda
   (roteiro WA-03; cada envio precisa da sua autorização).
5. **Indicação**: o sistema já tem programa de indicação (`?ref=`); divulgar
   para quem já assina, sem prometer valores não cadastrados.
6. **Coletar depoimentos reais** dos assinantes, com autorização escrita.

### Fase B — paga (só com autorização de orçamento, semana 3 em diante)

- Google Ads (pesquisa) com palavras de alta intenção — rascunho em
  `conteudos/GO-02`.
- Meta Ads (Instagram/Facebook) reaproveitando o Reel que tiver melhor
  resultado orgânico — rascunho em `conteudos/MA-01`.
- Começar pequeno, medir custo por cadastro e por assinatura antes de ampliar.

### Melhorias no site que aumentam a conversão (fora desta pasta — exigem sua autorização e deploy)

Do diagnóstico: imagem de compartilhamento (og:image) para os links não
aparecerem sem foto no WhatsApp/Instagram, sitemap, canonical, nome padronizado,
links de Termos/Privacidade no rodapé, botão de contato, legenda "valores
ilustrativos" e registro da origem (UTM) no cadastro. **Até isso ser feito, os
links com UTM não são registrados pelo site** — ver `resultados.md`.

## 4. Links com identificação de campanha (UTM)

Formato:

```
https://srmpretech.online/?utm_source=<origem>&utm_medium=<meio>&utm_campaign=<campanha>&utm_content=<id-do-conteúdo>
```

| Campo | Valores |
|---|---|
| `utm_source` | `instagram`, `facebook`, `tiktok`, `google`, `whatsapp` |
| `utm_medium` | `organico`, `bio`, `status`, `mensagem`, `post-perfil`, `cpc` (pago) |
| `utm_campaign` | `lancamento-nov26` (primeiros 30 dias) |
| `utm_content` | ID do conteúdo em minúsculas (ex.: `ig-01`) |

- Instagram e TikTok não deixam link clicável na legenda: usar o **link da
  bio** com `utm_medium=bio` e dizer "link na bio".
- Para quem já está decidido (conversa no WhatsApp), o link pode ir direto
  para `/cadastro`.

## 5. Tom de voz

Direto, de técnico para técnico, sem exagero. Mostrar a tela real. Falar de
situações da bancada ("cliente ligando", "peça que sumiu", "caixa que não
fecha"). Evitar jargão de software e promessas de resultado.

## 6. Metas da primeira versão (para medir, não para divulgar)

Definir com você depois da primeira semana de dados, a partir da linha de base
registrada em `resultados.md` (visitas, cadastros, assinaturas).
