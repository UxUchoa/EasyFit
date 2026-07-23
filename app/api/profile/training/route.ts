import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const EQUIPMENT = ["Peso corporal", "Halteres", "Barra", "Máquinas", "Cabos", "Faixas elásticas"] as const;
const MUSCLE_GROUPS = ["Pernas", "Glúteos", "Panturrilhas", "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraços", "Core"] as const;
const trainingProfileSchema = z.object({
  objective: z.enum(["lose", "maintain", "gain"]),
  trainingExperience: z.enum(["beginner", "intermediate", "advanced"]),
  trainingDaysPerWeek: z.coerce.number().int().min(1).max(7),
  physicalRestrictions: z.string().trim().max(1000).nullable().optional(),
  availableEquipment: z.array(z.enum(EQUIPMENT)).max(EQUIPMENT.length),
  priorityMuscleGroups: z.array(z.enum(MUSCLE_GROUPS)).max(MUSCLE_GROUPS.length),
});

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = trainingProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Preferências inválidas." }, { status: 400 });
  }
  const result = await db.profile.updateMany({
    where: { userId: session.userId },
    data: {
      ...parsed.data,
      physicalRestrictions: parsed.data.physicalRestrictions || null,
    },
  });
  if (!result.count) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  await db.auditEvent.create({
    data: {
      actorUserId: session.userId,
      action: "profile.training.update",
      objectType: "Profile",
      objectId: session.userId,
      result: "SUCCESS",
      correlationId: randomUUID(),
    },
  });
  return NextResponse.json({ updated: true });
}
