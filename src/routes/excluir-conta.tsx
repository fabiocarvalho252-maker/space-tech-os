// Página pública de exclusão de conta (exigida pela Google Play): explica o
// que é apagado e, para quem está logado, já traz o formulário de exclusão.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTATO_WHATSAPP,
  CONTATO_WHATSAPP_LINK,
  PaginaLegal,
  RESPONSAVEL,
} from "@/components/PaginaLegal";
import { excluirMinhaContaFn } from "@/lib/excluir-conta.functions";

export const Route = createFileRoute("/excluir-conta")({
  head: () => ({
    meta: [{ title: "Excluir conta — SPACE TECH OS" }],
  }),
  component: ExcluirConta,
});

function ExcluirConta() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  return (
    <PaginaLegal titulo="Excluir conta" atualizadoEm="02/11/2026">
      <p>
        Você pode excluir sua conta do SPACE TECH OS a qualquer momento, pelo aplicativo ou pelo
        site, sem precisar falar com ninguém.
      </p>

      <h2>O que é apagado</h2>
      <ul>
        <li>
          <strong>Conta da empresa (dono):</strong> a conta e todos os dados da empresa — clientes,
          ordens de serviço, fotos, vendas, estoque, financeiro, mensagens — e os logins dos
          funcionários. A exclusão é imediata e não pode ser desfeita.
        </li>
        <li>
          <strong>Conta de funcionário:</strong> apenas o seu login. Os dados da empresa continuam
          com o dono.
        </li>
        <li>
          As cópias de segurança automáticas são descartadas em até 14 dias. Registros que a lei
          obriga guardar (ex.: comprovantes de pagamento do plano) podem ser mantidos pelo prazo
          legal.
        </li>
      </ul>

      <h2>Como excluir</h2>
      {email === undefined ? null : email ? (
        <FormularioExclusao email={email} />
      ) : (
        <ol>
          <li>
            <Link to="/login" className="text-primary underline">
              Entre na sua conta
            </Link>{" "}
            e volte a esta página (ou, no sistema, abra o menu da conta → “Excluir minha conta”).
          </li>
          <li>Confirme com sua senha e digite EXCLUIR.</li>
        </ol>
      )}
      <p>
        Não consegue entrar? Peça a exclusão a {RESPONSAVEL} pelo WhatsApp{" "}
        <a href={CONTATO_WHATSAPP_LINK} className="text-primary underline">
          {CONTATO_WHATSAPP}
        </a>{" "}
        informando o e-mail da conta. Atendemos em até 7 dias.
      </p>
    </PaginaLegal>
  );
}

function FormularioExclusao({ email }: { email: string }) {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    setExcluindo(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error("Senha incorreta.");
      const r = await excluirMinhaContaFn({ data: { confirmacao: "EXCLUIR" } });
      await supabase.auth.signOut().catch(() => undefined);
      try {
        localStorage.clear();
      } catch {
        /* ignora */
      }
      toast.success(
        r.tipo === "empresa" ? "Conta e dados da empresa excluídos." : "Seu login foi excluído.",
      );
      navigate({ to: "/login", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
      setExcluindo(false);
    }
  }

  return (
    <form
      onSubmit={excluir}
      className="not-prose space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5"
    >
      <p className="text-sm">
        Conta conectada: <strong>{email}</strong>
      </p>
      <label className="block space-y-1 text-sm font-semibold">
        Sua senha
        <input
          type="password"
          required
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-card px-3 font-normal outline-none focus:border-destructive"
        />
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        Digite EXCLUIR para confirmar
        <input
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoCapitalize="characters"
          className="h-11 w-full rounded-xl border border-input bg-card px-3 font-normal uppercase outline-none focus:border-destructive"
        />
      </label>
      <button
        type="submit"
        disabled={excluindo || confirmacao.trim().toUpperCase() !== "EXCLUIR" || !senha}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Excluir minha conta definitivamente
      </button>
    </form>
  );
}
