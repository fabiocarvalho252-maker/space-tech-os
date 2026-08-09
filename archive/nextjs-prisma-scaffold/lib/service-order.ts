import type {
  BudgetStatus,
  ChecklistCategory,
  DeviceCondition,
  ServiceOrderPhotoCategory,
  ServiceOrderStatus,
} from '@prisma/client';

export const SERVICE_ORDER_STATUS_FLOW: ServiceOrderStatus[] = [
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
];

export const STATUS_META: Record<ServiceOrderStatus, { label: string; badgeClass: string }> = {
  ABERTA: { label: 'Aberta', badgeClass: 'border-slate-400/30 bg-slate-400/10 text-slate-300' },
  AGUARDANDO_DIAGNOSTICO: { label: 'Aguardando diagnóstico', badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  EM_ANALISE: { label: 'Em análise', badgeClass: 'border-blue-400/30 bg-blue-400/10 text-blue-300' },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', badgeClass: 'border-purple-400/30 bg-purple-400/10 text-purple-300' },
  APROVADA: { label: 'Aprovada', badgeClass: 'border-teal-400/30 bg-teal-400/10 text-teal-300' },
  AGUARDANDO_PECA: { label: 'Aguardando peça', badgeClass: 'border-orange-400/30 bg-orange-400/10 text-orange-300' },
  EM_REPARO: { label: 'Em reparo', badgeClass: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300' },
  EM_TESTES: { label: 'Em testes', badgeClass: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' },
  PRONTA: { label: 'Pronta', badgeClass: 'border-green-400/30 bg-green-400/10 text-green-300' },
  ENTREGUE: { label: 'Entregue', badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  CANCELADA: { label: 'Cancelada', badgeClass: 'border-red-400/30 bg-red-400/10 text-red-300' },
};

export const STATUS_FILTERS: { value: ServiceOrderStatus | 'TODAS'; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'AGUARDANDO_DIAGNOSTICO', label: 'Aguardando diagnóstico' },
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando aprovação' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando peça' },
  { value: 'EM_REPARO', label: 'Em reparo' },
  { value: 'PRONTA', label: 'Pronta' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export const ALL_STATUSES: ServiceOrderStatus[] = [...SERVICE_ORDER_STATUS_FLOW, 'CANCELADA'];

export const BUDGET_STATUS_META: Record<BudgetStatus, { label: string; badgeClass: string }> = {
  AGUARDANDO: { label: 'Aguardando aprovação', badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  APROVADO: { label: 'Aprovado', badgeClass: 'border-green-400/30 bg-green-400/10 text-green-300' },
  RECUSADO: { label: 'Recusado', badgeClass: 'border-red-400/30 bg-red-400/10 text-red-300' },
};

export const DEVICE_CONDITION_META: Record<DeviceCondition, string> = {
  EXCELENTE: 'Excelente',
  BOM: 'Bom',
  REGULAR: 'Regular',
  DANIFICADO: 'Danificado',
};

export const PHOTO_CATEGORY_META: Record<ServiceOrderPhotoCategory, string> = {
  FRENTE: 'Frente',
  TRASEIRA: 'Traseira',
  LATERAL_DIREITA: 'Lateral direita',
  LATERAL_ESQUERDA: 'Lateral esquerda',
  PARTE_SUPERIOR: 'Parte superior',
  PARTE_INFERIOR: 'Parte inferior',
  CAMERA: 'Câmera',
  IMEI: 'IMEI',
  OUTRA: 'Outra',
};

export const CHECKLIST_CATEGORY_META: Record<ChecklistCategory, string> = {
  CONDICAO_APARELHO: 'Condição do aparelho',
  FUNCIONAMENTO: 'Funcionamento',
  ACESSORIOS: 'Acessórios',
};

export const DEFAULT_CHECKLIST: Record<ChecklistCategory, string[]> = {
  CONDICAO_APARELHO: [
    'Tela trincada',
    'Tela quebrada',
    'Tampa traseira danificada',
    'Câmera danificada',
    'Botões danificados',
    'Conector de carga danificado',
    'Alto-falante com problema',
    'Microfone com problema',
    'Aparelho molhado',
    'Marcas de uso',
    'Outros',
  ],
  FUNCIONAMENTO: [
    'Liga',
    'Desliga',
    'Touch funcionando',
    'Face ID / biometria',
    'Wi-Fi',
    'Bluetooth',
    'Câmera frontal',
    'Câmera traseira',
    'Flash',
    'Microfone',
    'Alto-falante',
    'Vibração',
    'Carregamento',
  ],
  ACESSORIOS: [
    'Aparelho',
    'Carregador',
    'Cabo',
    'Capinha',
    'Película',
    'Chip',
    'Cartão de memória',
    'Outros',
  ],
};

type TotalsInput = {
  items: { type: 'SERVICO' | 'MAO_DE_OBRA'; subtotalCents: number }[];
  parts: { subtotalCents: number }[];
  discountValueCents: number;
  discountPercent: number;
  surchargeValueCents: number;
};

export function calculateServiceOrderTotals(input: TotalsInput) {
  const servicesTotalCents = input.items
    .filter((item) => item.type === 'SERVICO')
    .reduce((sum, item) => sum + item.subtotalCents, 0);
  const laborTotalCents = input.items
    .filter((item) => item.type === 'MAO_DE_OBRA')
    .reduce((sum, item) => sum + item.subtotalCents, 0);
  const partsTotalCents = input.parts.reduce((sum, part) => sum + part.subtotalCents, 0);

  const grossTotal = servicesTotalCents + laborTotalCents + partsTotalCents;
  const percentDiscountCents = Math.round((grossTotal * (input.discountPercent || 0)) / 100);
  const totalDiscountCents = Math.max(0, input.discountValueCents + percentDiscountCents);
  const totalValueCents = Math.max(0, grossTotal - totalDiscountCents + input.surchargeValueCents);

  return {
    servicesTotalCents,
    laborTotalCents,
    partsTotalCents,
    totalValueCents,
  };
}

export function buildWhatsAppLink(params: {
  phone: string;
  customerName: string;
  osNumber: number;
  status: ServiceOrderStatus;
  deviceLabel: string;
  totalValueCents: number;
}) {
  const digits = params.phone.replace(/\D/g, '');
  const phoneWithCountry = digits.startsWith('55') ? digits : `55${digits}`;

  const message = [
    `Olá, ${params.customerName}!`,
    `Sua Ordem de Serviço nº ${params.osNumber.toString().padStart(6, '0')} da SPACE TECH está com o status: ${STATUS_META[params.status].label}.`,
    `Aparelho: ${params.deviceLabel}.`,
    `Valor: ${(params.totalValueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
  ].join('\n');

  const url = new URL(`https://wa.me/${phoneWithCountry}`);
  url.searchParams.set('text', message);
  return url.toString();
}
