import { useEffect, useState } from "react";

// "Estou dentro do aplicativo?" — app Android (TWA, aberto com ?app=1 ou
// com referrer android-app://) ou o site instalado na tela inicial
// (display-mode standalone). Uma vez detectado, fica lembrado no aparelho.
// No site aberto pelo navegador, tudo continua como antes.

const CHAVE = "modo-app";

export function ehAplicativo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(CHAVE) === "1") return true;
    const detectado =
      new URLSearchParams(window.location.search).get("app") === "1" ||
      document.referrer.startsWith("android-app://") ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (detectado) localStorage.setItem(CHAVE, "1");
    return !!detectado;
  } catch {
    return false;
  }
}

// "Lembrar meus dados" do login do app: e-mail guardado no aparelho e sessão
// mantida. Desmarcado, a sessão termina quando o app é fechado (a senha nunca
// é guardada pelo sistema — quem oferece isso é o gerenciador de senhas do
// Android, pelos campos com autocomplete).
const EMAIL = "login-email-lembrado";
const SAIR_AO_FECHAR = "login-sair-ao-fechar";
const SESSAO_ABERTA = "login-sessao-aberta";

export function emailLembrado(): string {
  try {
    return localStorage.getItem(EMAIL) ?? "";
  } catch {
    return "";
  }
}

export function guardarPreferenciaLogin(lembrar: boolean, email: string) {
  try {
    if (lembrar) {
      localStorage.setItem(EMAIL, email);
      localStorage.removeItem(SAIR_AO_FECHAR);
    } else {
      localStorage.removeItem(EMAIL);
      localStorage.setItem(SAIR_AO_FECHAR, "1");
    }
    sessionStorage.setItem(SESSAO_ABERTA, "1");
  } catch {
    /* sem storage: segue com a sessão padrão */
  }
}

/** true quando o app foi fechado e reaberto com "Lembrar" desmarcado. */
export function sessaoDeveEncerrar(): boolean {
  try {
    return (
      localStorage.getItem(SAIR_AO_FECHAR) === "1" && sessionStorage.getItem(SESSAO_ABERTA) !== "1"
    );
  } catch {
    return false;
  }
}

/** Versão React: false no servidor e no 1º render, para não dar diferença de hidratação. */
export function useAplicativo(): boolean {
  const [app, setApp] = useState(false);
  useEffect(() => setApp(ehAplicativo()), []);
  return app;
}
