import { useEffect, useState } from "react";
import { toast } from "sonner";
import { gerarComprovanteVendaFn } from "@/lib/vendas.functions";
import { base64ParaBytes } from "@/lib/pdf-share";
import { PdfPreviewDialog, type PdfGerado } from "@/components/aparelhos/PdfPreviewDialog";

export type VendaParaComprovante = {
  id: string;
  numero: number | null;
  clienteNome?: string | null;
  clienteTelefone?: string | null;
};

// Gera o comprovante da venda assim que abre e mostra a mesma tela de "PDF
// pronto" do módulo Aparelhos (visualizar/imprimir, compartilhar, WhatsApp).
export function ComprovanteVendaDialog({
  venda,
  onClose,
}: {
  venda: VendaParaComprovante | null;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<PdfGerado | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!venda) return;
    let cancelado = false;
    setPdf(null);
    setGerando(true);
    gerarComprovanteVendaFn({ data: { vendaId: venda.id } })
      .then(({ base64 }) => {
        if (cancelado) return;
        const nome = `comprovante-venda-${String(venda.numero ?? "").padStart(4, "0")}.pdf`;
        const file = new File([base64ParaBytes(base64)], nome, { type: "application/pdf" });
        setPdf({ file, url: URL.createObjectURL(file) });
      })
      .catch((e: Error) => {
        if (cancelado) return;
        toast.error(e.message || "Não foi possível gerar o comprovante");
        onClose();
      })
      .finally(() => !cancelado && setGerando(false));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regera só quando muda a venda
  }, [venda?.id]);

  useEffect(() => () => void (pdf && URL.revokeObjectURL(pdf.url)), [pdf]);

  const numero = String(venda?.numero ?? "").padStart(4, "0");
  return (
    <PdfPreviewDialog
      open={!!venda}
      onOpenChange={(open) => !open && onClose()}
      titulo={`Comprovante da venda #${numero}`}
      gerando={gerando}
      pdf={pdf}
      telefoneCliente={venda?.clienteTelefone}
      mensagemWhatsapp={`Olá${venda?.clienteNome ? `, ${venda.clienteNome}` : ""}! Segue o comprovante da sua compra (venda #${numero}). Obrigado pela preferência!`}
    />
  );
}
