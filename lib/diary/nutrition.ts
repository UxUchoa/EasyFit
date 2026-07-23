export type Nutrients = {
  calories: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
};

export type Portion = {
  name: string;
  unit: string;
  quantityInBaseUnit: number;
};

export type FoodForCalculation = Nutrients & {
  baseQuantity: number;
  baseUnit: string;
  portions?: Portion[];
};

const UNIT_FACTORS: Record<string, { dimension: "mass" | "volume"; toBase: number }> = {
  g: { dimension: "mass", toBase: 1 },
  kg: { dimension: "mass", toBase: 1000 },
  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
};

function normalizeUnit(unit: string) {
  return unit.trim().toLocaleLowerCase("pt-BR");
}

export function quantityInFoodBaseUnit(
  quantity: number,
  requestedUnit: string,
  food: Pick<FoodForCalculation, "baseUnit" | "portions">,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const requested = normalizeUnit(requestedUnit);
  const base = normalizeUnit(food.baseUnit);
  if (requested === base) return quantity;

  const requestedMetric = UNIT_FACTORS[requested];
  const baseMetric = UNIT_FACTORS[base];
  if (requestedMetric && baseMetric && requestedMetric.dimension === baseMetric.dimension) {
    return (quantity * requestedMetric.toBase) / baseMetric.toBase;
  }

  const portion = food.portions?.find(
    (candidate) => normalizeUnit(candidate.unit) === requested || normalizeUnit(candidate.name) === requested,
  );
  return portion ? quantity * portion.quantityInBaseUnit : null;
}

export function calculateEntryNutrition(
  food: FoodForCalculation,
  quantity: number,
  requestedUnit: string,
): Nutrients | null {
  const quantityInBase = quantityInFoodBaseUnit(quantity, requestedUnit, food);
  if (quantityInBase === null || food.baseQuantity <= 0) return null;
  const factor = quantityInBase / food.baseQuantity;
  return {
    calories: food.calories * factor,
    proteinGrams: food.proteinGrams === null ? null : food.proteinGrams * factor,
    carbohydrateGrams:
      food.carbohydrateGrams === null ? null : food.carbohydrateGrams * factor,
    fatGrams: food.fatGrams === null ? null : food.fatGrams * factor,
  };
}

export function aggregateNutrition(entries: Nutrients[]) {
  const macrosComplete = entries.every(
    (entry) =>
      entry.proteinGrams !== null &&
      entry.carbohydrateGrams !== null &&
      entry.fatGrams !== null,
  );
  return {
    calories: entries.reduce((sum, entry) => sum + entry.calories, 0),
    proteinGrams: entries.reduce((sum, entry) => sum + (entry.proteinGrams ?? 0), 0),
    carbohydrateGrams: entries.reduce(
      (sum, entry) => sum + (entry.carbohydrateGrams ?? 0),
      0,
    ),
    fatGrams: entries.reduce((sum, entry) => sum + (entry.fatGrams ?? 0), 0),
    macrosComplete,
  };
}
