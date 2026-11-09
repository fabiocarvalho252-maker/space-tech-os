// Renderizador pequeno de Markdown para os arquivos de marketing (formato
// controlado: títulos, parágrafos, listas, tabelas, citações, blocos de
// código, **negrito**, *itálico*, `código` e links). Gera elementos React —
// nunca HTML cru —, então nada no arquivo vira script na página. IDs de
// conteúdo em negrito (ex.: **IG-01**) viram botões quando `onAbrirId` é
// passado e o ID existe.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  texto: string;
  className?: string;
  idsExistentes?: Set<string> | undefined;
  onAbrirId?: ((id: string) => void) | undefined;
  // Documentos vêm com quebra de linha a cada ~80 colunas; legendas de post
  // têm quebras de verdade. false junta as linhas do parágrafo.
  manterQuebras?: boolean;
};

const INLINE =
  /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)<>|]+|(?<![\w*])\*[^*\s][^*]*?\*(?![\w*]))/g;

function Inline({
  texto,
  idsExistentes,
  onAbrirId,
}: Omit<Props, "className" | "manterQuebras">): ReactNode {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let i = 0;
  for (const m of texto.matchAll(INLINE)) {
    const token = m[0];
    const pos = m.index ?? 0;
    if (pos > ultimo) partes.push(texto.slice(ultimo, pos));
    const k = `i${i++}`;
    if (token.startsWith("**")) {
      const conteudo = token.slice(2, -2);
      if (onAbrirId && idsExistentes?.has(conteudo)) {
        partes.push(
          <button
            key={k}
            type="button"
            onClick={() => onAbrirId(conteudo)}
            className="rounded bg-primary/10 px-1 font-semibold text-primary underline-offset-2 hover:underline"
          >
            {conteudo}
          </button>,
        );
      } else {
        partes.push(
          <strong key={k} className="font-semibold text-foreground">
            {conteudo}
          </strong>,
        );
      }
    } else if (token.startsWith("`")) {
      partes.push(
        <code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const mm = token.match(/^\[([^\]]+)\]\((.+)\)$/)!;
      partes.push(
        <a
          key={k}
          href={mm[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {mm[1]}
        </a>,
      );
    } else if (token.startsWith("http")) {
      partes.push(
        <a
          key={k}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline"
        >
          {token}
        </a>,
      );
    } else {
      partes.push(<em key={k}>{token.slice(1, -1)}</em>);
    }
    ultimo = pos + token.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: { texto: string; recuo: number }[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
  | { tipo: "citacao"; texto: string }
  | { tipo: "codigo"; texto: string }
  | { tipo: "linha" };

function celulas(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function blocosMarkdown(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i]!;
    if (!linha.trim()) {
      i++;
      continue;
    }
    if (linha.startsWith("```")) {
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i]!.startsWith("```")) corpo.push(linhas[i++]!);
      i++;
      blocos.push({ tipo: "codigo", texto: corpo.join("\n") });
      continue;
    }
    const titulo = linha.match(/^(#{1,4})\s+(.+)$/);
    if (titulo) {
      blocos.push({ tipo: "titulo", nivel: titulo[1]!.length, texto: titulo[2]!.trim() });
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(linha)) {
      blocos.push({ tipo: "linha" });
      i++;
      continue;
    }
    if (linha.trim().startsWith("|")) {
      const grupo: string[] = [];
      while (i < linhas.length && linhas[i]!.trim().startsWith("|")) grupo.push(linhas[i++]!);
      const [cab, ...resto] = grupo;
      const linhasTabela = resto.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(celulas);
      blocos.push({ tipo: "tabela", cabecalho: celulas(cab!), linhas: linhasTabela });
      continue;
    }
    if (linha.startsWith(">")) {
      const grupo: string[] = [];
      while (i < linhas.length && linhas[i]!.startsWith(">"))
        grupo.push(linhas[i++]!.replace(/^>\s?/, ""));
      blocos.push({ tipo: "citacao", texto: grupo.join("\n") });
      continue;
    }
    const item = linha.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
    if (item) {
      const ordenada = /\d/.test(item[2]!);
      const itens: { texto: string; recuo: number }[] = [];
      while (i < linhas.length) {
        const l = linhas[i]!;
        const mi = l.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (mi) {
          itens.push({ texto: mi[3]!, recuo: Math.min(2, Math.floor(mi[1]!.length / 2)) });
          i++;
        } else if (l.trim() && /^\s{2,}/.test(l) && itens.length) {
          itens[itens.length - 1]!.texto += ` ${l.trim()}`;
          i++;
        } else break;
      }
      blocos.push({ tipo: "lista", ordenada, itens });
      continue;
    }
    const grupo: string[] = [];
    while (
      i < linhas.length &&
      linhas[i]!.trim() &&
      !/^(#{1,4}\s|```|>|\s*\||\s*([-*•]|\d+\.)\s)/.test(linhas[i]!)
    )
      grupo.push(linhas[i++]!);
    blocos.push({ tipo: "paragrafo", texto: grupo.join("\n") });
  }
  return blocos;
}

export function Markdown({
  texto,
  className,
  idsExistentes,
  onAbrirId,
  manterQuebras = true,
}: Props) {
  const inl = (t: string) => (
    <Inline texto={t} idsExistentes={idsExistentes} onAbrirId={onAbrirId} />
  );
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
      {blocosMarkdown(texto).map((b, n) => {
        switch (b.tipo) {
          case "titulo": {
            const estilo =
              b.nivel === 1
                ? "text-xl font-extrabold"
                : b.nivel === 2
                  ? "pt-2 text-lg font-bold"
                  : "pt-1 text-base font-semibold";
            return (
              <p
                key={n}
                role="heading"
                aria-level={b.nivel + 1}
                className={cn("text-foreground", estilo)}
              >
                {inl(b.texto)}
              </p>
            );
          }
          case "paragrafo":
            return (
              <p key={n} className={manterQuebras ? "whitespace-pre-line" : undefined}>
                {inl(manterQuebras ? b.texto : b.texto.replace(/\s*\n\s*/g, " "))}
              </p>
            );
          case "lista": {
            const Tag = b.ordenada ? "ol" : "ul";
            return (
              <Tag
                key={n}
                className={cn("space-y-1 pl-5", b.ordenada ? "list-decimal" : "list-disc")}
              >
                {b.itens.map((it, j) => (
                  <li key={j} style={{ marginLeft: `${it.recuo * 1.25}rem` }}>
                    {inl(it.texto)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "tabela":
            return (
              <div key={n} className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {b.cabecalho.map((c, j) => (
                        <th key={j} className="px-3 py-2 font-semibold">
                          {inl(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.linhas.map((l, j) => (
                      <tr key={j} className="border-t border-border align-top">
                        {l.map((c, k) => (
                          <td key={k} className="px-3 py-2 text-foreground/90">
                            {inl(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "citacao":
            return (
              <div
                key={n}
                className="whitespace-pre-line rounded-xl border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-foreground"
              >
                {inl(manterQuebras ? b.texto : b.texto.replace(/\s*\n\s*/g, " "))}
              </div>
            );
          case "codigo":
            return (
              <pre
                key={n}
                className="overflow-x-auto rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
              >
                {b.texto}
              </pre>
            );
          case "linha":
            return <hr key={n} className="border-border" />;
        }
      })}
    </div>
  );
}
