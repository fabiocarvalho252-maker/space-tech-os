// Etiqueta da OS para colar no aparelho (60×40 mm, impressora térmica de
// etiqueta ou papel comum): loja, nº da OS, cliente, aparelho, entrada e um
// QR Code que abre a OS no sistema (/ordens?os=<id>, pede login). A senha do
// aparelho nunca vai na etiqueta.
import { renderToString } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { origemPublica } from "@/lib/site-url";

const esc = (t: string) =>
  t.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export type OsEtiqueta = {
  id: string;
  numero: number;
  aparelho?: string | null;
  marca?: string | null;
  modelo?: string | null;
  created_at?: string | null;
  defeito?: string | null;
  clientes?: { nome?: string | null; telefone?: string | null } | null;
};

export function imprimirEtiquetaOs(os: OsEtiqueta, loja: string, copias = 1) {
  const janela = window.open("", "_blank", "width=420,height=360");
  if (!janela) return false;
  const qr = renderToString(
    <QRCodeSVG value={`${origemPublica()}/ordens?os=${os.id}`} size={96} level="M" />,
  );
  const aparelho = [os.marca, os.modelo].filter(Boolean).join(" ") || os.aparelho || "";
  const telefone = (os.clientes?.telefone ?? "").replace(/\D/g, "");
  const entrada = os.created_at ? new Date(os.created_at).toLocaleDateString("pt-BR") : "";
  const etiqueta = `<div class="etq">
      <div class="qr">${qr}</div>
      <div class="info">
        <span class="loja">${esc(loja)}</span>
        <strong class="num">OS #${os.numero}</strong>
        <span class="cli">${esc(os.clientes?.nome ?? "")}</span>
        ${telefone.length >= 4 ? `<span>Tel. final ${telefone.slice(-4)}</span>` : ""}
        ${aparelho ? `<span class="ap">${esc(aparelho)}</span>` : ""}
        ${os.defeito ? `<span class="def">${esc(os.defeito.slice(0, 60))}</span>` : ""}
        ${entrada ? `<span>Entrada: ${entrada}</span>` : ""}
      </div>
    </div>`;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Etiqueta OS #${os.numero}</title>
    <style>
      @page{size:60mm 40mm;margin:1.5mm}
      *{box-sizing:border-box}
      body{margin:0;font-family:system-ui,Arial,sans-serif;color:#000;background:#fff}
      .etq{width:57mm;height:37mm;display:flex;gap:2mm;align-items:center;overflow:hidden;page-break-after:always}
      .qr svg{width:22mm;height:22mm;display:block}
      .info{display:flex;flex-direction:column;min-width:0;font-size:7.5pt;line-height:1.2}
      .info span,.info strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .loja{font-size:6.5pt;text-transform:uppercase;letter-spacing:.3px}
      .num{font-size:13pt;font-weight:900}
      .cli{font-weight:700;font-size:8.5pt}
      .def{font-style:italic}
      @media screen{body{padding:8px;background:#eee}.etq{background:#fff;border:1px dashed #999;margin-bottom:8px;padding:1.5mm}}
    </style></head><body>
    ${etiqueta.repeat(Math.max(1, Math.min(10, copias)))}
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  janela.document.close();
  return true;
}
