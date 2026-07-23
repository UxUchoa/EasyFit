import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { hasTrustedOrigin } from '@/lib/security/request';
import { ensureExerciseCatalog } from '@/lib/workout/catalog';
import { generateWorkoutProposal, type GenerationProfile } from '@/lib/workout/generator';
import { workoutGenerationRequestSchema } from '@/lib/workout/schemas';

export const runtime = 'nodejs';

function generationProfile(profile: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>['user']['profile']): GenerationProfile | null {
  if (!profile) return null;
  if (!['lose', 'maintain', 'gain'].includes(profile.objective) || !['beginner', 'intermediate', 'advanced'].includes(profile.trainingExperience)) return null;
  return {
    objective: profile.objective as GenerationProfile['objective'],
    trainingExperience: profile.trainingExperience as GenerationProfile['trainingExperience'],
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    physicalRestrictions: profile.physicalRestrictions,
    availableEquipment: profile.availableEquipment,
    priorityMuscleGroups: profile.priorityMuscleGroups,
  };
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const selection = workoutGenerationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!selection.success) return NextResponse.json({ error: 'Selecione uma divisão e o foco do treino.' }, { status: 400 });
  const profile = generationProfile(session.user.profile);
  if (!profile) return NextResponse.json({ error: 'Complete as preferências de treino antes de gerar uma sugestão.' }, { status: 422 });
  const catalog = await ensureExerciseCatalog() ?? await db.exercise.findMany({ orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }] });
  const proposal = generateWorkoutProposal(profile, catalog, selection.data);
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: 'workout_plan.generate.preview', objectType: 'WorkoutPlan', result: 'SUCCESS', correlationId: randomUUID(), context: { ruleVersion: proposal.ruleVersion, division: proposal.division, focus: proposal.focus, profileDays: profile.trainingDaysPerWeek, suggestedExercises: proposal.exercises.length, hasRestrictions: proposal.inputs.hasPhysicalRestrictions } } });
  return NextResponse.json({ proposal });
}
