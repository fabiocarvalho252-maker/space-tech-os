// Prepara a foto no navegador: reduz o tamanho e converte para JPEG em base64.
// Uma foto de celular tem vários MB; a nota só precisa de legibilidade.
const LADO_MAXIMO_PX = 1600;
const QUALIDADE_JPEG = 0.85;

export type ImagemBase64 = { mime: "image/jpeg"; base64: string };

function lerBlobComoBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    leitor.onerror = () => reject(new Error("Não consegui ler a imagem."));
    leitor.readAsDataURL(blob);
  });
}

export async function imagemParaJpegBase64(arquivo: File): Promise<ImagemBase64> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Envie uma foto ou imagem da nota (PDF não é aceito nesta leitura).");
  }
  const bitmap = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE_JPEG),
    );
    if (!blob) throw new Error("Não consegui preparar a imagem.");
    return { mime: "image/jpeg", base64: await lerBlobComoBase64(blob) };
  } finally {
    bitmap.close();
  }
}
