"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "today" | "diet" | "workout" | "reports" | "profile";

const items: Array<{ href: string; label: string; icon: IconName; matches: string[] }> = [
  { href: "/hoje", label: "Hoje", icon: "today", matches: ["/hoje"] },
  { href: "/dieta", label: "Dieta", icon: "diet", matches: ["/dieta", "/scanner", "/alimentos"] },
  { href: "/treino", label: "Treino", icon: "workout", matches: ["/treino"] },
  { href: "/relatorios", label: "Evolução", icon: "reports", matches: ["/relatorios"] },
  { href: "/perfil", label: "Perfil", icon: "profile", matches: ["/perfil", "/conta", "/lembretes"] },
];

function NavIcon({ name }: { name: IconName }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "today") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></svg>;
  if (name === "diet") return <svg {...common}><path d="M12 7c-3-4-8-2-8 3 0 6 4 10 8 10s8-4 8-10c0-5-5-7-8-3Z" /><path d="M12 7c0-3 1-5 4-5M9 4c1 0 2 .5 3 1.5" /></svg>;
  if (name === "workout") return <svg {...common}><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" /></svg>;
  if (name === "reports") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m4 8 6-4 6 7 6-8" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

function routeIsActive(pathname: string, matches: string[]) {
  return matches.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5dc] bg-white/95 px-[max(.5rem,env(safe-area-inset-left))] pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgb(23_32_27/8%)] backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <ul className="mx-auto flex max-w-lg items-center justify-around gap-0.5 md:max-w-none md:justify-end md:gap-1.5">
        {items.map((item) => {
          const active = routeIsActive(pathname, item.matches);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-12 min-w-[3.3rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[.65rem] font-extrabold no-underline transition-colors md:min-w-0 md:flex-row md:gap-2 md:px-3.5 md:text-sm ${active ? "bg-[#e9f3e8] text-[#0f5b2d]" : "text-[#59665d] hover:bg-white hover:text-[#17201b]"}`}
              >
                <span className={`grid place-items-center transition-transform group-active:scale-90 ${active ? "text-[#166534]" : ""}`}><NavIcon name={item.icon} /></span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
