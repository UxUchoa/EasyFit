import type { Metadata } from "next";
import { WorkoutPlanner } from "@/components/workout-planner";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensureExerciseCatalog } from "@/lib/workout/catalog";

export const metadata: Metadata = { title: "Treino" };

export default async function WorkoutPage() {
  const user = await requireUser();
  const [exercises, plans, activeSession, recentSessions] = await Promise.all([
    ensureExerciseCatalog(),
    db.workoutPlan.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { exercises: { orderBy: [{ dayIndex: "asc" }, { position: "asc" }], include: { exercise: true } } },
        },
      },
    }),
    db.workoutSession.findFirst({ where: { userId: user.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" } }),
    db.workoutSession.findMany({ where: { userId: user.id, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 8 }),
  ]);

  return <main className="shell py-8"><p className="eyebrow">Treino</p><h1 className="display mt-2 text-4xl font-bold">Movimento com contexto.</h1><p className="mt-3 max-w-xl leading-7 text-[#657168]">Planeje, registre e retome sem perder séries já concluídas.</p><WorkoutPlanner exercises={exercises} plans={plans} activeSession={activeSession ? { id: activeSession.id, name: activeSession.name, startedAt: activeSession.startedAt?.toISOString() ?? null } : null} recentSessions={recentSessions.map((session) => ({ id: session.id, name: session.name, completedAt: session.completedAt?.toISOString() ?? null }))} /></main>;
}
