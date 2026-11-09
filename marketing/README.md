# Marketing — SPACE TECH OS

Pasta **separada do ERP**. Nada aqui é lido pelo sistema, pelo build ou pelo
banco de dados: são só arquivos de texto (Markdown) para planejar, aprovar e
registrar a divulgação.

## Quem vê

Estes arquivos aparecem em **`/admin/marketing`**, visível **apenas para a conta
admin do Fabio** (a mesma regra de acesso único do `/admin`, conferida também no
servidor) — nunca para lojas, funcionários ou outros usuários. Lá dá para ler
tudo com prévias visuais e **aprovar ou recusar um conteúdo por vez** (bloco
"Sua decisão"); cada decisão fica em `registro-decisoes.md`.

## Estrutura

| Caminho | Para quê |
|---|---|
| `estrategia.md` | Posicionamento, público-alvo, mensagens e estratégia de assinantes |
| `calendario-30-dias.md` | O que publicar em cada dia, por plataforma |
| `fatos-verificados.md` | **Única fonte** de recursos, preço e condições que podem ser citados |
| `resultados.md` | Acompanhamento semanal de visitas, leads, testes e assinaturas |
| `conteudos/` | Rascunhos (status `RASCUNHO`) e o modelo de conteúdo |
| `aprovacao/` | Conteúdos prontos esperando a sua decisão (`AGUARDANDO APROVAÇÃO`) |
| `aprovados/` | Conteúdos que você aprovou, um por um (`APROVADO`) |
| `publicados/` | Conteúdos já publicados, com data e link do post (`PUBLICADO`) |
| `ferramentas/verificar.mjs` | Conferência automática dos arquivos (sem dependências) |

## Fluxo de aprovação (obrigatório)

```
conteudos/ (RASCUNHO) → aprovacao/ (AGUARDANDO APROVAÇÃO) → aprovados/ (APROVADO) → publicados/ (PUBLICADO)
```

1. Um conteúdo novo nasce em `conteudos/` como **RASCUNHO**.
2. Quando está pronto, vai para `aprovacao/` como **AGUARDANDO APROVAÇÃO**.
3. **Só o Fabio aprova** — em `/admin/marketing` (marcando as plataformas) ou dizendo ao Claude. A aprovação é **explícita e individual**: vale apenas
   para o arquivo aprovado, nunca para outros conteúdos, variações ou
   plataformas não citadas nele. Ao aprovar, o arquivo vai para `aprovados/`
   com status **APROVADO** e o bloco "Aprovação" preenchido (quem, quando).
4. Depois de publicado **por decisão sua**, o arquivo vai para `publicados/`
   com status **PUBLICADO**, data/hora e link do post.
5. Se o texto mudar depois de aprovado, ele **volta** para `aprovacao/`.

### O que nunca acontece sem autorização específica sua

- Publicar qualquer post, vídeo, story ou status.
- Enviar mensagem em massa (WhatsApp, e-mail, SMS) — inclusive pelo WhatsApp
  conectado ao sistema.
- Criar, ativar ou aumentar orçamento de campanha paga (Meta Ads, Google Ads,
  TikTok Ads).
- Conectar contas de redes sociais ou guardar tokens de acesso.

Conteúdos de anúncio pago ficam marcados com **"ANÚNCIO PAGO — exige
autorização de orçamento"**: aprovar o texto **não** autoriza gastar.

## Regras de conteúdo

- Usar só o que está em `fatos-verificados.md`. Não inventar recursos, preços,
  clientes, depoimentos, números ou resultados.
- Valores em telas de exemplo são **ilustrativos** e devem ser identificados
  assim na arte.
- Links sempre para `https://srmpretech.online` com identificação de campanha
  (UTM), conforme a tabela em `estrategia.md`.

## Conferência automática

```bash
node marketing/ferramentas/verificar.mjs                  # confere os conteúdos
node --test marketing/ferramentas/verificar.test.mjs     # testa a própria conferência
```

Confere em cada conteúdo: campos obrigatórios, status compatível com a pasta,
links do site com UTM, aprovação preenchida em `aprovados/`, link do post em
`publicados/`, e procura afirmações proibidas (preço diferente do cadastrado,
Nota Fiscal, Play Store, "nº 1", "garantido" etc.).
