// Scales a full A4 HTML document (from os-template-render.tsx) down to fit
// whatever box it's dropped into — an <iframe srcDoc> rendered at real A4
// pixel size, then shrunk with a CSS transform. Used both for the small
// library card thumbnails (auto-fit mode) and, at a larger size, inside the
// preview modal's zoom controls (explicit scale mode) — a real render of the
// template's own HTML/CSS, not a static mock image, so it stays accurate
// whenever the template's config changes.
import { useEffect, useRef, useState } from "react";

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export function OsTemplateThumbnail({
  html,
  orientacao = "retrato",
  className,
  scale: scaleOverride,
}: {
  html: string;
  orientacao?: "retrato" | "paisagem";
  className?: string;
  /** Explicit scale (e.g. from a zoom control) instead of auto-fitting the container. When set, the page is sized to its true scaled dimensions and left free to overflow a scrollable parent. */
  scale?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.25);

  const pageW = orientacao === "paisagem" ? A4_HEIGHT_PX : A4_WIDTH_PX;
  const pageH = orientacao === "paisagem" ? A4_WIDTH_PX : A4_HEIGHT_PX;
  const autoFit = scaleOverride === undefined;

  useEffect(() => {
    if (!autoFit) return;
    const el = wrapRef.current;
    if (!el) return;
    const recalc = () => setFit(el.clientWidth / pageW);
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW, autoFit]);

  const scale = scaleOverride ?? fit;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={
        autoFit
          ? {
              aspectRatio: `${pageW} / ${pageH}`,
              overflow: "hidden",
              position: "relative",
              background: "#fff",
            }
          : {
              width: pageW * scale,
              height: pageH * scale,
              position: "relative",
              background: "#fff",
              flexShrink: 0,
            }
      }
    >
      <iframe
        title="Prévia do modelo"
        srcDoc={html}
        sandbox=""
        style={{
          width: pageW,
          height: pageH,
          border: "none",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
