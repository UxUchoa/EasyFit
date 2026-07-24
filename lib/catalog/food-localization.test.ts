import { describe, expect, it } from "vitest";
import { localizedFoodName, translateUsdaDescriptionToPtBr } from "./food-localization";

describe("USDA food localization", () => {
  it("translates common egg preparations into natural Brazilian Portuguese", () => {
    expect(translateUsdaDescriptionToPtBr("Egg, whole, cooked, hard-boiled")).toBe("Ovo inteiro cozido");
    expect(translateUsdaDescriptionToPtBr("Egg, whole, cooked, scrambled")).toBe("Ovo inteiro mexido");
  });

  it("translates known foods and preserves non-USDA catalog names", () => {
    expect(localizedFoodName("Bread, white, commercially prepared", "USDA_FDC")).toBe("Pão branco industrializado");
    expect(localizedFoodName("Ovo inteiro cozido", "USDA_FDC")).toBe("Ovo inteiro cozido");
    expect(localizedFoodName("Ovo caipira", "PRIVATE")).toBe("Ovo caipira");
  });

  it("never exposes an unknown English USDA description when a Portuguese search term is available", () => {
    expect(localizedFoodName("Egg, quail, whole, fresh, raw", "USDA_FDC", "pt-BR", "ovo de codorna")).toBe("Ovo de codorna — cru");
    expect(localizedFoodName("Whey, sweet, dried", "USDA_FDC", "pt-BR", "whey protein")).toBe("Whey protein — referência nutricional USDA");
  });
});
