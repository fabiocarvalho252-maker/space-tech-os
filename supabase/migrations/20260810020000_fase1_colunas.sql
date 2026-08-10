-- Fase 1 da padronização de módulos: três colunas que o redesenho das telas
-- realmente precisa persistir (não apenas exibir), sem as quais as
-- funcionalidades pedidas não têm como ser reais em vez de decorativas.

-- Serviços (produtos.categoria = 'Serviço') ganham comissão e descrição —
-- nenhuma das duas existia antes; sem elas o card "Comissão deste serviço"
-- e a Descrição do cadastro de serviço não teriam onde persistir.
ALTER TABLE public.produtos ADD COLUMN comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (comissao_percentual >= 0 AND comissao_percentual <= 100);
ALTER TABLE public.produtos ADD COLUMN descricao TEXT;

-- termos_garantia hoje só suporta hard delete (garantia.tsx's remover
-- mutation calls .delete() directly). "Desativar" em vez de excluir
-- fisicamente exige um estado para desativar *para*.
ALTER TABLE public.termos_garantia ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;
