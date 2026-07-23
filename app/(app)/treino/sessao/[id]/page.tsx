import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkoutSessionClient } from "@/components/workout-session-client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensureExerciseCatalog } from '@/lib/workout/catalog';
import { isCompatibleAlternative } from '@/lib/workout/substitution';

export const metadata: Metadata = { title: "Sessão de treino" };
type PageProps = { params: Promise<{ id: string }> };

export default async function WorkoutSessionPage({ params }: PageProps) {
  const user = await requireUser();
  await ensureExerciseCatalog();
  const { id } = await params;
  const session = await db.workoutSession.findFirst({
    where: { id, userId: user.id },
    include: {
      exercises: {
        orderBy: { position: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  if (!session) notFound();
  const catalog = await db.exercise.findMany({ orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }] });
  const availableEquipment = user.profile?.availableEquipment ?? [];

  return <main className="shell py-8"><p className="eyebrow">Sessão de treino</p><h1 className="display mt-2 text-4xl font-bold">Uma série de cada vez.</h1><p className="mt-3 max-w-xl leading-7 text-[#657168]">Cada série é salva imediatamente. Recarregar a página não apaga seu progresso.</p><WorkoutSessionClient session={{ id: session.id, name: session.name, status: session.status, startedAt: session.startedAt?.toISOString() ?? null, completedAt: session.completedAt?.toISOString() ?? null, exercises: session.exercises.map((exercise) => ({ id: exercise.id, name: exercise.nameSnapshot, muscle: exercise.muscleSnapshot, equipment: exercise.equipmentSnapshot, replacedFromName: exercise.replacedFromNameSnapshot, substitutionReason: exercise.substitutionReason, substitutedAt: exercise.substitutedAt?.toISOString() ?? null, alternatives: catalog.filter((candidate) => isCompatibleAlternative({ id: exercise.exerciseId ?? exercise.id, muscleGroup: exercise.muscleSnapshot, equipment: exercise.equipmentSnapshot }, candidate, availableEquipment)).map((candidate) => ({ id: candidate.id, name: candidate.name, muscle: candidate.muscleGroup, equipment: candidate.equipment })), targetSets: exercise.targetSets, targetReps: exercise.targetReps, restSeconds: exercise.restSeconds, sets: exercise.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, repetitions: set.repetitions, weightKg: set.weightKg === null ? null : Number(set.weightKg), effortRpe: set.effortRpe === null ? null : Number(set.effortRpe), completedAt: set.completedAt?.toISOString() ?? null })) })) }} /></main>;
}
