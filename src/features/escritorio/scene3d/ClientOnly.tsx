import { useEffect, useState, type ReactNode } from "react";

type ClientOnlyProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

// Renderiza os filhos só depois da montagem no navegador. Evita que a cena
// 3D (WebGL, window) rode durante o SSR.
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  return montado ? children : fallback;
}
