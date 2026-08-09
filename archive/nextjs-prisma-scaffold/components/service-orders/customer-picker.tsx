'use client';

import { useEffect, useState } from 'react';
import { Search, UserCheck, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CustomerRecord } from '@/lib/types';

export type NewCustomerData = {
  name: string;
  documentId: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
};

export const EMPTY_CUSTOMER: NewCustomerData = {
  name: '',
  documentId: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  notes: '',
};

export function CustomerPicker({
  selectedCustomer,
  onSelectExisting,
  onClearSelection,
  newCustomer,
  onChangeNewCustomer,
  mode,
  onChangeMode,
}: {
  selectedCustomer: CustomerRecord | null;
  onSelectExisting: (customer: CustomerRecord) => void;
  onClearSelection: () => void;
  newCustomer: NewCustomerData;
  onChangeNewCustomer: (data: NewCustomerData) => void;
  mode: 'existing' | 'new';
  onChangeMode: (mode: 'existing' | 'new') => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}`);
        const body = await response.json();
        setResults(body.customers ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChangeMode('existing')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
            mode === 'existing'
              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
              : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
          )}
        >
          <UserCheck className="size-4" /> Cliente existente
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('new')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
            mode === 'new'
              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
              : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
          )}
        >
          <UserPlus className="size-4" /> Novo cliente
        </button>
      </div>

      {mode === 'existing' ? (
        selectedCustomer ? (
          <div className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium text-white">{selectedCustomer.name}</p>
              <p className="text-sm text-slate-400">{selectedCustomer.phone}</p>
              {selectedCustomer.email && <p className="text-sm text-slate-500">{selectedCustomer.email}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClearSelection} type="button">
              <X />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
              className="pl-9"
            />
            {showResults && query.trim() && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1020] shadow-xl">
                {searching ? (
                  <p className="px-3 py-3 text-sm text-slate-500">Buscando...</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-500">Nenhum cliente encontrado.</p>
                ) : (
                  results.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        onSelectExisting(customer);
                        setShowResults(false);
                        setQuery('');
                      }}
                      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/5"
                    >
                      <p className="text-white">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.phone}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input
              value={newCustomer.name}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, name: event.target.value })}
              placeholder="Nome do cliente"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input
              value={newCustomer.documentId}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, documentId: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input
              value={newCustomer.phone}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, phone: event.target.value })}
              placeholder="(00) 00000-0000"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={newCustomer.whatsapp}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, whatsapp: event.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={newCustomer.email}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, email: event.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={newCustomer.address}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, address: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={newCustomer.city}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, city: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input
              value={newCustomer.state}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, state: event.target.value })}
              maxLength={2}
              placeholder="UF"
            />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={newCustomer.zipCode}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, zipCode: event.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={newCustomer.notes}
              onChange={(event) => onChangeNewCustomer({ ...newCustomer, notes: event.target.value })}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
