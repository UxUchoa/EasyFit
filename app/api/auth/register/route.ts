import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { registrationSchema } from "@/lib/auth/schemas";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { ESSENTIAL_CONSENT, PRIVACY_TEXT_VERSION } from "@/lib/privacy/policy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Confira os dados informados." },
      { status: 400 },
    );
  }

  const correlationId = randomUUID();
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username: parsed.data.username, passwordHash },
      });
      await tx.consentRecord.create({
        data: {
          userId: created.id,
          purpose: ESSENTIAL_CONSENT,
          textVersion: PRIVACY_TEXT_VERSION,
          acceptedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: created.id,
          action: "account.register",
          objectType: "User",
          objectId: created.id,
          result: "SUCCESS",
          correlationId,
        },
      });
      return created;
    });

    await createSession(user.id);
    return NextResponse.json({ next: "/onboarding" }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Não foi possível criar a conta com esses dados." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível criar a conta agora. Tente novamente." },
      { status: 500 },
    );
  }
}
