CREATE TABLE public.peliculas_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  codigo TEXT,
  pelicula_compativel TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peliculas_catalogo TO authenticated;
GRANT ALL ON public.peliculas_catalogo TO service_role;
ALTER TABLE public.peliculas_catalogo ENABLE ROW LEVEL SECURITY;

-- Same permission-matrix pattern as every other business table (see the
-- 20260809110200 RLS rewrite): gated under the "produtos" module, since a
-- película catalog is fundamentally stock/catalog data.
CREATE POLICY "peliculas_catalogo ver" ON public.peliculas_catalogo FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'produtos', 'ver'));
CREATE POLICY "peliculas_catalogo gerenciar" ON public.peliculas_catalogo FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'produtos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'produtos', 'gerenciar'));

CREATE TRIGGER peliculas_catalogo_updated BEFORE UPDATE ON public.peliculas_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
