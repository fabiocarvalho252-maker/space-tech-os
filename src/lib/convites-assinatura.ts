// Link de assinatura do /admin: textos prontos e leitura da lista colada.
// Puro (sem "@/") para rodar no `node --test` e no navegador.

export type Oferta = "teste" | "mensal" | "anual";

export const OFERTAS: { id: Oferta; label: string }[] = [
  { id: "teste", label: "Teste grátis (7 dias)" },
  { id: "mensal", label: "Plano mensal" },
  { id: "anual", label: "Plano anual" },
];

export const MODELOS_CONVITE: Record<Oferta, string> = {
  teste: `Oi, {nome}! Tudo bem? 😊

Aqui está o link para criar sua conta no *SPACE TECH*, o sistema para assistência técnica: ordens de serviço, PDV, estoque, financeiro e WhatsApp num lugar só.

👉 {link}

São *7 dias grátis*, sem cartão. Qualquer dúvida, é só me chamar por aqui!

Equipe SPACE TECH`,
  mensal: `Oi, {nome}! Tudo bem? 😊

Aqui está o link para assinar o *SPACE TECH* — plano mensal por *{preco_mensal}/mês*:

👉 {link}

Crie sua conta e, em *Meu Plano*, pague com Pix: a liberação é automática na hora. Qualquer dúvida, é só me chamar!

Equipe SPACE TECH`,
  anual: `Oi, {nome}! Tudo bem? 😊

Aqui está o link para assinar o *SPACE TECH* — plano anual por *{preco_anual}/ano*:

👉 {link}

Crie sua conta e, em *Meu Plano*, pague com Pix: a liberação é automática na hora. Qualquer dúvida, é só me chamar!

Equipe SPACE TECH`,
};

export type Precos = { mensal: number | null; anual: number | null };

function reais(valor: number | null): string {
  return valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

/** Primeiro nome capitalizado; sem nome vira "tudo bem" ("Oi, tudo bem!"). */
export function primeiroNomeConvite(nome: string | null | undefined): string {
  const n = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "tudo bem";
}

export function personalizarConvite(
  modelo: string,
  dados: { nome: string | null; link: string; precos: Precos },
): string {
  return modelo
    .replaceAll("{nome}", primeiroNomeConvite(dados.nome))
    .replaceAll("{link}", dados.link)
    .replaceAll("{preco_mensal}", reais(dados.precos.mensal))
    .replaceAll("{preco_anual}", reais(dados.precos.anual));
}

/** Só dígitos, com 55 na frente quando for número brasileiro sem DDI. */
export function normalizarTelefoneConvite(telefone: string): string | null {
  let d = telefone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 && d.startsWith("55") ? d : null;
}

export type ContatoLista = { nome: string | null; telefone: string };
export type LinhaInvalida = { linha: number; texto: string };

/**
 * Lista colada, um contato por linha: "Nome, telefone", "Nome; telefone",
 * "Nome - telefone", "telefone Nome" ou só o telefone. Telefone repetido
 * entra uma vez.
 */
export function lerListaContatos(texto: string): {
  contatos: ContatoLista[];
  invalidas: LinhaInvalida[];
} {
  const contatos: ContatoLista[] = [];
  const invalidas: LinhaInvalida[] = [];
  const vistos = new Set<string>();
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = bruta.trim();
    if (!linha) return;
    const achado = linha.match(/\+?\(?\d[\d\s().-]{8,}\d/);
    const telefone = achado ? normalizarTelefoneConvite(achado[0]) : null;
    if (!achado || !telefone) {
      invalidas.push({ linha: i + 1, texto: linha });
      return;
    }
    if (vistos.has(telefone)) return;
    vistos.add(telefone);
    const nome = linha
      .replace(achado[0], " ")
      .replace(/[;,\t|]+/g, " ")
      .replace(/(^|\s)-(\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    contatos.push({ nome: nome || null, telefone });
  });
  return { contatos, invalidas };
}
