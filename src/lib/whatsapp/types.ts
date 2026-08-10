// Shared types for the Evolution API integration (src/lib/whatsapp/*).
// Server-only end to end — never imported from a route component; only from
// whatsapp.functions.ts (which is safe to import client-side, same as every
// other *.functions.ts in this project) or from other *.server.ts modules.

export type WhatsappConexaoStatus = "desconectado" | "conectando" | "conectado" | "erro";

export type WhatsappConexao = {
  id: string;
  user_id: string;
  instance_name: string;
  status: WhatsappConexaoStatus;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

// Mirrors what a jsonb column can actually hold — kept structural (not
// `Record<string, unknown>`) so createServerFn's serializability check can
// validate it recursively instead of rejecting `unknown`.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type WhatsappMensagemDirecao = "inbound" | "outbound";
export type WhatsappMensagemStatus = "pendente" | "enviado" | "falhou" | "recebido";

export type WhatsappMensagem = {
  id: string;
  user_id: string;
  connection_id: string | null;
  direction: WhatsappMensagemDirecao;
  phone_number: string;
  contact_name: string | null;
  content: string | null;
  status: WhatsappMensagemStatus;
  evolution_message_id: string | null;
  metadata: JsonValue | null;
  created_at: string;
};
