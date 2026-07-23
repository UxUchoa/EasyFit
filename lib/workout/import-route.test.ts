import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  auditCreate: vi.fn(),
  ensureCatalog: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () => ({ userId: "user-1" }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    exercise: { findMany: mocks.findMany },
    auditEvent: { create: mocks.auditCreate },
  },
}));
vi.mock("@/lib/workout/catalog", () => ({
  ensureExerciseCatalog: mocks.ensureCatalog,
}));

import { POST as importWorkout } from "@/app/api/workout-plans/import/route";

describe("workout import route", () => {
  beforeEach(() => {
    mocks.ensureCatalog.mockReset().mockResolvedValue(undefined);
    mocks.findMany.mockReset().mockResolvedValue([{ id: "exercise-1", name: "Supino reto" }]);
    mocks.auditCreate.mockReset().mockResolvedValue({ id: "audit-1" });
  });

  it("returns a review proposal without creating a workout plan", async () => {
    const content = JSON.stringify({
      name: "Treino importado",
      division: "ABC",
      days: [{ label: "Peito e tríceps", exercises: [{ exercise: "Supino reto", sets: 4, reps: "8-10", restSeconds: 90 }] }],
    });
    const request = new NextRequest("http://localhost:3000/api/workout-plans/import", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "treino.json", mimeType: "application/json", content }),
    });

    const response = await importWorkout(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.proposal).toMatchObject({
      name: "Treino importado",
      division: "ABC",
      dayLabels: ["Peito e tríceps"],
      exercises: [{ exerciseId: "exercise-1", targetSets: 4, targetReps: "8-10", restSeconds: 90 }],
    });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rejects names that are not present in the local catalog", async () => {
    const content = JSON.stringify({ name: "Plano", days: [{ exercises: [{ exercise: "Exercício inventado" }] }] });
    const request = new NextRequest("http://localhost:3000/api/workout-plans/import", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "treino.json", mimeType: "application/json", content }),
    });

    const response = await importWorkout(request);
    const result = await response.json();

    expect(response.status).toBe(422);
    expect(result.unresolved).toEqual(["Exercício inventado"]);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
