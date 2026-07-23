import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

type AuditInput = {
  actorUserId?: string;
  action: string;
  objectType?: string;
  objectId?: string;
  result: "SUCCESS" | "DENIED" | "FAILURE";
  correlationId?: string;
  context?: Record<string, string | number | boolean | null>;
};

export async function recordAuditEvent(input: AuditInput) {
  return db.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId,
      result: input.result,
      correlationId: input.correlationId ?? randomUUID(),
      context: input.context,
    },
  });
}
