-- Horário de funcionamento da loja (Configurações → Empresa), no mesmo
-- formato do horário do robô do WhatsApp: 7 posições (0 = domingo),
-- {abre, fecha} ou null (fechado). null na coluna = não informado.
-- Sai nos comprovantes e PDFs. Aditivo.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS horario_funcionamento JSONB;

-- Quem já configurou o robô do WhatsApp começa com o mesmo horário.
UPDATE public.profiles p
   SET horario_funcionamento = w.robo_horario
  FROM public.whatsapp_config w
 WHERE w.user_id = p.id
   AND w.robo_ativo
   AND p.horario_funcionamento IS NULL;

NOTIFY pgrst, 'reload schema';
