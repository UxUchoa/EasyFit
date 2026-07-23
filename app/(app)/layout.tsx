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
      <header className="sticky top-0 z-30 border-b border-[#dfe5dc]/80 bg-[#f6f7f2]/95 md:bg-[#f6f7f2]/90 md:backdrop-blur-xl">
        <div className="shell flex min-h-16 items-center justify-between py-3">
          <Brand />
          <AppNav />
        </div>
      </header>
      <OfflineSyncCenter userScope={user.id} />
      <SessionRotation />
      {children}
    </div>
  );
}
