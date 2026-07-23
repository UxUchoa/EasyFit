import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calendarDateKey, isSupportedTimeZone, parseLogicalDate } from "@/lib/diary/date";
import {
  calculateBmi,
  calculateBmr,
  calculateTdee,
  suggestCalorieTarget,
  suggestMacros,
} from "@/lib/profile/calculations";
import { birthDateIsAllowed, birthDateSchema } from "@/lib/profile/birth-date";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  birthDate: birthDateSchema,
  biologicalSex: z.enum(["female", "male"]),
  heightCm: z.coerce.number().min(120).max(230),
  currentWeightKg: z.coerce.number().min(30).max(350),
  desiredWeightKg: z.coerce.number().min(30).max(350),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"]),
  objective: z.enum(["lose", "maintain", "gain"]),
  trainingExperience: z.enum(["beginner", "intermediate", "advanced"]),
  trainingDaysPerWeek: z.coerce.number().int().min(1).max(7),
  physicalRestrictions: z.string().trim().max(1000).optional(),
  timezone: z.string().trim().min(3).max(64).refine(isSupportedTimeZone, "Fuso horário inválido.").default("America/Sao_Paulo"),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados do perfil." },
      { status: 400 },
    );
  }
  const now = new Date();
  if (!birthDateIsAllowed(parsed.data.birthDate, parsed.data.timezone, now)) {
    return NextResponse.json({ error: "A idade precisa estar entre 16 e 100 anos." }, { status: 400 });
  }

  const measurementDate = parseLogicalDate(calendarDateKey(now, parsed.data.timezone))!;
  const input = {
    birthDate: parsed.data.birthDate,
    biologicalSex: parsed.data.biologicalSex,
    heightCm: parsed.data.heightCm,
    weightKg: parsed.data.currentWeightKg,
    activityLevel: parsed.data.activityLevel,
    referenceDate: measurementDate,
  };
  const bmi = calculateBmi(input.weightKg, input.heightCm);
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(input);
  const calorieTarget = suggestCalorieTarget(tdee, parsed.data.objective);
  const macros = suggestMacros(calorieTarget, input.weightKg);
  await db.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName: parsed.data.displayName,
        birthDate: parsed.data.birthDate,
        biologicalSex: parsed.data.biologicalSex,
        heightCm: parsed.data.heightCm,
        currentWeightKg: parsed.data.currentWeightKg,
        desiredWeightKg: parsed.data.desiredWeightKg,
        activityLevel: parsed.data.activityLevel,
        objective: parsed.data.objective,
        trainingExperience: parsed.data.trainingExperience,
        trainingDaysPerWeek: parsed.data.trainingDaysPerWeek,
        physicalRestrictions: parsed.data.physicalRestrictions || null,
        timezone: parsed.data.timezone,
      },
      update: {
        displayName: parsed.data.displayName,
        birthDate: parsed.data.birthDate,
        biologicalSex: parsed.data.biologicalSex,
        heightCm: parsed.data.heightCm,
        currentWeightKg: parsed.data.currentWeightKg,
        desiredWeightKg: parsed.data.desiredWeightKg,
        activityLevel: parsed.data.activityLevel,
        objective: parsed.data.objective,
        trainingExperience: parsed.data.trainingExperience,
        trainingDaysPerWeek: parsed.data.trainingDaysPerWeek,
        physicalRestrictions: parsed.data.physicalRestrictions || null,
        timezone: parsed.data.timezone,
      },
    });
    await tx.bodyMeasurement.upsert({
      where: { userId_measuredAt: { userId: session.userId, measuredAt: measurementDate } },
      create: { userId: session.userId, measuredAt: measurementDate, weightKg: parsed.data.currentWeightKg },
      update: { weightKg: parsed.data.currentWeightKg },
    });
    await tx.goalPlan.updateMany({
      where: { userId: session.userId, validUntil: null },
      data: { validUntil: now },
    });
    await tx.goalPlan.create({
      data: {
        userId: session.userId,
        mode: "AUTOMATIC",
        calorieTarget,
        proteinGrams: macros.proteinGrams,
        carbohydrateGrams: macros.carbohydrateGrams,
        fatGrams: macros.fatGrams,
        validFrom: now,
      },
    });
    await tx.user.update({
      where: { id: session.userId },
      data: { onboardingDone: true },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "profile.onboarding.complete",
        objectType: "Profile",
        objectId: session.userId,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { bmi: Number(bmi.toFixed(2)), bmr: Math.round(bmr), tdee: Math.round(tdee) },
      },
    });
  });

  return NextResponse.json({
    next: "/hoje",
    estimates: { bmi, bmr, tdee, calorieTarget, ...macros },
  });
}
