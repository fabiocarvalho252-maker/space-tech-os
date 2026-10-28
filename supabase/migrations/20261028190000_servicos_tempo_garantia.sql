-- Serviços (produtos com categoria "Serviço"): tempo estimado de execução e
-- garantia própria. Garantia vazia = usa o prazo padrão de Configurações.
-- Ao lançar o serviço numa OS, o prazo de garantia da OS passa a ser o maior
-- entre os serviços dela (a tela ainda permite mudar à mão). Tudo aditivo.
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tempo_estimado_min INTEGER CHECK (tempo_estimado_min IS NULL OR tempo_estimado_min >= 0),
  ADD COLUMN IF NOT EXISTS garantia_dias INTEGER CHECK (garantia_dias IS NULL OR garantia_dias >= 0);

NOTIFY pgrst, 'reload schema';
