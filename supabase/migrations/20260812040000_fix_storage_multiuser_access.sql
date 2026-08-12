-- The os-fotos and seminovos-fotos storage policies scoped access to
-- "storage.foldername(name)[1] = auth.uid()" — i.e. you can only read/write
-- inside a folder named after your own login. That works for a solo owner
-- (whose own uid is also the empresa_id every other table uses), but this
-- app supports inviting técnico/atendente/financeiro staff under
-- user_empresas, each with their own distinct auth.uid() — and every upload
-- path in the app is built as `${empresaId}/...`, not the uploader's own
-- id. A técnico uploading an OS photo would write it under the empresa's
-- folder, which the "= auth.uid()" check then blocks even for the técnico
-- who just uploaded it, and the empresa owner could never see it either.
--
-- Replaced with the same has_permission() check every other per-empresa
-- table in this app already uses, keyed off the folder prefix (the empresa
-- id every upload path already puts there) instead of the caller's own id.
DROP POLICY IF EXISTS "os fotos select own" ON storage.objects;
DROP POLICY IF EXISTS "os fotos insert own" ON storage.objects;
DROP POLICY IF EXISTS "os fotos delete own" ON storage.objects;

CREATE POLICY "os fotos ver" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'os-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'ordens', 'ver')
  );
CREATE POLICY "os fotos gravar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'ordens', 'gerenciar')
  );
CREATE POLICY "os fotos excluir" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'ordens', 'gerenciar')
  );

DROP POLICY IF EXISTS "seminovos fotos select own" ON storage.objects;
DROP POLICY IF EXISTS "seminovos fotos insert own" ON storage.objects;
DROP POLICY IF EXISTS "seminovos fotos delete own" ON storage.objects;

CREATE POLICY "seminovos fotos ver" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'seminovos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'seminovos', 'ver')
  );
CREATE POLICY "seminovos fotos gravar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seminovos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'seminovos', 'gerenciar')
  );
CREATE POLICY "seminovos fotos excluir" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seminovos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'seminovos', 'gerenciar')
  );
