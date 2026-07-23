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

import { ensureExerciseCatalog, EXERCISE_CATALOG } from "./catalog";

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
});
