import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";

// Evento do Chrome/Edge/Samsung Internet que permite abrir o pedido de
// instalação do app (PWA) a partir de um botão nosso.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptGuardado: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptGuardado = e as BeforeInstallPromptEvent;
  });
}

function jaInstalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Botão "Instalar app no celular" do menu lateral do celular. Some quando o
// sistema já está aberto como app instalado.
export function InstalarAppMobile({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(!jaInstalado());
    const instalado = () => setVisivel(false);
    window.addEventListener("appinstalled", instalado);
    return () => window.removeEventListener("appinstalled", instalado);
  }, []);

  if (!visivel) return null;

  async function instalar() {
    onDone?.();
    if (promptGuardado) {
      await promptGuardado.prompt();
      const { outcome } = await promptGuardado.userChoice;
      promptGuardado = null;
      if (outcome === "accepted") setVisivel(false);
      return;
    }
    if (ehIOS()) {
      toast.info("Instalar no iPhone", {
        description:
          "No Safari, toque em Compartilhar (quadrado com seta) e depois em “Adicionar à Tela de Início”.",
        duration: 10000,
      });
      return;
    }
    toast.info("Instalar o app", {
      description:
        "Abra o menu do navegador (⋮) e toque em “Instalar app” ou “Adicionar à tela inicial”.",
      duration: 10000,
    });
  }

  return (
    <button onClick={instalar} className={className}>
      <Smartphone className="h-5 w-5" /> Instalar app no celular
    </button>
  );
}
