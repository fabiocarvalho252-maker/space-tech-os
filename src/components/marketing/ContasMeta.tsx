// Aba "Contas" do /admin/marketing: conectar/desconectar Instagram + Facebook
// (Meta) e escolher a Página usada nas publicações.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Facebook, Instagram, Link2, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  desconectarMeta,
  escolherPaginaMeta,
  iniciarConexaoMeta,
  obterContasMeta,
} from "@/lib/marketing/meta.functions";
import { cn } from "@/lib/utils";

export const CHAVE_CONTAS_META = ["site-admin-marketing-meta"];

export function useContasMeta() {
  return useQuery({ queryKey: CHAVE_CONTAS_META, queryFn: () => obterContasMeta() });
}

export function ContasMeta() {
  const qc = useQueryClient();
  const { data, isLoading } = useContasMeta();
  const [sair, setSair] = useState(false);
  const atualizar = () => qc.invalidateQueries({ queryKey: CHAVE_CONTAS_META });

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoMeta(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão."),
  });
  const escolher = useMutation({
    mutationFn: (paginaId: string) => escolherPaginaMeta({ data: { paginaId } }),
    onSuccess: () => {
      toast.success("Página escolhida.");
      atualizar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao escolher a Página."),
  });
  const desconectar = useMutation({
    mutationFn: () => desconectarMeta(),
    onSuccess: () => {
      setSair(false);
      toast.success("Contas desconectadas.");
      atualizar();
    },
  });

  if (isLoading || !data)
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-400 p-2 text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <span className="flex items-center rounded-xl bg-[#1877f2] p-2 text-white">
            <Facebook className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">Instagram + Facebook (Meta)</h2>
            <p className="text-sm text-muted-foreground">
              {data.conectado
                ? `Conectado por ${data.usuario || "—"} em ${new Date(data.conectadoEm!).toLocaleString("pt-BR")}`
                : "Não conectado"}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {data.conectado ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => conectar.mutate()}
                  disabled={conectar.isPending}
                >
                  <Link2 className="h-4 w-4" /> Reconectar
                </Button>
                <Button variant="ghost" onClick={() => setSair(true)}>
                  <LogOut className="h-4 w-4" /> Desconectar
                </Button>
              </>
            ) : (
              <Button
                onClick={() => conectar.mutate()}
                disabled={!data.configurado || conectar.isPending}
              >
                {conectar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Conectar Instagram e Facebook
              </Button>
            )}
          </div>
        </div>

        {!data.configurado && (
          <p className="mt-3 text-sm text-destructive">
            Faltam META_APP_ID e META_APP_SECRET no .env do servidor.
          </p>
        )}

        {data.conectado && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold">Página usada nas publicações</p>
            {data.paginas.length === 0 && (
              <p className="text-sm text-destructive">
                Nenhuma Página do Facebook foi liberada no login. Reconecte e marque a Página da
                SPACE TECH.
              </p>
            )}
            {data.paginas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => escolher.mutate(p.id)}
                disabled={escolher.isPending}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm",
                  data.paginaId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                {data.paginaId === p.id ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                <span className="font-medium">{p.nome}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {p.instagram
                    ? `Instagram @${p.instagram}`
                    : "sem Instagram profissional vinculado"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Publicar só acontece pelo botão “Publicar” de um conteúdo aprovado, com confirmação.
          </li>
          <li>Só aparecem as plataformas autorizadas na aprovação de cada conteúdo.</li>
          <li>
            Google ainda é publicado por você, manualmente (baixe a mídia no conteúdo).
          </li>
          <li>Os acessos ficam guardados só no servidor, fora do código.</li>
        </ul>
      </section>

      <ConfirmDialog
        open={sair}
        onOpenChange={setSair}
        title="Desconectar Instagram e Facebook?"
        description="O sistema esquece os acessos. Posts já publicados continuam no ar."
        confirmLabel="Desconectar"
        destructive
        loading={desconectar.isPending}
        onConfirm={() => desconectar.mutate()}
      />
    </div>
  );
}
