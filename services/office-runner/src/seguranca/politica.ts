// Política de ferramentas: o que é liberado, o que pede aprovação e o que é
// negado sempre. Função pura, sem I/O, para ser testada isoladamente.
import { isAbsolute, relative, resolve } from "node:path";
import type { ModoPermissao } from "../tipos.ts";

export type Decisao =
  | { comportamento: "permitir" }
  | { comportamento: "pedir"; motivo: string }
  | { comportamento: "negar"; motivo: string };

const FERRAMENTAS_LEITURA = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch"]);
const FERRAMENTAS_ESCRITA = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

// Padrões de comando sempre negados, independentemente do modo.
const COMANDOS_PROIBIDOS: { padrao: RegExp; motivo: string }[] = [
  { padrao: /(^|[;&|\s])sudo\b/, motivo: "sudo não é permitido" },
  { padrao: /(^|[;&|\s])su\s/, motivo: "trocar de usuário não é permitido" },
  { padrao: /rm\s+-[a-z]*r[a-z]*f?\s+\/(?!srv\/office\/projects)/, motivo: "remoção recursiva fora do projeto" },
  { padrao: /(curl|wget)[^|]*\|\s*(sh|bash|zsh)/, motivo: "execução de script baixado" },
  { padrao: /\b(chmod|chown|chgrp)\b/, motivo: "alteração de permissões" },
  { padrao: /\b(systemctl|service|crontab|ufw|iptables|nft)\b/, motivo: "serviço ou firewall do sistema" },
  { padrao: /\bdocker\b/, motivo: "docker não é liberado" },
  { padrao: /git\s+push\b[^\n]*\b(main|master)\b/, motivo: "push para main/master não é permitido" },
  { padrao: /\bgit\s+push\b[^\n]*--force/, motivo: "force push não é permitido" },
  { padrao: /npm\s+run\s+deploy|scripts\/deploy\.sh|deploy\/office/, motivo: "comandos de deploy não são permitidos" },
  { padrao: /\/etc\/|\/root\/|~\/\.ssh|\.ssh\//, motivo: "acesso a caminhos do sistema" },
];

// Arquivos sensíveis: nunca lidos nem alterados pelo agente.
const ARQUIVOS_PROIBIDOS = [
  /(^|\/)\.env(\.|$)/,
  /\.pem$/,
  /(^|\/)id_(rsa|ed25519|ecdsa)/,
  /(^|\/)shadow$/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)\.credentials\.json$/,
];

export function caminhoDentroDoProjeto(projetoRaiz: string, caminho: string): boolean {
  const alvo = isAbsolute(caminho) ? resolve(caminho) : resolve(projetoRaiz, caminho);
  const relativo = relative(resolve(projetoRaiz), alvo);
  return relativo === "" || (!relativo.startsWith("..") && !isAbsolute(relativo));
}

function arquivoProibido(caminho: string): boolean {
  return ARQUIVOS_PROIBIDOS.some((padrao) => padrao.test(caminho));
}

function extrairCaminho(entrada: Record<string, unknown>): string | null {
  for (const chave of ["file_path", "path", "notebook_path"]) {
    const valor = entrada[chave];
    if (typeof valor === "string" && valor.length > 0) return valor;
  }
  return null;
}

function decidirComando(comando: string): Decisao | null {
  for (const { padrao, motivo } of COMANDOS_PROIBIDOS) {
    if (padrao.test(comando)) return { comportamento: "negar", motivo };
  }
  return null;
}

export type EntradaDecisao = {
  ferramenta: string;
  entrada: Record<string, unknown>;
  modo: ModoPermissao;
  projetoRaiz: string;
};

export function decidirFerramenta({ ferramenta, entrada, modo, projetoRaiz }: EntradaDecisao): Decisao {
  if (ferramenta === "Bash") {
    const comando = typeof entrada["command"] === "string" ? entrada["command"] : "";
    const proibido = decidirComando(comando);
    if (proibido) return proibido;
    if (modo === "automatico") return { comportamento: "negar", motivo: "Bash só no modo seguro, com aprovação" };
    return { comportamento: "pedir", motivo: `Executar comando: ${comando.slice(0, 160)}` };
  }

  const caminho = extrairCaminho(entrada);
  if (caminho && (FERRAMENTAS_LEITURA.has(ferramenta) || FERRAMENTAS_ESCRITA.has(ferramenta))) {
    if (arquivoProibido(caminho)) return { comportamento: "negar", motivo: "arquivo sensível" };
    if (!caminhoDentroDoProjeto(projetoRaiz, caminho)) {
      return { comportamento: "negar", motivo: "caminho fora do projeto permitido" };
    }
  }

  if (FERRAMENTAS_LEITURA.has(ferramenta)) return { comportamento: "permitir" };

  if (FERRAMENTAS_ESCRITA.has(ferramenta)) {
    if (modo === "automatico") return { comportamento: "negar", motivo: "escrita só no modo seguro" };
    return { comportamento: "pedir", motivo: `${ferramenta}: ${caminho ?? "arquivo"}` };
  }

  return { comportamento: "negar", motivo: `ferramenta ${ferramenta} não está liberada` };
}
