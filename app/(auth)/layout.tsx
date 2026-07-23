import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell grid min-h-dvh place-items-center py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center"><Brand /></div>
        <div className="card p-6 sm:p-9">{children}</div>
      </div>
    </main>
  );
}
