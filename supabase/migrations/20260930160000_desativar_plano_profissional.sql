-- Pedido do usuário: oferecer só o plano Básico (R$ 39,90). O Profissional
-- é só desativado (não apagado) — some da página /planos e o checkout
-- recusa planos inativos (PlanInactiveError); dá para reativar depois.
update public.plans set active = false where slug = 'profissional';
