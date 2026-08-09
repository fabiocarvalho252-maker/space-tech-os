'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resizeImageToDataUrl } from '@/lib/image';
import { PHOTO_CATEGORY_META } from '@/lib/service-order';
import type { ServiceOrderDetail } from '@/lib/types';
import type { ServiceOrderPhotoCategory } from '@prisma/client';

export function PhotosEditor({ serviceOrder }: { serviceOrder: ServiceOrderDetail }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ServiceOrderPhotoCategory>('FRENTE');
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, dataUrl, label: label || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível enviar a foto.');
      }
      toast.success('Foto adicionada.');
      setLabel('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(photoId: string) {
    if (!window.confirm('Remover esta foto?')) return;
    try {
      const response = await fetch(`/api/service-orders/${serviceOrder.id}/photos/${photoId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível remover a foto.');
      }
      toast.success('Foto removida.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover foto.');
    }
  }

  return (
    <div className="space-y-4">
      {serviceOrder.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {serviceOrder.photos.map((photo) => (
            <div key={photo.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt={photo.label || photo.category}
                className="aspect-square w-full rounded-lg border border-white/10 object-cover"
              />
              <p className="mt-1 truncate text-xs text-slate-500">{PHOTO_CATEGORY_META[photo.category]}</p>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="absolute top-1 right-1 opacity-0 transition group-hover:opacity-100"
                onClick={() => remove(photo.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as ServiceOrderPhotoCategory)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PHOTO_CATEGORY_META) as [ServiceOrderPhotoCategory, string][]).map(([value, name]) => (
                <SelectItem key={value} value={value}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Legenda (opcional)</Label>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} className="w-48" />
        </div>
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          Enviar foto
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
      </div>
    </div>
  );
}
