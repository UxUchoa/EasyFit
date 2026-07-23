"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/entrar");
        router.refresh();
      }}
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
