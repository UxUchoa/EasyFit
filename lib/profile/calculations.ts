export type BiologicalSex = "female" | "male";

export type ProfileCalculationInput = {
  birthDate: Date;
  biologicalSex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "very_active";
  referenceDate?: Date;
};

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
} as const;

export function ageOnDate(birthDate: Date, referenceDate = new Date()) {
  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    referenceDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (referenceDate.getUTCMonth() === birthDate.getUTCMonth() &&
      referenceDate.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function calculateBmi(weightKg: number, heightCm: number) {
  return weightKg / (heightCm / 100) ** 2;
}

export function calculateBmr({
  birthDate,
  biologicalSex,
  heightCm,
  weightKg,
  referenceDate,
}: ProfileCalculationInput) {
  const age = ageOnDate(birthDate, referenceDate);
  const sexConstant = biologicalSex === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
}

export function calculateTdee(input: ProfileCalculationInput) {
  return calculateBmr(input) * ACTIVITY_FACTORS[input.activityLevel];
}

export function suggestCalorieTarget(
  tdee: number,
  objective: "lose" | "maintain" | "gain",
) {
  if (objective === "lose") return Math.round(tdee * 0.85);
  if (objective === "gain") return Math.round(tdee * 1.1);
  return Math.round(tdee);
}

export function suggestMacros(calorieTarget: number, weightKg: number) {
  const proteinGrams = Math.round(weightKg * 1.6);
  const fatGrams = Math.round(weightKg * 0.8);
  const remainingCalories = calorieTarget - proteinGrams * 4 - fatGrams * 9;
  const carbohydrateGrams = Math.max(0, Math.round(remainingCalories / 4));
  return { proteinGrams, carbohydrateGrams, fatGrams };
}
