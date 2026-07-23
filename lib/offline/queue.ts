import type { OfflineConflict, OfflineMutationStatus } from './domain';

const DATABASE_NAME = 'easyfit-offline-v1';
const STORE_NAME = 'mutations';
export const OFFLINE_QUEUE_EVENT = 'easyfit-offline-queue';

export type OfflineMutation = {
  id: string;
  userScope: string;
  url: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  idempotencyKey: string | null;
  label: string;
  createdAt: string;
  status: OfflineMutationStatus;
  conflict: OfflineConflict | null;
  error: string | null;
};

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento local.'));
  });
}

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('userScope', 'userScope');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Fila offline indisponível.'));
  });
}

function notifyQueueChanged() {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

export async function putOfflineMutation(mutation: OfflineMutation) {
  const db = await database();
  await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(mutation));
  db.close(); notifyQueueChanged();
}

export async function enqueueOfflineMutation(input: Omit<OfflineMutation, 'id' | 'createdAt' | 'status' | 'conflict' | 'error'>) {
  const mutation: OfflineMutation = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'PENDING', conflict: null, error: null };
  await putOfflineMutation(mutation);
  return mutation;
}

export async function listOfflineMutations(userScope: string) {
  const db = await database();
  const items = await requestResult(db.transaction(STORE_NAME).objectStore(STORE_NAME).index('userScope').getAll(userScope)) as OfflineMutation[];
  db.close();
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteOfflineMutation(id: string) {
  const db = await database();
  await requestResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
  db.close(); notifyQueueChanged();
}

export async function clearOfflineMutations(userScope: string) {
  const items = await listOfflineMutations(userScope);
  const db = await database(); const transaction = db.transaction(STORE_NAME, 'readwrite'); const store = transaction.objectStore(STORE_NAME);
  await Promise.all(items.map((item) => requestResult(store.delete(item.id))));
  db.close(); notifyQueueChanged();
}
