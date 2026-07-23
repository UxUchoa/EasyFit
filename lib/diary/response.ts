type NumericValue = number | string | { toString(): string };

type RevisionRecord = {
  id: string;
  previousQuantity: NumericValue;
  nextQuantity: NumericValue;
  reason: string | null;
  correctedAt: Date;
};

type EntryRecord = {
  id: string;
  updatedAt: Date;
  kind: "PLANNED" | "CONSUMED";
  quantity: NumericValue;
  unit: string;
  snapshotName: string;
  snapshotBrand: string | null;
  snapshotCalories: NumericValue;
  snapshotProtein: NumericValue | null;
  snapshotCarbohydrate: NumericValue | null;
  snapshotFat: NumericValue | null;
  macrosComplete: boolean;
};

export function diaryEntryResponse(entry: EntryRecord, revisions: RevisionRecord[] = []) {
  return {
    id: entry.id,
    updatedAt: entry.updatedAt.toISOString(),
    kind: entry.kind,
    name: entry.snapshotName,
    brand: entry.snapshotBrand,
    quantity: Number(entry.quantity),
    unit: entry.unit,
    calories: Number(entry.snapshotCalories),
    proteinGrams: entry.snapshotProtein === null ? null : Number(entry.snapshotProtein),
    carbohydrateGrams: entry.snapshotCarbohydrate === null ? null : Number(entry.snapshotCarbohydrate),
    fatGrams: entry.snapshotFat === null ? null : Number(entry.snapshotFat),
    macrosComplete: entry.macrosComplete,
    revisions: revisions.map((revision) => ({
      id: revision.id,
      previousQuantity: Number(revision.previousQuantity),
      nextQuantity: Number(revision.nextQuantity),
      reason: revision.reason,
      correctedAt: revision.correctedAt.toISOString(),
    })),
  };
}
