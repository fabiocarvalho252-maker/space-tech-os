// Formulário de edição do perfil de um agente. A validação roda ao vivo e o
// envio só acontece quando não há erros. Os dados vão para quem chama (onSalvar).
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentProfile } from "../equipe/tipos.ts";
import {
  validarEdicaoPerfil,
  valoresIniciaisEdicao,
  type ErrosEdicaoPerfil,
  type ValoresEdicaoPerfil,
} from "../equipe/validacaoEdicao.ts";

type Props = {
  perfil: AgentProfile;
  nomesOutros: readonly string[];
  setores: readonly string[];
  salvando: boolean;
  erroSalvar: string | null;
  onSalvar: (valores: ValoresEdicaoPerfil) => void;
  onCancelar: () => void;
};

function CampoErro({ id, mensagem }: { id: string; mensagem: string | undefined }) {
  if (!mensagem) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {mensagem}
    </p>
  );
}

export function FormularioPerfil({
  perfil,
  nomesOutros,
  setores,
  salvando,
  erroSalvar,
  onSalvar,
  onCancelar,
}: Props) {
  const [valores, setValores] = useState<ValoresEdicaoPerfil>(() => valoresIniciaisEdicao(perfil));
  const resultado = validarEdicaoPerfil(valores, nomesOutros);
  const erros: ErrosEdicaoPerfil = resultado.ok ? {} : resultado.erros;

  const alterar = (campo: Exclude<keyof ValoresEdicaoPerfil, "whenToUse">) => (texto: string) =>
    setValores((atual) => ({ ...atual, [campo]: texto }));

  const alterarExemplo = (indice: number, texto: string) =>
    setValores((atual) => ({
      ...atual,
      whenToUse: atual.whenToUse.map((item, i) => (i === indice ? texto : item)),
    }));

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!resultado.ok || salvando) return;
    onSalvar(valores);
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-nome">Nome</Label>
          <Input
            id="perfil-nome"
            value={valores.displayName}
            maxLength={60}
            aria-invalid={erros.displayName !== undefined}
            aria-describedby={erros.displayName ? "perfil-nome-erro" : undefined}
            onChange={(e) => alterar("displayName")(e.target.value)}
          />
          <CampoErro id="perfil-nome-erro" mensagem={erros.displayName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-setor">Setor</Label>
          <Input
            id="perfil-setor"
            list="perfil-setores"
            value={valores.sector}
            aria-invalid={erros.sector !== undefined}
            aria-describedby={erros.sector ? "perfil-setor-erro" : undefined}
            onChange={(e) => alterar("sector")(e.target.value)}
          />
          <datalist id="perfil-setores">
            {setores.map((setor) => (
              <option key={setor} value={setor} />
            ))}
          </datalist>
          <CampoErro id="perfil-setor-erro" mensagem={erros.sector} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-cargo">Cargo</Label>
        <Input
          id="perfil-cargo"
          value={valores.roleTitle}
          aria-invalid={erros.roleTitle !== undefined}
          aria-describedby={erros.roleTitle ? "perfil-cargo-erro" : undefined}
          onChange={(e) => alterar("roleTitle")(e.target.value)}
        />
        <CampoErro id="perfil-cargo-erro" mensagem={erros.roleTitle} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-resumo">Resumo (uma linha)</Label>
        <Input
          id="perfil-resumo"
          value={valores.summaryPtBr}
          aria-invalid={erros.summaryPtBr !== undefined}
          aria-describedby={erros.summaryPtBr ? "perfil-resumo-erro" : undefined}
          onChange={(e) => alterar("summaryPtBr")(e.target.value)}
        />
        <CampoErro id="perfil-resumo-erro" mensagem={erros.summaryPtBr} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-descricao">Descrição</Label>
        <Textarea
          id="perfil-descricao"
          rows={5}
          value={valores.descriptionPtBr}
          aria-invalid={erros.descriptionPtBr !== undefined}
          aria-describedby={erros.descriptionPtBr ? "perfil-descricao-erro" : undefined}
          onChange={(e) => alterar("descriptionPtBr")(e.target.value)}
        />
        <CampoErro id="perfil-descricao-erro" mensagem={erros.descriptionPtBr} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Quando usar (3 exemplos)</legend>
        {valores.whenToUse.map((exemplo, indice) => {
          const erro = erros[`whenToUse.${indice}`] ?? (indice === 0 ? erros.whenToUse : undefined);
          return (
            <div key={indice} className="flex flex-col gap-1">
              <Input
                aria-label={`Exemplo ${indice + 1}`}
                value={exemplo}
                aria-invalid={erro !== undefined}
                aria-describedby={erro ? `perfil-exemplo-${indice}-erro` : undefined}
                onChange={(e) => alterarExemplo(indice, e.target.value)}
              />
              <CampoErro id={`perfil-exemplo-${indice}-erro`} mensagem={erro} />
            </div>
          );
        })}
      </fieldset>

      {erroSalvar && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
        >
          {erroSalvar}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!resultado.ok || salvando}>
          {salvando ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}
