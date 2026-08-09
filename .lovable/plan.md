# Impressão da OS no estilo Nota Fiscal

Refazer o layout de impressão da Ordem de Serviço para o formato de documento fiscal, seguindo a estrutura enviada.

## Estrutura do documento

```text
[LOGO/EMPRESA]            (74) 99929-4500 · email · Resp.: <responsável>
ORDEM DE SERVIÇO #0001                     Emissão: 08/08/2026 01:18
------------------------------------------------------------------
STATUS | DATA INICIAL | DATA FINAL | GARANTIA 90 dia(s) | VENC. GARANTIA
------------------------------------------------------------------
DADOS DO CLIENTE   nome · CPF/CNPJ · TELEFONE · E-MAIL · ENDEREÇO
APARELHO           TIPO · MARCA · MODELO · SENHA DO APARELHO (PIN/padrão)
DEFEITO APRESENTADO
FOTOS DA OS (n)    miniaturas com data e hora
PRODUTOS E SERVIÇOS
  DESCRIÇÃO | QTD | UNIT. | SUBTOTAL
  Total / Subtotal / Desconto / Total final
------------------------------------------------------------------
Rodapé: Empresa · Ref: OS #0001 · Gerado em ... · Página X de Y
QR Code: "Acesse sua Área do Cliente" + instrução de leitura
```

## O que muda

- Cabeçalho fiscal com dados da empresa (loja, telefone, e-mail, responsável), número da OS em destaque e data/hora de emissão.
- Faixa de metadados em colunas: status, data inicial, data final, garantia em dias e vencimento da garantia (data de conclusão + dias de garantia).
- Blocos com títulos em caixa alta e linhas divisórias, no lugar da tabela genérica atual.
- Seção de fotos com data/hora de cada imagem (mantendo a configuração "exibir fotos na impressão").
- Tabela de produtos e serviços a partir dos itens da OS, com quantidade, valor unitário e subtotal; totais com subtotal, desconto e total final.
- Rodapé com referência da OS, data de geração e paginação; QR Code com o texto "Acesse sua Área do Cliente" e instrução de leitura.
- Mantidos: impressão em 2 vias, termos de garantia e condições, assinaturas, conforme configurações já existentes.

## Detalhes técnicos

- Alteração concentrada na função `imprimir` em `src/routes/_authenticated/ordens.tsx` (HTML + CSS de impressão).
- Buscar também `os_itens` da OS para montar a tabela de produtos/serviços, e os campos `desconto`, `valor_pago`, `imei`, `serial_number`, `cor` já existentes.
- Endereço/CPF do cliente vindos de `clientes`; dados da empresa de `profiles` / configurações "Minha Empresa".
- Garantia: dias vindos da configuração de OS (`os_config`), vencimento calculado a partir da data final.
- CSS dedicado para A4 (`@page`), fontes menores, bordas finas e paginação via contador CSS.

## Formatos de impressão

- **A4**: layout completo descrito acima, em 2 vias quando configurado.
- **Cupom térmico 80 mm**: mesma informação em coluna única, `@page { width: 80mm }`, fonte monoespaçada reduzida, sem bordas de tabela, itens em linhas compactas (descrição / qtd x unit. / subtotal), QR Code ao final.
- Seletor de formato no momento de imprimir (A4 ou 80 mm), com A4 como padrão.
