export type OfflineMutationStatus = 'PENDING' | 'CONFLICT' | 'AUTH_REQUIRED' | 'FAILED';

export type OfflineConflict = {
  entryId: string;
  server: { quantity: number; updatedAt: string };
  client: { quantity: number };
};

export function classifySyncResponse(status: number, hasConflict: boolean): OfflineMutationStatus | 'COMPLETE' {
  if (status >= 200 && status < 300) return 'COMPLETE';
  if (status === 409 && hasConflict) return 'CONFLICT';
  if (status === 401) return 'AUTH_REQUIRED';
  return 'FAILED';
}

export function bodyForLocalConflictResolution(body: Record<string, unknown>, conflict: OfflineConflict) {
  return { ...body, expectedUpdatedAt: conflict.server.updatedAt };
}

