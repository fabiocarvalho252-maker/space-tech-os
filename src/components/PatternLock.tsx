import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatternLockProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const GRID_SIZE = 3;
const DOT_RADIUS = 10;
const CANVAS_SIZE = 280;
const SPACING = CANVAS_SIZE / (GRID_SIZE + 1);

export function PatternLock({ value, onChange, className }: PatternLockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [path, setPath] = useState<number[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);

  // Parse initial value
  useEffect(() => {
    if (value && path.length === 0) {
      const initialPath = value.split("").map(Number).filter(n => !isNaN(n));
      if (initialPath.length > 0) setPath(initialPath);
    }
  }, [value]);

  const getDotPos = (index: number) => {
    const row = Math.floor((index - 1) / GRID_SIZE);
    const col = (index - 1) % GRID_SIZE;
    return {
      x: (col + 1) * SPACING,
      y: (row + 1) * SPACING,
    };
  };

  const getDotFromPos = (x: number, y: number) => {
    for (let i = 1; i <= GRID_SIZE * GRID_SIZE; i++) {
      const pos = getDotPos(i);
      const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (dist < DOT_RADIUS * 2) return i;
    }
    return null;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw lines
    if (path.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "hsl(var(--primary))";

      const startDot = path[0];
      if (startDot !== undefined) {
        const startPos = getDotPos(startDot);
        ctx.moveTo(startPos.x, startPos.y);

        for (let i = 1; i < path.length; i++) {
          const dot = path[i];
          if (dot !== undefined) {
            const pos = getDotPos(dot);
            ctx.lineTo(pos.x, pos.y);
          }
        }
      }


      if (isDrawing && currentMousePos) {
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
      }
      ctx.stroke();
    }

    // Draw dots
    for (let i = 1; i <= GRID_SIZE * GRID_SIZE; i++) {
      const pos = getDotPos(i);
      const isActive = path.includes(i);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)";
      ctx.fill();

      if (isActive) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, DOT_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "hsl(var(--primary) / 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [path, isDrawing, currentMousePos]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dot = getDotFromPos(x, y);
    if (dot) {
      setPath([dot]);
      setIsDrawing(true);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentMousePos({ x, y });
    const dot = getDotFromPos(x, y);
    if (dot && !path.includes(dot)) {
      const newPath = [...path, dot];
      setPath(newPath);
      onChange(newPath.join(""));
    }
  };


  const handleEnd = () => {
    setIsDrawing(false);
    setCurrentMousePos(null);
  };

  const reset = () => {
    setPath([]);
    onChange("");
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative rounded-2xl border border-border bg-muted/20 p-2 shadow-inner">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="touch-none cursor-crosshair"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>
      <div className="flex w-full items-center justify-between px-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {path.length > 0 ? `Padrão: ${path.join(" → ")}` : "Desenhe o padrão"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-8 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
    </div>
  );
}
