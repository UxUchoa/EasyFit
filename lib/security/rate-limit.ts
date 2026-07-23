import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { nextRateLimitState, rateLimitDecision } from './rate-limit-policy';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function consumeLoginAttempt(keyHash: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const now = new Date();
        const current = await tx.rateLimitBucket.findUnique({ where: { keyHash } });
        const next = nextRateLimitState(current, now, WINDOW_MS);
        const state = await tx.rateLimitBucket.upsert({ where: { keyHash }, create: { keyHash, ...next }, update: next });
        return rateLimitDecision(state, now, MAX_ATTEMPTS);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
}

export async function clearLoginAttempts(keyHash: string) {
  await db.rateLimitBucket.deleteMany({ where: { keyHash } });
}
