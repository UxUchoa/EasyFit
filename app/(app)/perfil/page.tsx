import type { Metadata } from "next";
import { BodyMeasurements } from '@/components/body-measurements';
import { DaySettingsForm } from '@/components/day-settings-form';
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { NutritionGoalsForm } from "@/components/nutrition-goals-form";
import { TrainingPreferencesForm } from "@/components/training-preferences-form";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ageOnDate, calculateBmi, calculateBmr, calculateTdee } from "@/lib/profile/calculations";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = user.profile;
  const goal = await db.goalPlan.findFirst({ where: { userId: user.id, validUntil: null }, orderBy: { validFrom: "desc" } });
  const measurements = await db.bodyMeasurement.findMany({ where: { userId: user.id }, orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }], take: 24 });
  const calculationInput = profile ? { birthDate: profile.birthDate, biologicalSex: profile.biologicalSex === "male" ? "male" as const : "female" as const, heightCm: Number(profile.heightCm), weightKg: Number(profile.currentWeightKg), activityLevel: profile.activityLevel as "sedentary" | "light" | "moderate" | "very_active" } : null;
  const estimates = calculationInput ? { age: ageOnDate(calculationInput.birthDate), bmi: calculateBmi(calculationInput.weightKg, calculationInput.heightCm), bmr: Math.round(calculateBmr(calculationInput)), tdee: Math.round(calculateTdee(calculationInput)) } : null;

  return <main className="shell py-8">
    <p className="eyebrow">Perfil</p><h1 className="display mt-2 text-4xl font-bold">Seus dados, sob seu controle.</h1>
    <div className="card mt-8 flex flex-wrap items-center justify-between gap-5 p-7"><div><h2 className="text-xl font-black">{profile?.displayName}</h2><p className="mt-1 text-sm text-[#657168]">ID: {user.username}</p></div><div className="flex flex-wrap gap-3">{user.role !== 'USER' && <Link className="button-secondary" href="/admin">Operações</Link>}<Link className="button-secondary" href="/lembretes">Lembretes</Link><Link className="button-secondary" href="/conta">Conta e privacidade</Link><LogoutButton /></div></div>
    {profile && <section className="card mt-5 p-6 sm:p-7"><p className="eyebrow">Preferências</p><h2 className="mt-2 text-2xl font-black">Perfil de treino</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#657168]">Objetivo, experiência, frequência, equipamentos e prioridades ficam editáveis e poderão filtrar sugestões futuras.</p><TrainingPreferencesForm initial={{ objective: profile.objective, trainingExperience: profile.trainingExperience, trainingDaysPerWeek: profile.trainingDaysPerWeek, physicalRestrictions: profile.physicalRestrictions ?? "", availableEquipment: profile.availableEquipment, priorityMuscleGroups: profile.priorityMuscleGroups }} /></section>}
    {profile && goal && estimates && <NutritionGoalsForm initial={{ birthDate: profile.birthDate.toISOString().slice(0, 10), biologicalSex: profile.biologicalSex, heightCm: Number(profile.heightCm), currentWeightKg: Number(profile.currentWeightKg), desiredWeightKg: Number(profile.desiredWeightKg), activityLevel: profile.activityLevel, objective: profile.objective, goal: { mode: goal.mode, calorieTarget: goal.calorieTarget, proteinGrams: Number(goal.proteinGrams), carbohydrateGrams: Number(goal.carbohydrateGrams), fatGrams: Number(goal.fatGrams) }, estimates }} />}
    {profile && <BodyMeasurements defaultDate={new Date().toISOString().slice(0, 10)} defaultWeight={Number(profile.currentWeightKg)} measurements={measurements.map((item) => ({ id: item.id, measuredAt: item.measuredAt.toISOString().slice(0, 10), weightKg: Number(item.weightKg), waistCm: item.waistCm === null ? null : Number(item.waistCm), hipCm: item.hipCm === null ? null : Number(item.hipCm), chestCm: item.chestCm === null ? null : Number(item.chestCm), armCm: item.armCm === null ? null : Number(item.armCm), thighCm: item.thighCm === null ? null : Number(item.thighCm) }))} />}
    {profile && <section className='card mt-5 p-6 sm:p-7'><p className='eyebrow'>Dia lógico</p><h2 className='mt-2 text-2xl font-black'>Fuso e horário de fechamento</h2><p className='mt-2 max-w-2xl text-sm leading-6 text-[#657168]'>Defina quando um novo dia começa para que registros noturnos sejam agrupados do jeito esperado.</p><DaySettingsForm timezone={profile.timezone} dayClosesAtMinutes={profile.dayClosesAtMinutes} /></section>}
  </main>;
}
