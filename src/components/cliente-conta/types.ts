// Shared types for the Área do Cliente (src/routes/minha-conta.tsx and
// src/components/cliente-conta/*). All read directly off real tables via
// RLS-scoped supabase-js queries — see the "cliente ve proprias" policies
// added in supabase/migrations/20260810110000_area_do_cliente.sql.

export type MeuCliente = {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  endereco: string | null;
};

export type MinhaLoja = {
  id: string;
  loja: string | null;
  whatsapp: string | null;
  endereco: string | null;
  logo_url: string | null;
};

export type MinhaVenda = {
  id: string;
  numero: number;
  created_at: string;
  total: number;
  status: string;
  origem: "loja" | "online";
  itens: { descricao: string; quantidade: number }[];
};

export type MinhaOs = {
  id: string;
  numero: number;
  aparelho: string;
  marca: string | null;
  modelo: string | null;
  status: string;
  valor: number;
  desconto: number;
  valor_pago: number;
  status_pagamento: string;
  responsavel: string | null;
  defeito: string | null;
  diagnostico: string | null;
  laudo_tecnico: string | null;
  imei: string | null;
  cor: string | null;
  previsao: string | null;
  created_at: string;
  updated_at: string;
};

export type MinhaOsFoto = {
  id: string;
  url: string;
  category: string | null;
  created_at: string;
};
