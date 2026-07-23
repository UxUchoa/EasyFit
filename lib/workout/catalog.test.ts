import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    exercise: { findMany: mocks.findMany, upsert: mocks.upsert },
    $transaction: mocks.transaction,
  },
}));

import { ensureExerciseCatalog, EXERCISE_CATALOG, STARTER_TEMPLATE } from "./catalog";

const records = EXERCISE_CATALOG.map((exercise, index) => ({ id: `exercise-${index}`, ...exercise }));

describe("exercise catalog loading", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.upsert.mockReset().mockResolvedValue({});
    mocks.transaction.mockReset().mockResolvedValue([]);
  });

  it("performs no writes when the catalog is already synchronized", async () => {
    mocks.findMany.mockResolvedValue(records);

    await expect(ensureExerciseCatalog()).resolves.toEqual(records);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledOnce();
  });

  it("writes only missing or changed exercises", async () => {
    mocks.findMany.mockResolvedValueOnce(records.slice(1)).mockResolvedValueOnce(records);

    await expect(ensureExerciseCatalog()).resolves.toEqual(records);
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: EXERCISE_CATALOG[0].name } }));
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("contains familiar exercises found in network gyms", () => {
    const names = new Set(EXERCISE_CATALOG.map((exercise) => exercise.name));
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(100);
    expect([...names]).toEqual(expect.arrayContaining(["Crucifixo máquina", "Leg press 45°", "Cadeira extensora", "Panturrilha em pé na máquina", "Puxada alta", "Remada baixa", "Rosca máquina", "Supino máquina", "Tríceps acima da cabeça no cabo", "Tríceps máquina", "Tríceps corda"]));
  });

  it("keeps the legacy starter template free of core exercises", () => {
    const coreNames = new Set<string>(EXERCISE_CATALOG.filter((exercise) => exercise.muscleGroup === "Core").map((exercise) => exercise.name));
    expect(STARTER_TEMPLATE.days.flat().every((name) => !coreNames.has(name))).toBe(true);
  });
});
