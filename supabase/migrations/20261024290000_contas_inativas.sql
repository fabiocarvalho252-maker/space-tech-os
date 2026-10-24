-- Contas inativas: 2 meses depois do fim do acesso (teste ou plano), a
-- empresa recebe no WhatsApp a pergunta se vai voltar; se 30 dias depois do
-- aviso ainda não assinou, a conta é apagada (src/lib/contas-inativas.server.ts,
-- disparado todo dia pelo cron /etc/cron.d/space-tech-contas-inativas).
-- Só vale o aviso enviado depois do vencimento atual: quem renovar e vencer
-- de novo recebe um aviso novo antes de qualquer exclusão.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aviso_inatividade_enviado_em TIMESTAMPTZ;
