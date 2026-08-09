import nodemailer from "nodemailer";

/**
 * SMTP email service. Server-only — never import this from a route
 * component or anything bundled to the client (nodemailer needs Node's
 * `net`/`tls`, which don't exist in the browser). Import it only from
 * server functions (see src/lib/*.functions.ts) or src/server.ts.
 *
 * Credentials come exclusively from environment variables and are never
 * hardcoded, logged, or returned to a caller. Until SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASSWORD and SMTP_FROM are all set, every function here
 * returns a clear "SMTP não configurado." result instead of throwing.
 */

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export type EnviarEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export type EmailResultado = { ok: true; messageId: string } | { ok: false; erro: string };

export type SmtpTestResultado = { ok: true } | { ok: false; erro: string };

function lerConfigSmtp(): SmtpConfig | null {
  const host = process.env["SMTP_HOST"];
  const portStr = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const password = process.env["SMTP_PASSWORD"];
  const from = process.env["SMTP_FROM"];

  if (!host || !portStr || !user || !password || !from) return null;

  const port = Number(portStr);
  if (!Number.isFinite(port) || port <= 0) return null;

  return { host, port, user, password, from };
}

/** Whether SMTP is fully configured — safe to call to gate UI/logic without attempting a send. */
export function smtpConfigurado(): boolean {
  return lerConfigSmtp() !== null;
}

let transporterCache: nodemailer.Transporter | null = null;
let transporterCacheKey = "";

function obterTransporter(config: SmtpConfig): nodemailer.Transporter {
  const chave = `${config.host}:${config.port}:${config.user}`;
  if (transporterCache && transporterCacheKey === chave) return transporterCache;

  transporterCache = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
  transporterCacheKey = chave;
  return transporterCache;
}

/** Sends an email through the configured SMTP server. Never throws — check `.ok`. */
export async function enviarEmail(input: EnviarEmailInput): Promise<EmailResultado> {
  const config = lerConfigSmtp();
  if (!config) return { ok: false, erro: "SMTP não configurado." };

  try {
    const transporter = obterTransporter(config);
    const info = await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (erro) {
    console.error("Falha ao enviar e-mail via SMTP:", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível enviar o e-mail no momento." };
  }
}

/**
 * Verifies the configured SMTP connection without sending anything.
 * Intended for manual/internal checks only (e.g. a one-off script run by
 * whoever manages the server) — do not wrap this in an HTTP-reachable route.
 */
export async function testarConexaoSmtp(): Promise<SmtpTestResultado> {
  const config = lerConfigSmtp();
  if (!config) return { ok: false, erro: "SMTP não configurado." };

  try {
    const transporter = obterTransporter(config);
    await transporter.verify();
    return { ok: true };
  } catch (erro) {
    console.error("Falha ao verificar conexão SMTP:", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível conectar ao servidor SMTP." };
  }
}
