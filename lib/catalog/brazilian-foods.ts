export const BRAZILIAN_REFERENCE_SOURCE = "TACO_BR";
export const BRAZILIAN_REFERENCE_WARNING =
  "Valores nutricionais de referência para alimento in natura brasileiro; podem variar por variedade, maturação e parte consumida.";

export type BrazilianFoodReference = {
  barcodes: string[];
  name: string;
  brand: null;
  baseQuantity: number;
  baseUnit: "g";
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  sourceReference: string;
};

// A camada é deliberadamente curada: cada vínculo GTIN → alimento precisa de
// identidade verificável e composição de uma tabela brasileira de referência.
const BRAZILIAN_FOODS: BrazilianFoodReference[] = [
  {
    barcodes: ["03400000675982", "3400000675982"],
    name: "Maçã nacional",
    brand: null,
    baseQuantity: 100,
    baseUnit: "g",
    calories: 56,
    proteinGrams: 0.3,
    carbohydrateGrams: 15.2,
    fatGrams: 0,
    fiberGrams: 1.3,
    sourceReference: "https://cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf",
  },
];

export function findBrazilianFoodReference(gtin: string) {
  return BRAZILIAN_FOODS.find((food) => food.barcodes.includes(gtin)) ?? null;
}
