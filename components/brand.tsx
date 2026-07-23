import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3 text-inherit no-underline">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-[0.9rem] bg-[#166534] text-lg font-black text-white shadow-sm"
      >
        E
      </span>
      {!compact && <span className="text-lg font-black tracking-[-0.03em]">EasyFit</span>}
    </Link>
  );
}
