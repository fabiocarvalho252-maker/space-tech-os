'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEVICE_CONDITION_META } from '@/lib/service-order';
import type { DeviceCondition } from '@prisma/client';

export type DeviceFormData = {
  type: string;
  brand: string;
  model: string;
  color: string;
  imei1: string;
  imei2: string;
  serialNumber: string;
  storageCapacity: string;
  devicePassword: string;
  unlockPattern: string;
  condition: DeviceCondition;
  physicalNotes: string;
};

export const EMPTY_DEVICE: DeviceFormData = {
  type: '',
  brand: '',
  model: '',
  color: '',
  imei1: '',
  imei2: '',
  serialNumber: '',
  storageCapacity: '',
  devicePassword: '',
  unlockPattern: '',
  condition: 'BOM',
  physicalNotes: '',
};

const DEVICE_TYPES = ['Smartphone', 'Tablet', 'Notebook', 'Smartwatch', 'Console', 'Outro'];

export function DeviceFields({
  value,
  onChange,
}: {
  value: DeviceFormData;
  onChange: (data: DeviceFormData) => void;
}) {
  function set<K extends keyof DeviceFormData>(key: K, fieldValue: DeviceFormData[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Tipo de aparelho</Label>
        <Select value={value.type} onValueChange={(v) => set('type', v ?? '')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {DEVICE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <Input value={value.color} onChange={(event) => set('color', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Marca *</Label>
        <Input value={value.brand} onChange={(event) => set('brand', event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Modelo *</Label>
        <Input value={value.model} onChange={(event) => set('model', event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>IMEI 1</Label>
        <Input value={value.imei1} onChange={(event) => set('imei1', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>IMEI 2</Label>
        <Input value={value.imei2} onChange={(event) => set('imei2', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Número de série</Label>
        <Input value={value.serialNumber} onChange={(event) => set('serialNumber', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Capacidade de armazenamento</Label>
        <Input
          value={value.storageCapacity}
          onChange={(event) => set('storageCapacity', event.target.value)}
          placeholder="Ex.: 128GB"
        />
      </div>
      <div className="space-y-2">
        <Label>Senha do aparelho</Label>
        <Input value={value.devicePassword} onChange={(event) => set('devicePassword', event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Padrão de desbloqueio</Label>
        <Input
          value={value.unlockPattern}
          onChange={(event) => set('unlockPattern', event.target.value)}
          placeholder="Descreva o padrão"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Estado físico</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.entries(DEVICE_CONDITION_META) as [DeviceCondition, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set('condition', key)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                value.condition === key
                  ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Observações sobre o estado físico</Label>
        <Textarea
          value={value.physicalNotes}
          onChange={(event) => set('physicalNotes', event.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
