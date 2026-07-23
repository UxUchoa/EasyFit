import Link from 'next/link';

export function ContextualHelp({
  children,
  href,
  linkLabel,
}: {
  children: React.ReactNode;
  href: string;
  linkLabel: string;
}) {
  return (
    <aside
      aria-label="Ajuda contextual"
      className="mt-6 rounded-2xl border border-[#dfe5dc] bg-[#f4f6f1] p-4 text-sm leading-6 text-[#4f5c53]"
    >
      <p className="font-black text-[#17201b]">Precisa de ajuda?</p>
      <p className="mt-1">{children}</p>
      <Link className="mt-2 inline-flex font-black text-[#166534] underline underline-offset-4" href={href}>
        {linkLabel}
      </Link>
    </aside>
  );
}
