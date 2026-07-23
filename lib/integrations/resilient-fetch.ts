import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { providerRetryDelayMs, shouldRetryProviderStatus, type ProviderPolicy } from './provider-policy';

const QUOTA_WINDOW_MS = 60_000;

export class ProviderGateError extends Error {
  constructor(public readonly reason: 'circuit-open' | 'quota-exceeded', public readonly retryAfterSeconds: number) {
    super(reason);
    this.name = 'ProviderGateError';
  }
}

async function serializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new Error('Serializable transaction retry exhausted.');
}

async function acquireProviderRequest(provider: string, policy: ProviderPolicy) {
  return serializable(async (tx) => {
    const now = new Date();
    const current = await tx.externalProviderState.findUnique({ where: { provider } });
    if (current?.circuitOpenUntil && current.circuitOpenUntil > now) {
      throw new ProviderGateError('circuit-open', Math.max(1, Math.ceil((current.circuitOpenUntil.getTime() - now.getTime()) / 1000)));
    }
    const windowExpired = !current || now.getTime() - current.quotaWindowStartedAt.getTime() >= QUOTA_WINDOW_MS;
    const requestCount = windowExpired ? 0 : current.requestCount;
    if (requestCount >= policy.quotaPerMinute) {
      const resetAt = current!.quotaWindowStartedAt.getTime() + QUOTA_WINDOW_MS;
      throw new ProviderGateError('quota-exceeded', Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)));
    }
    await tx.externalProviderState.upsert({
      where: { provider },
      create: { provider, quotaWindowStartedAt: now, requestCount: 1 },
      update: {
        quotaWindowStartedAt: windowExpired ? now : current!.quotaWindowStartedAt,
        requestCount: requestCount + 1,
        circuitOpenUntil: null,
      },
    });
  });
}

async function recordProviderSuccess(provider: string) {
  await db.externalProviderState.updateMany({ where: { provider }, data: { consecutiveFailures: 0, circuitOpenUntil: null } });
}

async function recordProviderFailure(provider: string, policy: ProviderPolicy) {
  await serializable(async (tx) => {
    const now = new Date();
    const current = await tx.externalProviderState.findUnique({ where: { provider } });
    if (!current) return;
    const failures = current.consecutiveFailures + 1;
    await tx.externalProviderState.update({
      where: { provider },
      data: {
        consecutiveFailures: failures,
        circuitOpenUntil: failures >= policy.circuitFailureThreshold ? new Date(now.getTime() + policy.circuitResetMs) : null,
      },
    });
  });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function resilientProviderFetch(provider: string, url: string, init: RequestInit, policy: ProviderPolicy) {
  await acquireProviderRequest(provider, policy);
  let lastResponse: Response | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(policy.timeoutMs) });
      if (!shouldRetryProviderStatus(response.status)) {
        await recordProviderSuccess(provider);
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < policy.maxAttempts) await delay(providerRetryDelayMs(attempt, policy.baseDelayMs));
  }

  await recordProviderFailure(provider, policy);
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error('External provider request failed.');
}
