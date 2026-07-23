import Link from "next/link";

const items = [
  { href: "/hoje", label: "Hoje", icon: "◉" },
  { href: "/dieta", label: "Dieta", icon: "⌁" },
  { href: "/treino", label: "Treino", icon: "↟" },
  { href: "/relatorios", label: "Evolução", icon: "∿" },
  { href: "/perfil", label: "Perfil", icon: "○" },
];

export function AppNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5dc] bg-white/95 px-[max(1rem,env(safe-area-inset-left))] pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
      <ul className="mx-auto flex max-w-lg items-center justify-around gap-1 md:justify-end md:gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-xs font-bold text-[#59665d] no-underline hover:bg-white md:min-w-0 md:flex-row md:gap-2 md:text-sm">
              <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>{item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
