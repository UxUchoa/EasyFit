import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ageOnDate, calculateBmi, calculateBmr, calculateTdee, suggestCalorieTarget, suggestMacros } from "@/lib/profile/calculations";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const automaticSchema = z.object({
  mode: z.literal("AUTOMATIC"), birthDate: z.coerce.date().refine((date) => { const age = ageOnDate(date); return age >= 16 && age <= 100; }, "A idade precisa estar entre 16 e 100 anos."),
  biologicalSex: z.enum(["female", "male"]), heightCm: z.coerce.number().min(120).max(230), currentWeightKg: z.coerce.number().min(30).max(350), desiredWeightKg: z.coerce.number().min(30).max(350), activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"]), objective: z.enum(["lose", "maintain", "gain"]),
});
const manualSchema = z.object({ mode: z.literal("MANUAL"), calorieTarget: z.coerce.number().int().min(800).max(10_000), proteinGrams: z.coerce.number().min(0).max(1_000), carbohydrateGrams: z.coerce.number().min(0).max(2_000), fatGrams: z.coerce.number().min(0).max(1_000) });
const schema = z.discriminatedUnion("mode", [automaticSchema, manualSchema]);

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise as metas." }, { status: 400 });
  const now = new Date();
  let targets: { calorieTarget: number; proteinGrams: number; carbohydrateGrams: number; fatGrams: number };
  let calculation: Record<string, number> | null = null;
  if (parsed.data.mode === "AUTOMATIC") {
    const input = { birthDate: parsed.data.birthDate, biologicalSex: parsed.data.biologicalSex, heightCm: parsed.data.heightCm, weightKg: parsed.data.currentWeightKg, activityLevel: parsed.data.activityLevel };
    const bmi = calculateBmi(input.weightKg, input.heightCm);
    const bmr = calculateBmr(input);
    const tdee = calculateTdee(input);
    const calorieTarget = suggestCalorieTarget(tdee, parsed.data.objective);
    targets = { calorieTarget, ...suggestMacros(calorieTarget, input.weightKg) };
    calculation = { bmi: Number(bmi.toFixed(2)), bmr: Math.round(bmr), tdee: Math.round(tdee) };
  } else {
    targets = { calorieTarget: parsed.data.calorieTarget, proteinGrams: parsed.data.proteinGrams, carbohydrateGrams: parsed.data.carbohydrateGrams, fatGrams: parsed.data.fatGrams };
  }
  const goal = await db.$transaction(async (tx) => {
    if (parsed.data.mode === "AUTOMATIC") await tx.profile.update({ where: { userId: session.userId }, data: { birthDate: parsed.data.birthDate, biologicalSex: parsed.data.biologicalSex, heightCm: parsed.data.heightCm, currentWeightKg: parsed.data.currentWeightKg, desiredWeightKg: parsed.data.desiredWeightKg, activityLevel: parsed.data.activityLevel, objective: parsed.data.objective } });
    await tx.goalPlan.updateMany({ where: { userId: session.userId, validUntil: null }, data: { validUntil: now } });
    const created = await tx.goalPlan.create({ data: { userId: session.userId, mode: parsed.data.mode, ...targets, validFrom: now } });
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: "nutrition_goal.change", objectType: "GoalPlan", objectId: created.id, result: "SUCCESS", correlationId: randomUUID(), context: { mode: parsed.data.mode, ...calculation } } });
    return created;
  });
  return NextResponse.json({ goal, calculation });
}
