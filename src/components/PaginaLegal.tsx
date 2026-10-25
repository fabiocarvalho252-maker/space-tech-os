import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LogoMark, LogoWord } from "@/components/Logo";

export const CONTATO_WHATSAPP = "(74) 99929-4500";
export const CONTATO_WHATSAPP_LINK = "https://wa.me/5574999294500";

// Moldura das páginas públicas /privacidade e /termos (também exigidas pelo
// Google para publicar o app OAuth do backup no Google Drive).
export function PaginaLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <LogoWord />
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em {atualizadoEm}</p>
        <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:space-y-1 [&_ul]:text-muted-foreground">
          {children}
        </div>
      </main>
    </div>
  );
}
