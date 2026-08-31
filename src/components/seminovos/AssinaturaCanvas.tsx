// Área de assinatura digital — pedido do usuário (seções 3/4), mesma
// receita de captura do AssinaturaDigitalModal.tsx (canvas + pointer events,
// sem lib externa), só que exposta como componente de UI puro via ref (sem
// upload próprio): quem usa decide quando e onde enviar o traço, porque o
// fluxo de compra (seção 5/6) precisa manter a assinatura em memória até a
// tela de conferência, enquanto "substituir assinatura" de um aparelho já
// salvo pode subir na hora. `touch-none` no canvas é o que impede o dedo de
// rolar a página enquanto a pessoa assina (pedido, seção 4).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AssinaturaCanvasHandle = {
  limpar: () => void;
  temTraco: () => boolean;
  obterBlob: () => Promise<Blob | null>;
};

export const AssinaturaCanvas = forwardRef<AssinaturaCanvasHandle, { className?: string }>(
  function AssinaturaCanvas({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const desenhando = useRef(false);
    const [temTraco, setTemTraco] = useState(false);

    function limpar() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTemTraco(false);
    }

    useImperativeHandle(ref, () => ({
      limpar,
      temTraco: () => temTraco,
      obterBlob: () =>
        new Promise((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas || !temTraco) {
            resolve(null);
            return;
          }
          canvas.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Canvas interno em resolução maior que o CSS (traço nítido em telas
      // de alta densidade) — posicaoNoCanvas() já compensa a diferença de
      // escala entre pixels do canvas e pixels exibidos.
      canvas.width = 900;
      canvas.height = 260;
    }, []);

    function posicaoNoCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const escalaX = canvas.width / rect.width;
      const escalaY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * escalaX, y: (e.clientY - rect.top) * escalaY };
    }

    function iniciarTraco(e: React.PointerEvent<HTMLCanvasElement>) {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      desenhando.current = true;
      const { x, y } = posicaoNoCanvas(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function continuarTraco(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!desenhando.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = posicaoNoCanvas(e);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
      ctx.lineTo(x, y);
      ctx.stroke();
      setTemTraco(true);
    }

    function finalizarTraco() {
      desenhando.current = false;
    }

    return (
      <div className={className}>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="h-56 w-full touch-none rounded-2xl border-2 border-dashed border-border bg-white sm:h-64"
            onPointerDown={iniciarTraco}
            onPointerMove={continuarTraco}
            onPointerUp={finalizarTraco}
            onPointerLeave={finalizarTraco}
          />
          {!temTraco && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              ✍️ Assine aqui
            </p>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2"
            onClick={limpar}
            disabled={!temTraco}
          >
            <Eraser className="h-4 w-4" /> Limpar assinatura
          </Button>
        </div>
      </div>
    );
  },
);
