import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/auth/session";
import { OfflineSyncCenter } from '@/components/offline-sync-center';
import { SessionRotation } from '@/components/session-rotation';

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.onboardingDone) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="shell flex items-center justify-between py-5">
        <Brand />
        <AppNav />
      </header>
      <OfflineSyncCenter userScope={user.id} />
      <SessionRotation />
      {children}
    </div>
  );
}
