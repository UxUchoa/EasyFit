import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Use pelo menos 3 caracteres.")
  .max(40, "Use no máximo 40 caracteres.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "A senha precisa ter pelo menos 12 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.");

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const registrationSchema = credentialsSchema.extend({
  privacyAccepted: z.literal(true, { error: "Aceite a política de privacidade para criar a conta." }),
});
