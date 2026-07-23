import { z } from 'zod';

export const IMPORT_PARSER_VERSION = 'easyfit-json-2026-07-22.1';
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export const importItemInputSchema = z.object({
  food: z.string().trim().min(1, 'Informe o alimento.').max(180),
  quantity: z.number().positive().max(100_000).optional(),
  unit: z.string().trim().min(1).max(24).optional(),
}).strict().superRefine((item, context) => {
  if ((item.quantity === undefined) !== (item.unit === undefined)) {
    context.addIssue({ code: 'custom', message: 'Quantidade e unidade devem ser informadas juntas.' });
  }
});

export const dietImportSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da dieta.').max(120),
  days: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    meals: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      items: z.array(importItemInputSchema).min(1).max(100),
    }).strict()).min(1).max(12),
  }).strict()).min(1).max(31),
}).strict();

export type ParsedDietImport = z.infer<typeof dietImportSchema>;
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'REVIEW' | 'FAILED' | 'COMPLETED' | 'CANCELLED';

const transitions: Record<ImportStatus, readonly ImportStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['REVIEW', 'FAILED', 'CANCELLED'],
  REVIEW: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
  FAILED: ['PROCESSING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionImport(from: ImportStatus, to: ImportStatus) {
  return transitions[from].includes(to);
}

export function assertImportTransition(from: ImportStatus, to: ImportStatus) {
  if (!canTransitionImport(from, to)) throw new Error(`Transição de ${from} para ${to} não permitida.`);
}

export function validateJsonUpload(input: { filename: string; mimeType: string; content: string }) {
  const filename = input.filename.trim();
  if (!filename.toLowerCase().endsWith('.json')) throw new Error('Use um arquivo com extensão .json.');
  if (!['application/json', 'text/json'].includes(input.mimeType.toLowerCase())) throw new Error('O tipo do arquivo deve ser application/json.');
  const byteSize = Buffer.byteLength(input.content, 'utf8');
  if (byteSize === 0) throw new Error('O arquivo está vazio.');
  if (byteSize > MAX_IMPORT_BYTES) throw new Error('O arquivo JSON deve ter no máximo 2 MB.');
  const signature = input.content.trimStart()[0];
  if (signature !== '{') throw new Error('A assinatura do arquivo não corresponde a um objeto JSON.');
  let decoded: unknown;
  try { decoded = JSON.parse(input.content); } catch { throw new Error('O conteúdo não é um JSON válido.'); }
  const parsed = dietImportSchema.safeParse(decoded);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'A estrutura da dieta é inválida.');
  return { data: parsed.data, byteSize };
}

export function flattenImportItems(data: ParsedDietImport) {
  let position = 0;
  return data.days.flatMap((day, dayIndex) => day.meals.flatMap((meal, mealIndex) => meal.items.map((item, itemIndex) => ({
    position: position++,
    dayLabel: day.label,
    mealLabel: meal.name,
    extractedName: item.food,
    extractedQuantity: item.quantity ?? null,
    extractedUnit: item.unit ?? null,
    sourcePointer: `$.days[${dayIndex}].meals[${mealIndex}].items[${itemIndex}]`,
    confidence: item.quantity !== undefined && item.unit !== undefined ? 1 : 0.55,
  }))));
}

type ReviewableItem = {
  decision: 'PENDING' | 'KEEP' | 'REPLACE' | 'IGNORE' | 'MANUAL';
  extractedName: string;
  extractedQuantity: unknown;
  extractedUnit: string | null;
  reviewedName: string | null;
  reviewedQuantity: unknown;
  reviewedUnit: string | null;
};

export function reviewBlockingReason(item: ReviewableItem) {
  if (item.decision === 'IGNORE') return null;
  if (item.decision === 'PENDING') return 'Escolha como tratar o item.';
  const name = item.reviewedName ?? item.extractedName;
  const quantity = item.reviewedQuantity ?? item.extractedQuantity;
  const unit = item.reviewedUnit ?? item.extractedUnit;
  if (!name.trim()) return 'Informe o alimento.';
  if (quantity === null || quantity === undefined || Number(quantity) <= 0) return 'Informe uma quantidade válida.';
  if (!unit?.trim()) return 'Informe a unidade.';
  return null;
}

