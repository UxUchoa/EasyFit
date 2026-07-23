import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { parseLogicalDate } from '@/lib/diary/date';

const optionalCentimeters = z.union([z.coerce.number().min(10).max(300), z.literal(''), z.null()]).optional().transform((value) => value === '' || value === undefined ? null : value);

export const measurementSchema = z.object({
  measuredAt: z.string().refine((value) => parseLogicalDate(value) !== null, 'Data inválida.'),
  weightKg: z.coerce.number().min(30).max(350),
  waistCm: optionalCentimeters,
  hipCm: optionalCentimeters,
  chestCm: optionalCentimeters,
  armCm: optionalCentimeters,
  thighCm: optionalCentimeters,
});

export function measurementSchemaThrough(maximumDate: string) {
  return measurementSchema.refine(
    (value) => value.measuredAt <= maximumDate,
    { message: 'A data da medição não pode estar no futuro.', path: ['measuredAt'] },
  );
}

export function measurementData(input: z.infer<typeof measurementSchema>) {
  return {
    measuredAt: parseLogicalDate(input.measuredAt)!,
    weightKg: input.weightKg,
    waistCm: input.waistCm,
    hipCm: input.hipCm,
    chestCm: input.chestCm,
    armCm: input.armCm,
    thighCm: input.thighCm,
  };
}

export async function syncCurrentWeight(transaction: Prisma.TransactionClient, userId: string) {
  const latest = await transaction.bodyMeasurement.findFirst({
    where: { userId },
    orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
    select: { weightKg: true },
  });
  if (latest) await transaction.profile.updateMany({ where: { userId }, data: { currentWeightKg: latest.weightKg } });
}
