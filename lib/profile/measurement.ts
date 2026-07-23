import { z } from 'zod';
import type { Prisma } from '@prisma/client';

const optionalCentimeters = z.union([z.coerce.number().min(10).max(300), z.literal(''), z.null()]).optional().transform((value) => value === '' || value === undefined ? null : value);

export const measurementSchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Data inválida.'),
  weightKg: z.coerce.number().min(30).max(350),
  waistCm: optionalCentimeters,
  hipCm: optionalCentimeters,
  chestCm: optionalCentimeters,
  armCm: optionalCentimeters,
  thighCm: optionalCentimeters,
});

export function measurementData(input: z.infer<typeof measurementSchema>) {
  return {
    measuredAt: new Date(input.measuredAt + 'T00:00:00.000Z'),
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
