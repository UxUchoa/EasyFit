import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { ContextualHelp } from "@/components/contextual-help";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <p className="eyebrow">Boas-vindas</p>
      <h1 className="display mt-3 text-4xl font-bold">Entre no seu ritmo.</h1>
      <p className="mt-3 leading-7 text-[#657168]">Use seu ID e sua senha para continuar.</p>
      <ContextualHelp href="/cadastro" linkLabel="Criar uma nova conta">
        O EasyFit ainda não oferece recuperação de senha. Se você perdeu a sua, será necessário criar outra conta.
      </ContextualHelp>
      <AuthForm mode="login" />
    </>
  );
}
