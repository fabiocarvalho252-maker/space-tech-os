-- Retorno em garantia: OS nova ligada à OS original (os_origem_id). Base do
-- selo na lista e da taxa de retorno por técnico em Relatórios.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS os_origem_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ordens_servico_os_origem_idx
  ON public.ordens_servico (os_origem_id) WHERE os_origem_id IS NOT NULL;
