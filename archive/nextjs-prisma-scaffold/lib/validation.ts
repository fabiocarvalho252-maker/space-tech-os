import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome completo.'),
  documentId: z.string().trim().optional().nullable(),
  phone: z.string().trim().min(8, 'Informe um telefone válido.'),
  whatsapp: z.string().trim().optional().nullable(),
  email: z.string().trim().email('Email inválido.').optional().nullable().or(z.literal('')),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  zipCode: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const deviceSchema = z.object({
  type: z.string().trim().optional().nullable(),
  brand: z.string().trim().min(1, 'Informe a marca.'),
  model: z.string().trim().min(1, 'Informe o modelo.'),
  color: z.string().trim().optional().nullable(),
  imei1: z.string().trim().optional().nullable(),
  imei2: z.string().trim().optional().nullable(),
  serialNumber: z.string().trim().optional().nullable(),
  storageCapacity: z.string().trim().optional().nullable(),
  devicePassword: z.string().trim().optional().nullable(),
  unlockPattern: z.string().trim().optional().nullable(),
  condition: z.enum(['EXCELENTE', 'BOM', 'REGULAR', 'DANIFICADO']).default('BOM'),
  physicalNotes: z.string().trim().optional().nullable(),
});

export const checklistItemSchema = z.object({
  category: z.enum(['CONDICAO_APARELHO', 'FUNCIONAMENTO', 'ACESSORIOS']),
  label: z.string().trim().min(1),
  checked: z.boolean().default(false),
});

export const serviceOrderCreateSchema = z.object({
  customerId: z.string().trim().optional().nullable(),
  customer: customerSchema.optional().nullable(),
  device: deviceSchema,
  reportedIssue: z.string().trim().min(1, 'Descreva o defeito relatado.'),
  diagnosis: z.string().trim().optional().nullable(),
  serviceToPerform: z.string().trim().optional().nullable(),
  internalNotes: z.string().trim().optional().nullable(),
  estimatedDeliveryDate: z.string().trim().optional().nullable(),
  termsAccepted: z.boolean().default(false),
  checklist: z.array(checklistItemSchema).default([]),
}).refine((data) => data.customerId || data.customer, {
  message: 'Selecione um cliente existente ou informe os dados de um novo cliente.',
  path: ['customerId'],
});

export const serviceOrderUpdateSchema = z.object({
  customerId: z.string().trim().optional(),
  customer: customerSchema.partial().optional(),
  device: deviceSchema.partial().optional(),
  reportedIssue: z.string().trim().min(1).optional(),
  diagnosis: z.string().trim().optional().nullable(),
  serviceToPerform: z.string().trim().optional().nullable(),
  internalNotes: z.string().trim().optional().nullable(),
  estimatedDeliveryDate: z.string().trim().optional().nullable(),
  deliveredAt: z.string().trim().optional().nullable(),
  termsAccepted: z.boolean().optional(),
  customerSignature: z.string().trim().optional().nullable(),
  technicianSignature: z.string().trim().optional().nullable(),
  discountValueCents: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  surchargeValueCents: z.number().int().min(0).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum([
    'ABERTA',
    'AGUARDANDO_DIAGNOSTICO',
    'EM_ANALISE',
    'AGUARDANDO_APROVACAO',
    'APROVADA',
    'AGUARDANDO_PECA',
    'EM_REPARO',
    'EM_TESTES',
    'PRONTA',
    'ENTREGUE',
    'CANCELADA',
  ]),
  note: z.string().trim().optional().nullable(),
});

export const approvalSchema = z.object({
  decision: z.enum(['APROVADO', 'RECUSADO']),
  note: z.string().trim().optional().nullable(),
  approvedBy: z.string().trim().optional().nullable(),
});

export const itemSchema = z.object({
  type: z.enum(['SERVICO', 'MAO_DE_OBRA']).default('SERVICO'),
  description: z.string().trim().min(1, 'Descreva o item.'),
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero.'),
  unitPriceCents: z.number().int().min(0, 'Valor não pode ser negativo.'),
  discountCents: z.number().int().min(0).default(0),
});

export const partItemSchema = z.object({
  partId: z.string().trim().min(1, 'Selecione uma peça.'),
  quantity: z.number().int().min(1, 'Quantidade deve ser maior que zero.'),
});

export const photoSchema = z.object({
  category: z.enum([
    'FRENTE',
    'TRASEIRA',
    'LATERAL_DIREITA',
    'LATERAL_ESQUERDA',
    'PARTE_SUPERIOR',
    'PARTE_INFERIOR',
    'CAMERA',
    'IMEI',
    'OUTRA',
  ]),
  dataUrl: z.string().trim().refine((value) => value.startsWith('data:image/'), {
    message: 'Arquivo de imagem inválido.',
  }),
  label: z.string().trim().optional().nullable(),
});

export const partSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da peça.'),
  sku: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  costPriceCents: z.number().int().min(0).default(0),
  salePriceCents: z.number().int().min(0).default(0),
  stockQuantity: z.number().int().min(0).default(0),
  minStockQuantity: z.number().int().min(0).default(0),
});
