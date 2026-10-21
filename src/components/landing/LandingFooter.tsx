import { Link } from "@tanstack/react-router";
import { MonitorDown } from "lucide-react";
import { LandingLogo } from "./LandingLogo";
import { LinkCadastro } from "./LinkCadastro";
import { APP_DESKTOP_WINDOWS_URL } from "@/lib/download-app";

const link =
  "rounded text-sm text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <LandingLogo />
          <p className="mt-3 max-w-xs text-sm text-zinc-500">
            Sistema de gestão para assistência técnica.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            <li>
              <a href="#inicio" className={link}>
                Início
              </a>
            </li>
            <li>
              <a href="#recursos" className={link}>
                Recursos
              </a>
            </li>
            <li>
              <a href="#planos" className={link}>
                Planos
              </a>
            </li>
            <li>
              <Link to="/login" className={link}>
                Entrar
              </Link>
            </li>
            <li>
              <LinkCadastro className={link}>Criar conta</LinkCadastro>
            </li>
            <li>
              <a
                href={APP_DESKTOP_WINDOWS_URL}
                className={`inline-flex items-center gap-1.5 ${link}`}
              >
                <MonitorDown className="h-3.5 w-3.5" aria-hidden="true" />
                Baixar para Windows
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/5 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} SPACE TECH OS. Todos os direitos reservados.
      </div>
    </footer>
  );
}
