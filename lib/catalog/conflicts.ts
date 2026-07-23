export type ConflictFood = { id: string; name: string; brand: string | null; barcode: string | null; baseUnit: string; source: string };

function normalized(value: string | null) {
  return (value ?? '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function foodConflictKey(food: Pick<ConflictFood, 'barcode' | 'name' | 'brand' | 'baseUnit'>) {
  if (food.barcode) return `gtin:${food.barcode}`;
  return `name:${normalized(food.name)}|brand:${normalized(food.brand)}|unit:${normalized(food.baseUnit)}`;
}

export function foodConflictGroups<T extends ConflictFood>(foods: T[]) {
  const grouped = new Map<string, T[]>();
  for (const food of foods) {
    const key = foodConflictKey(food);
    grouped.set(key, [...(grouped.get(key) ?? []), food]);
  }
  return new Map([...grouped].filter(([, candidates]) => new Set(candidates.map((candidate) => candidate.source)).size > 1));
}

