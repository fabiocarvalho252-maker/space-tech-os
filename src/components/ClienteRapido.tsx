// Cadastro rápido de cliente sem sair da tela (Nova OS, edição da OS, PDV):
// o seletor ganha "+ Cadastrar novo cliente" e abre aqui mesmo um formulário
// curto — nome, WhatsApp e CPF/CNPJ opcional. O cliente criado já volta
// selecionado; o cadastro completo continua em Clientes.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClienteSelect } from "@/components/ClienteSelect";
import { digitsOnlyBR, isValidPhoneBR, maskPhoneBR } from "@/lib/whatsapp";
import { formatarDocumento, somenteDigitos, validarCnpj, validarCpf } from "@/lib/documento";

type ClienteBasico = { id: string; nome: string };

export function ClienteCampo({
  clientes,
  value,
  onChange,
  semClienteLabel,
}: {
  clientes: ClienteBasico[];
  value: string;
  onChange: (id: string) => void;
  semClienteLabel?: string;
}) {
  const [novoNome, setNovoNome] = useState<string | null>(null);

  if (novoNome !== null) {
    return (
      <ClienteRapidoForm
        nomeInicial={novoNome}
        onCancelar={() => setNovoNome(null)}
        onCriado={(cliente) => {
          setNovoNome(null);
          onChange(cliente.id);
        }}
      />
    );
  }

  return (
    <ClienteSelect
      clientes={clientes}
      value={value}
      onChange={onChange}
      semClienteLabel={semClienteLabel}
      onNovoCliente={(busca) => setNovoNome(busca)}
    />
  );
}

function ClienteRapidoForm({
  nomeInicial,
  onCancelar,
  onCriado,
}: {
  nomeInicial: string;
  onCancelar: () => void;
  onCriado: (cliente: ClienteBasico) => void;
}) {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");
  const [salvando, setSalvando] = useState(false);

  const docDigitos = somenteDigitos(documento);
  const docInvalido =
    docDigitos.length > 0 &&
    !(docDigitos.length === 11
      ? validarCpf(docDigitos)
      : docDigitos.length === 14 && validarCnpj(docDigitos));
  const telefoneInvalido = telefone.trim() !== "" && !isValidPhoneBR(telefone);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (telefoneInvalido) {
      toast.error("Telefone incompleto — use DDD + número");
      return;
    }
    if (docInvalido) {
      toast.error("CPF/CNPJ inválido");
      return;
    }
    if (!empresaId) return;
    setSalvando(true);
    try {
      // Evita cadastro duplicado: mesmo telefone ou documento já cadastrado.
      const telDigitos = digitsOnlyBR(telefone);
      if (telDigitos || docDigitos) {
        const { data: existentes } = await supabase
          .from("clientes")
          .select("id, nome, telefone, documento")
          .eq("user_id", empresaId);
        const repetido = (existentes ?? []).find(
          (c) =>
            (telDigitos && digitsOnlyBR(c.telefone ?? "") === telDigitos) ||
            (docDigitos && somenteDigitos(c.documento) === docDigitos),
        );
        if (repetido) {
          toast.info(`Cliente já cadastrado: ${repetido.nome} — selecionado.`);
          onCriado({ id: repetido.id, nome: repetido.nome });
          return;
        }
      }

      const { data, error } = await supabase
        .from("clientes")
        .insert({
          user_id: empresaId,
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          documento: documento.trim() || null,
        })
        .select("id, nome")
        .single();
      if (error) throw error;
      // Atualiza as listas de clientes das telas (OS, PDV, Clientes).
      qc.setQueriesData<ClienteBasico[]>({ queryKey: ["clientes"] }, (lista) =>
        Array.isArray(lista)
          ? [...lista, data].sort((a, b) => a.nome.localeCompare(b.nome))
          : lista,
      );
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["clientes-pdv"] });
      toast.success(`Cliente ${data.nome} cadastrado`);
      onCriado(data);
    } catch (e) {
      toast.error("Não foi possível cadastrar: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <UserPlus className="h-3.5 w-3.5" /> Novo cliente
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancelar cadastro"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do cliente"
        autoFocus
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={telefone}
          onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
          placeholder="WhatsApp (DDD + número)"
          inputMode="tel"
          className={telefoneInvalido ? "border-destructive" : undefined}
        />
        <Input
          value={documento}
          onChange={(e) => setDocumento(formatarDocumento(e.target.value))}
          placeholder="CPF/CNPJ (opcional)"
          inputMode="numeric"
          className={docInvalido ? "border-destructive" : undefined}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={salvar} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar e selecionar
        </Button>
      </div>
    </div>
  );
}
