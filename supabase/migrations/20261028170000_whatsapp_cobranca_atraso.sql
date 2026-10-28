-- Aviso de cobrança atrasada pelo WhatsApp (Configurações → WhatsApp,
-- desligado por padrão): cobrança não paga com o vencimento passado recebe
-- aviso com 1, 7 e 15 dias de atraso, com um Pix novo. Tudo aditivo.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_cobranca_atraso_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_atraso_texto TEXT NOT NULL DEFAULT
    'Olá {{cliente}}! Consta em aberto na {{loja}} o pagamento de {{valor}}, com vencimento em {{vencimento}} ({{dias}} de atraso). Segue abaixo um Pix copia e cola atualizado. Se já pagou, desconsidere 🙂',
  ADD COLUMN IF NOT EXISTS notif_cobranca_atraso_desde TIMESTAMPTZ;

-- Ligar não dispara nada antigo: só cobranças que vencerem a partir do dia
-- em que a opção foi ligada.
CREATE OR REPLACE FUNCTION public.whatsapp_config_cobranca_atraso_desde()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.notif_cobranca_atraso_auto
     AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.notif_cobranca_atraso_auto, false)) THEN
    NEW.notif_cobranca_atraso_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_config_cobranca_atraso_desde ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_cobranca_atraso_desde
  BEFORE INSERT OR UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_cobranca_atraso_desde();

-- Mesmas chaves de AUTOMACOES em src/lib/whatsapp/automacoes.ts.
CREATE OR REPLACE FUNCTION public.whatsapp_automacao_chave(p_template TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_template IS NULL THEN NULL
    WHEN p_template = 'os_pronta' THEN 'os_pronta'
    WHEN p_template = 'pesquisa_auto' THEN 'pesquisa_auto'
    WHEN p_template LIKE 'pos\_venda\_%' THEN 'pos_venda'
    WHEN p_template LIKE 'boas\_vindas\_%' THEN 'boas_vindas'
    WHEN p_template LIKE 'aniversario\_%' THEN 'aniversario'
    WHEN p_template LIKE 'agradecimento\_%' THEN 'agradecimento'
    WHEN p_template LIKE 'cobranca\_lembrete\_%' OR p_template LIKE 'cobranca\_pix\_%' THEN 'cobranca_lembrete'
    WHEN p_template LIKE 'cobranca\_paga\_%' THEN 'cobranca_paga'
    WHEN p_template LIKE 'cobranca\_atraso\_%' OR p_template LIKE 'cobranca\_atrasopix\_%' THEN 'cobranca_atraso'
    ELSE NULL
  END
$$;

-- Cobranças vencidas de cada empresa (worker do WhatsApp).
CREATE INDEX IF NOT EXISTS cobrancas_user_status_venc_idx
  ON public.cobrancas (user_id, status, vencimento);

NOTIFY pgrst, 'reload schema';
