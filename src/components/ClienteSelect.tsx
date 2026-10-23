import { useState } from "react";
import { Check, Search } from "lucide-react";
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

// Seletor de cliente com busca por nome — o <select> nativo obrigava a rolar
// a lista inteira de clientes para achar um.
export function ClienteSelect({
  clientes,
  value,
  onChange,
  semClienteLabel = "Sem cliente vinculado",
}: {
  clientes: { id: string; nome: string }[];
  value: string;
  onChange: (id: string) => void;
  /** Texto da opção sem cliente (OS: "Sem cliente vinculado"; PDV: "Consumidor final"). */
  semClienteLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionado = clientes.find((c) => c.id === value);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selecionado?.nome ?? semClienteLabel}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(_, busca, palavras) =>
            normalizar((palavras ?? []).join(" ")).includes(normalizar(busca)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Digite o nome do cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
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
              {clientes.map((c) => (
                // id no value: clientes homônimos teriam o mesmo value e o
                // cmdk trataria os dois como um só item. A busca usa só o nome.
                <CommandItem
                  key={c.id}
                  value={c.id}
                  keywords={[c.nome]}
                  onSelect={() => {
                    onChange(c.id);
                    setAberto(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${c.id === value ? "opacity-100" : "opacity-0"}`}
                  />
                  {c.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
