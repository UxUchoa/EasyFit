import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configure seu perfil" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingDone) redirect("/hoje");

  return (
    <main className="shell py-6 sm:py-10">
      <div className="mb-8"><Brand /></div>
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Etapa inicial</p>
        <h1 className="display mt-3 text-4xl font-bold sm:text-5xl">Vamos adaptar o EasyFit a você.</h1>
        <p className="mt-4 max-w-xl leading-7 text-[#657168]">Leva cerca de dois minutos. Você poderá revisar e alterar essas informações depois.</p>
        <OnboardingForm />
      </div>
    </main>
  );
}
