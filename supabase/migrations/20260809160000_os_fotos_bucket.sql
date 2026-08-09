-- The RLS policies for this bucket already exist (see
-- 20260808015726_...sql), but no migration ever created the bucket itself —
-- OS photo upload was silently broken on any fresh deploy.
INSERT INTO storage.buckets (id, name, public)
SELECT 'os-fotos', 'os-fotos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'os-fotos');
