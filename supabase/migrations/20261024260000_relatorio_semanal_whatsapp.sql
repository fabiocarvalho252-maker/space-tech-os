-- Resumo semanal da loja no WhatsApp do dono (Configurações > WhatsApp).
-- Só números do banco, sem IA. Desligado por padrão.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_relatorio_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_numero TEXT;

-- Números da semana [p_inicio, p_fim) de uma empresa. Chamado só pelo
-- servidor (service role) — não fica exposto aos usuários.
CREATE OR REPLACE FUNCTION public.relatorio_semanal_dados(
  p_empresa_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'os_abertas', (
      SELECT count(*) FROM ordens_servico
      WHERE user_id = p_empresa_id AND created_at >= p_inicio AND created_at < p_fim),
    'os_entregues', (
      SELECT count(*) FROM ordens_servico
      WHERE user_id = p_empresa_id AND data_entrega >= p_inicio AND data_entrega < p_fim),
    'os_em_andamento', (
      SELECT count(*) FROM ordens_servico
      WHERE user_id = p_empresa_id
        AND status NOT IN ('entregue', 'faturado', 'cancelado', 'reprovado')),
    'os_prontas', (
      SELECT count(*) FROM ordens_servico
      WHERE user_id = p_empresa_id AND status = 'pronto'),
    'faturamento_os', (
      SELECT coalesce(sum(valor_total), 0) FROM os_faturamentos
      WHERE user_id = p_empresa_id AND status = 'faturado'
        AND created_at >= p_inicio AND created_at < p_fim),
    'vendas_qtd', (
      SELECT count(*) FROM vendas
      WHERE user_id = p_empresa_id AND status IN ('finalizado', 'faturado')
        AND created_at >= p_inicio AND created_at < p_fim),
    'vendas_total', (
      SELECT coalesce(sum(total), 0) FROM vendas
      WHERE user_id = p_empresa_id AND status IN ('finalizado', 'faturado')
        AND created_at >= p_inicio AND created_at < p_fim),
    'receitas', (
      SELECT coalesce(sum(valor), 0) FROM lancamentos
      WHERE user_id = p_empresa_id AND tipo = 'entrada' AND status = 'pago'
        AND created_at >= p_inicio AND created_at < p_fim),
    'despesas', (
      SELECT coalesce(sum(valor), 0) FROM lancamentos
      WHERE user_id = p_empresa_id AND tipo = 'saida' AND status = 'pago'
        AND created_at >= p_inicio AND created_at < p_fim),
    'a_receber_vencido', (
      SELECT coalesce(sum(valor), 0) FROM lancamentos
      WHERE user_id = p_empresa_id AND tipo = 'entrada' AND status = 'pendente'
        AND vencimento < (p_fim AT TIME ZONE 'America/Sao_Paulo')::date),
    'clientes_novos', (
      SELECT count(*) FROM clientes
      WHERE user_id = p_empresa_id AND created_at >= p_inicio AND created_at < p_fim),
    'estoque_baixo', (
      SELECT count(*) FROM produtos
      WHERE user_id = p_empresa_id AND coalesce(estoque_minimo, 0) > 0
        AND quantidade <= estoque_minimo)
  );
$$;

REVOKE ALL ON FUNCTION public.relatorio_semanal_dados(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_semanal_dados(uuid, timestamptz, timestamptz)
  TO service_role;

-- Um resumo por semana (template_id = 'relatorio_semanal_<segunda-feira>').
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_relatorio_semanal_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'relatorio\_semanal\_%';

NOTIFY pgrst, 'reload schema';
