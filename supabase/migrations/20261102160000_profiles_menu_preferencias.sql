-- Ordem do menu lateral escolhida pelo usuário (Configurações → Menu).
-- { "modo": "auto" | "manual", "ordem": ["/ordens", "/pdv", ...] }
alter table public.profiles add column if not exists menu_preferencias jsonb;
