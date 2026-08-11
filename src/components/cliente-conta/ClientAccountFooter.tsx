import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import type { MinhaLoja } from "./types";

export function ClientAccountFooter({ loja }: { loja: MinhaLoja | null }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Nossa Loja
          </h4>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li className="font-semibold text-slate-900">{loja?.loja || "SPACE TECH"}</li>
            <li>Assistência técnica</li>
            <li>Celulares e acessórios</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Contato e Redes Sociais
          </h4>
          <ul className="space-y-2 text-sm text-slate-600">
            {loja?.whatsapp && (
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-slate-400" /> {loja.whatsapp}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-slate-400" /> @spacetech
            </li>
            {loja?.endereco && (
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" /> {loja.endereco}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> contato@spacetech.app
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Plataforma
          </h4>
          <p className="text-sm text-slate-600">
            Plataforma desenvolvida para gerenciamento e atendimento Space Tech.
          </p>
        </div>
      </div>
    </footer>
  );
}
