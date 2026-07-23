"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password"), privacyAccepted: isRegister ? data.get("privacyAccepted") === "on" : undefined }),
      });
      const result = (await response.json()) as { error?: string; next?: string };
      if (!response.ok || !result.next) {
        setError(result.error ?? "Não foi possível continuar.");
        return;
      }
      router.push(result.next);
      router.refresh();
    } catch {
      setError("Sem conexão. Confira sua internet e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5">
      <div className="field">
        <label htmlFor="username">ID de usuário</label>
        <input id="username" name="username" autoComplete="username" minLength={3} maxLength={40} required placeholder="seu.id" />
        <p className="text-xs leading-5 text-[#69746c]">Letras, números, ponto, hífen ou sublinhado.</p>
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={12} maxLength={128} required />
        {isRegister && <p className="text-xs leading-5 text-[#69746c]">Use pelo menos 12 caracteres. O EasyFit não armazena sua senha em texto puro.</p>}
      </div>

      {isRegister && (
        <><div className="rounded-2xl border border-[#eadc9c] bg-[#fffbed] p-4 text-sm leading-6 text-[#625521]">
          <strong>Guarde sua senha.</strong> Ainda não existe recuperação por e-mail ou SMS; perdê-la significa perder o acesso a esta conta.
        </div><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-4 text-sm leading-6"><input className="mt-1 size-4" type="checkbox" name="privacyAccepted" required /><span>Li e aceito a <Link className="font-black text-[#166534] underline" href="/privacidade" target="_blank">Política de Privacidade</Link> versão 2026-07-22.1 para o funcionamento essencial da conta.</span></label></>
      )}

      {!isRegister && <div className='rounded-2xl border border-[#eadc9c] bg-[#fffbed] p-4 text-sm leading-6 text-[#625521]'><strong>Não há recuperação de senha neste MVP.</strong> Se você perdeu a senha, não existe fluxo por e-mail ou SMS; será necessário criar outra conta.</div>}
      <p aria-live="polite" role="status" className={`min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>
        {error || "Tudo certo"}
      </p>

      <button className="button-primary w-full" disabled={pending}>
        {pending ? "Só um instante…" : isRegister ? "Criar conta" : "Entrar"}
      </button>
      <p className="text-center text-sm text-[#667269]">
        {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
        <Link className="font-black text-[#166534] underline-offset-4 hover:underline" href={isRegister ? "/entrar" : "/cadastro"}>
          {isRegister ? "Entrar" : "Criar agora"}
        </Link>
      </p>
    </form>
  );
}
