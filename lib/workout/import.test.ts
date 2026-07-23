import { describe, expect, it } from "vitest";
import { buildWorkoutImportProposal, inferredWorkoutDivision, validateWorkoutJsonUpload } from "./import";

describe("workout JSON import", () => {
  it("validates, matches normalized exercise names and preserves training parameters", () => {
    const content = JSON.stringify({
      name: "Treino ABC",
      days: [{ label: "Peito", exercises: [{ exercise: "Supino reto", sets: 4, reps: "8-10", restSeconds: 90 }] }],
    });
    const parsed = validateWorkoutJsonUpload({ filename: "treino.json", mimeType: "application/json", content });
    const result = buildWorkoutImportProposal(parsed.data, [{ id: "exercise-1", name: "Supino reto" }]);
    expect(result.unresolved).toEqual([]);
    expect(result.proposal.exercises[0]).toMatchObject({ exerciseId: "exercise-1", targetSets: 4, targetReps: "8-10", restSeconds: 90 });
  });

  it("reports exercises that do not exist in the catalog", () => {
    const content = JSON.stringify({ name: "Plano", days: [{ exercises: [{ exercise: "Exercício inexistente" }] }] });
    const parsed = validateWorkoutJsonUpload({ filename: "treino.json", mimeType: "application/json", content });
    expect(buildWorkoutImportProposal(parsed.data, []).unresolved).toEqual(["Exercício inexistente"]);
  });

  it("infers common training divisions from the number of days", () => {
    expect(inferredWorkoutDivision(1)).toBe("FULL_BODY");
    expect(inferredWorkoutDivision(3)).toBe("ABC");
    expect(inferredWorkoutDivision(6)).toBe("CUSTOM");
  });
});
