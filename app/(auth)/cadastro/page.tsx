import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <>
      <p className="eyebrow">Comece por aqui</p>
      <h1 className="display mt-3 text-4xl font-bold">Uma conta só sua.</h1>
      <p className="mt-3 leading-7 text-[#657168]">Seu diário, seu treino e seus dados permanecem privados.</p>
      <AuthForm mode="register" />
    </>
  );
}
