-- Imagem do produto: URL pública no bucket "produtos-imagens".
-- Pasta = empresa_id (primeiro segmento do path), igual aos outros buckets;
-- leitura pública (a imagem aparece na lista, no PDV etc.), gravação só para
-- quem pode gerenciar produtos daquela empresa.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

INSERT INTO storage.buckets (id, name, public)
SELECT 'produtos-imagens', 'produtos-imagens', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'produtos-imagens');

DROP POLICY IF EXISTS "produtos imagens gravar" ON storage.objects;
CREATE POLICY "produtos imagens gravar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'produtos-imagens'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'produtos', 'gerenciar')
  );
DROP POLICY IF EXISTS "produtos imagens excluir" ON storage.objects;
CREATE POLICY "produtos imagens excluir" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'produtos-imagens'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'produtos', 'gerenciar')
  );
