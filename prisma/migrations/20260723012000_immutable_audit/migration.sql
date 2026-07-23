-- Preserve the pseudonymous actor id after account deletion instead of mutating history.
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_actorUserId_fkey";

-- Audit records are append-only for the application database role.
CREATE OR REPLACE FUNCTION "prevent_audit_event_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();
