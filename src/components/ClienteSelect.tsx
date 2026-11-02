import { useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Seletor de cliente com busca por nome (e telefone/CPF, quando a lista os
// traz) — o <select> nativo obrigava a rolar a lista inteira de clientes
// para achar um. Usado em todas as telas que escolhem cliente.
type ClienteOpcao = {
  id: string;
  nome: string;
  telefone?: string | null;
  documento?: string | null;
};

export function ClienteSelect({
  clientes,
  value,
  onChange,
  semClienteLabel = "Sem cliente vinculado",
  onNovoCliente,
  obrigatorio = false,
  className,
}: {
  clientes: ClienteOpcao[];
  value: string;
  onChange: (id: string) => void;
  /** Texto da opção sem cliente (OS: "Sem cliente vinculado"; PDV: "Consumidor final"). */
  semClienteLabel?: string | undefined;
  /** Mostra "+ Cadastrar novo cliente" e recebe o que foi digitado na busca. */
  onNovoCliente?: (busca: string) => void;
  /** Sem a opção "sem cliente": a tela exige um cliente (venda, reserva, cobrança...). */
  obrigatorio?: boolean | undefined;
  /** Classes extras do botão (ex.: altura h-11 dos formulários de tablet). */
  className?: string | undefined;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const selecionado = clientes.find((c) => c.id === value);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={`w-full justify-between font-normal ${className ?? ""}`}
        >
          <span
            className={`truncate ${!selecionado && obrigatorio ? "text-muted-foreground" : ""}`}
          >
            {selecionado?.nome ?? (obrigatorio ? "Selecione o cliente" : semClienteLabel)}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(_, busca, palavras) =>
            normalizar((palavras ?? []).join(" ")).includes(normalizar(busca)) ? 1 : 0
          }
        >
          <CommandInput
            placeholder="Digite o nome ou telefone..."
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            {!onNovoCliente && <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>}
            {onNovoCliente && (
              // Grupo próprio com forceMount: o grupo dos clientes some quando a
              // busca não acha ninguém, e este botão precisa continuar visível.
              <CommandGroup forceMount>
                <CommandItem
                  value="novo-cliente"
                  forceMount
                  onSelect={() => {
                    onNovoCliente(busca.trim());
                    setAberto(false);
                    setBusca("");
                  }}
                  className="font-semibold text-primary"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {busca.trim()
                    ? `Cadastrar novo cliente "${busca.trim()}"`
                    : "Cadastrar novo cliente"}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {!obrigatorio && (
                <CommandItem
                  value="sem-cliente"
                  keywords={[semClienteLabel]}
                  onSelect={() => {
                    onChange("");
                    setAberto(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value ? "opacity-0" : "opacity-100"}`} />
                  {semClienteLabel}
                </CommandItem>
              )}
              {clientes.map((c) => (
                // id no value: clientes homônimos teriam o mesmo value e o
                // cmdk trataria os dois como um só item. A busca usa só o nome.
                <CommandItem
                  key={c.id}
                  value={c.id}
                  keywords={[
                    c.nome,
                    ...(c.telefone ? [c.telefone, c.telefone.replace(/\D/g, "")] : []),
                    ...(c.documento ? [c.documento, c.documento.replace(/\D/g, "")] : []),
                  ]}
                  onSelect={() => {
                    onChange(c.id);
                    setAberto(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${c.id === value ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                  {c.telefone && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {c.telefone}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
