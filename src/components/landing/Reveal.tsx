import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Faz o conteúdo surgir (fade + slide-up) quando entra na tela. As classes
// .lp-reveal/.lp-visivel ficam em styles.css e são desligadas por
// prefers-reduced-motion.
export function Reveal({
  children,
  className,
  atraso = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string | undefined;
  atraso?: number;
  as?: "div" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polymorphic ref
      ref={ref as any}
      className={cn("lp-reveal", visivel && "lp-visivel", className)}
      style={atraso ? { transitionDelay: `${atraso}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
