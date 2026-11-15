import { CONTATO_WHATSAPP_LINK } from "@/components/PaginaLegal";

// Botão fixo de WhatsApp para as páginas públicas (planos, cadastro e campanha).
export function BotaoWhatsappFlutuante() {
  return (
    <a
      href={`${CONTATO_WHATSAPP_LINK}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre o SPACE TECH OS.")}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a loja pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-panel transition hover:opacity-90"
    >
      WhatsApp
    </a>
  );
}
