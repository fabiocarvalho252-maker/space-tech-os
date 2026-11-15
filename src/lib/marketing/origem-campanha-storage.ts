// Guarda a última origem de campanha (UTM) vista no navegador, para que ela
// sobreviva à navegação até o cadastro. Só uma conveniência por visitante:
// se o navegador bloquear o armazenamento, o cadastro segue sem a origem.
import { extrairOrigemCampanha, mesclarOrigemCampanha, type OrigemCampanha } from "./utm-campanha";

const CHAVE_ARMAZENAMENTO = "spacetech:origem-campanha";

export function lerOrigemSalva(): OrigemCampanha {
  try {
    const bruto = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return {};
    return extrairOrigemCampanha(JSON.parse(bruto) as Record<string, unknown>);
  } catch (erro) {
    console.error("[Origem] Falha ao ler a origem salva:", erro);
    return {};
  }
}

export function registrarVisitaCampanha(parametros: Record<string, unknown>): void {
  const visita = extrairOrigemCampanha(parametros);
  if (Object.keys(visita).length === 0) return;
  try {
    const atual = mesclarOrigemCampanha(lerOrigemSalva(), visita);
    window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(atual));
  } catch (erro) {
    console.error("[Origem] Falha ao salvar a origem:", erro);
  }
}
