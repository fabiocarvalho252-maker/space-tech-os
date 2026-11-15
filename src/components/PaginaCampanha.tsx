import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogoMark, LogoWord } from "@/components/Logo";
import { BotaoWhatsappFlutuante } from "@/components/BotaoWhatsappFlutuante";

// Layout das páginas públicas de recurso (como funciona, relatório MEI, vitrine).
// Cada página passa título, texto e conteúdo; o CTA de teste e de planos fica igual.
export function PaginaCampanha({
  titulo,
  subtitulo,
  children,
  ilustrativo = false,
}: {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  ilustrativo?: boolean;
}) {
  return (
    <div className="min-h-screen bg-gradient-auth px-5 py-12">
      <BotaoWhatsappFlutuante />
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <LogoMark className="h-14 w-14" />
        <LogoWord className="mt-3 text-lg" />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{subtitulo}</p>
        {ilustrativo && <p className="mt-2 text-xs text-muted-foreground">Dados ilustrativos.</p>}
      </div>
      <div className="mx-auto mt-8 max-w-3xl">{children}</div>
      <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/cadastro"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground sm:w-auto"
        >
          Testar grátis por 7 dias
        </Link>
        <Link
          to="/planos"
          className="flex h-12 w-full items-center justify-center rounded-xl border border-border px-6 text-sm font-semibold sm:w-auto"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}
