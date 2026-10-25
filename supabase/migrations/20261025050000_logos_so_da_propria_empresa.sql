-- Bucket público "logos": qualquer usuário logado podia subir, trocar ou
-- apagar a logo de QUALQUER empresa. Agora só a própria empresa mexe nos
-- arquivos dela. O caminho é "logos/<empresa_id>-<timestamp>.<ext>"
-- (src/lib/logo-empresa.ts) e quem grava profiles.logo_url é só a conta da
-- empresa (policy de profiles: auth.uid() = id), então a regra é a mesma.
-- Ver continua público (a logo aparece em PDFs, consulta de OS e landing).
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

CREATE POLICY "logos gravar da propria empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND starts_with(name, 'logos/' || auth.uid()::text || '-'));

CREATE POLICY "logos alterar da propria empresa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND starts_with(name, 'logos/' || auth.uid()::text || '-'))
  WITH CHECK (bucket_id = 'logos' AND starts_with(name, 'logos/' || auth.uid()::text || '-'));

CREATE POLICY "logos excluir da propria empresa" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND starts_with(name, 'logos/' || auth.uid()::text || '-'));
