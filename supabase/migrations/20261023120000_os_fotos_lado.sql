-- Marca qual foto da OS é a frente e qual é a traseira do aparelho (usadas
-- no cartão 3D giratório da OS). Independe da categoria (entrada/durante/
-- saída): uma foto de entrada pode ser também a "frente". No máximo uma
-- frente e uma traseira por OS.
ALTER TABLE public.service_order_photos
  ADD COLUMN lado TEXT CHECK (lado IN ('frente', 'traseira'));

CREATE UNIQUE INDEX IF NOT EXISTS service_order_photos_lado_unico
  ON public.service_order_photos (service_order_id, lado)
  WHERE lado IS NOT NULL;

NOTIFY pgrst, 'reload schema';
