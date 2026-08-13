// Tiny client-side helpers for handing a server-generated PDF (base64) to
// the browser — extracted out of EnviarOsModal.tsx (where they were first
// written, only local to that file) so the Aparelhos module's "Gerar
// comprovante"/"Gerar garantia"/"Enviar pelo WhatsApp" actions can reuse the
// exact same share-sheet behavior instead of re-implementing it.
export function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function podeCompartilharArquivo(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

// Built from char codes (not a literal combining-marks range in source) so
// the U+0300..U+036F block survives copy/paste and editor round-trips
// intact — after NFD normalization, "João" becomes "Joa" + U+0303 (combining
// tilde), and this strips that combining mark before the alnum filter below.
const DIACRITICOS = new RegExp(
  `[\\u${(0x0300).toString(16).padStart(4, "0")}-\\u${(0x036f).toString(16).padStart(4, "0")}]`,
  "g",
);

export function sanitizarNomeArquivo(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(DIACRITICOS, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase() || "CLIENTE"
  );
}

export function baixarArquivo(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
