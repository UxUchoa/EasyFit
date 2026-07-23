import { z } from "zod";
import { calendarDateKey, parseLogicalDate } from "@/lib/diary/date";
import { ageOnDate } from "./calculations";

export const birthDateSchema = z.string().trim().transform((value, context) => {
  const date = parseLogicalDate(value);
  if (!date) {
    context.addIssue({ code: "custom", message: "Data de nascimento inválida." });
    return z.NEVER;
  }
  return date;
});

export function ageInTimeZone(birthDate: Date, timezone: string, now = new Date()) {
  const referenceDate = parseLogicalDate(calendarDateKey(now, timezone))!;
  return ageOnDate(birthDate, referenceDate);
}

export function birthDateIsAllowed(birthDate: Date, timezone: string, now = new Date()) {
  const age = ageInTimeZone(birthDate, timezone, now);
  return age >= 16 && age <= 100;
}
