// Shared "Verifique seu WhatsApp" OTP form — used both right after signup
// (/cadastro) and when a still-PENDING empresa tries to log in (/, painel
// empresa), so the resend/cooldown/attempt-limit logic only lives in one
// place. The caller owns whatever session is authenticating the underlying
// enviarCodigoAtivacao/verificarCodigoAtivacao calls and decides what
// happens once onAtivado fires (sign out + show success, sign out + redirect
// to dashboard-eligible login, etc).
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  enviarCodigoAtivacao,
  verificarCodigoAtivacao,
} from "@/lib/auth/ativacao-whatsapp.functions";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

function mensagemErroAmigavel(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : "";
  return texto || "Não foi possível concluir a operação.";
}

export function VerificacaoWhatsappForm({
  whatsappMascarado,
  cooldownInicial,
  onAtivado,
}: {
  whatsappMascarado: string;
  cooldownInicial: number;
  onAtivado: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState("");
  const [cooldown, setCooldown] = useState(cooldownInicial);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function reenviar() {
    setReenviando(true);
    setErro("");
    try {
      const resultado = await enviarCodigoAtivacao();
      setCooldown(resultado.cooldownSegundos);
      if (resultado.enviado) toast.success("Novo código enviado pelo WhatsApp!");
    } catch (e) {
      toast.error(mensagemErroAmigavel(e));
    } finally {
      setReenviando(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) return;
    setVerificando(true);
    setErro("");
    try {
      await verificarCodigoAtivacao({ data: { code: codigo } });
      onAtivado();
    } catch (e) {
      setErro(mensagemErroAmigavel(e));
      setCodigo("");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div>
      <p className="text-center text-sm text-muted-foreground">
        Enviamos um código de 6 dígitos para o WhatsApp <strong>{whatsappMascarado}</strong>.
      </p>
      <form onSubmit={confirmar} className="mt-5 space-y-5">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={codigo} onChange={setCodigo}>
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {erro && <p className="text-center text-sm text-destructive">{erro}</p>}
        <button
          type="submit"
          disabled={verificando || codigo.length !== 6}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
        >
          {verificando ? "Confirmando..." : "Confirmar e ativar conta"}
          <MessageCircle className="h-4 w-4" />
        </button>
        <p className="text-center text-sm text-muted-foreground">
          Não recebeu o código?{" "}
          {cooldown > 0 ? (
            <span>Reenviar código em {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={reenviar}
              disabled={reenviando}
              className="font-semibold text-primary underline disabled:opacity-60"
            >
              {reenviando ? "Enviando..." : "Reenviar código"}
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
