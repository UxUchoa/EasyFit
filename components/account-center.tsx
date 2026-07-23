"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { clearOfflineMutations } from '@/lib/offline/queue';

type ActiveSession = {
  id: string;
  current: boolean;
  device: string;
  location: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

type ExportRequest = {
  id: string;
  receiptCode: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

type Notice = { kind: "success" | "error"; text: string } | null;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function jsonRequest<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a solicitação.");
  return result;
}

export function AccountCenter({
  username,
  userScope,
  initialSessions,
  initialExports,
  analyticsAccepted: initialAnalyticsAccepted,
  initiallyReauthenticated,
}: {
  username: string;
  userScope: string;
  initialSessions: ActiveSession[];
  initialExports: ExportRequest[];
  analyticsAccepted: boolean;
  initiallyReauthenticated: boolean;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [exports, setExports] = useState(initialExports);
  const [analyticsAccepted, setAnalyticsAccepted] = useState(initialAnalyticsAccepted);
  const [reauthenticated, setReauthenticated] = useState(initiallyReauthenticated);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [deletionReceipt, setDeletionReceipt] = useState("");

  async function reauthenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("reauth");
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest("/api/auth/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      setReauthenticated(true);
      event.currentTarget.reset();
      setNotice({ kind: "success", text: "Identidade confirmada por 5 minutos neste dispositivo." });
      window.setTimeout(() => setReauthenticated(false), 5 * 60 * 1000);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Senha incorreta." });
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
          revokeOtherSessions: form.get("revokeOtherSessions") === "on",
        }),
      });
      event.currentTarget.reset();
      setReauthenticated(true);
      setNotice({ kind: "success", text: "Senha alterada com segurança." });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível alterar a senha." });
    } finally {
      setBusy("");
    }
  }

  async function revokeSession(id: string, current: boolean) {
    setBusy(`session-${id}`);
    setNotice(null);
    try {
      await jsonRequest(`/api/auth/sessions/${id}`, { method: "DELETE" });
      if (current) {
        router.replace("/entrar");
        router.refresh();
        return;
      }
      setSessions((items) => items.filter((item) => item.id !== id));
      setNotice({ kind: "success", text: "Sessão encerrada." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível encerrar a sessão." });
    } finally {
      setBusy("");
    }
  }

  async function revokeOtherSessions() {
    setBusy("sessions");
    setNotice(null);
    try {
      const result = await jsonRequest<{ revokedCount: number }>("/api/auth/sessions/revoke-others", { method: "POST" });
      setSessions((items) => items.filter((item) => item.current));
      setNotice({ kind: "success", text: `${result.revokedCount} sessão(ões) encerrada(s).` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível encerrar as sessões." });
    } finally {
      setBusy("");
    }
  }

  async function changeAnalyticsConsent(accepted: boolean) {
    setBusy("consent");
    setNotice(null);
    try {
      await jsonRequest("/api/privacy/consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "optional_product_analytics", accepted }),
      });
      setAnalyticsAccepted(accepted);
      setNotice({ kind: "success", text: accepted ? "Consentimento opcional registrado." : "Consentimento opcional revogado." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível atualizar o consentimento." });
    } finally {
      setBusy("");
    }
  }

  async function requestExport() {
    setBusy("export");
    setNotice(null);
    try {
      const result = await jsonRequest<{ request: ExportRequest & { downloadUrl: string } }>("/api/privacy/exports", { method: "POST" });
      setExports((items) => [{ ...result.request, requestedAt: new Date().toISOString(), completedAt: new Date().toISOString() }, ...items]);
      setNotice({ kind: "success", text: `Exportação pronta. Protocolo ${result.request.receiptCode}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível solicitar a exportação." });
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("delete");
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await jsonRequest<{ receiptCode: string }>("/api/privacy/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: form.get("confirmation") }),
      });
      await clearOfflineMutations(userScope).catch(() => undefined);
      setDeletionReceipt(result.receiptCode);
      setNotice({ kind: "success", text: "Conta e dados ativos excluídos." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível excluir a conta." });
    } finally {
      setBusy("");
    }
  }

  if (deletionReceipt) {
    return <main className="shell py-8"><section className="card mx-auto max-w-2xl p-7"><p className="eyebrow">Solicitação concluída</p><h1 className="mt-2 text-3xl font-black">Sua conta foi excluída.</h1><p className="mt-4 leading-7 text-[#657168]">Guarde o protocolo <strong className="text-[#142018]">{deletionReceipt}</strong>. A sessão foi encerrada e os dados ativos associados foram removidos.</p><Link className="button-primary mt-6 inline-flex" href="/">Voltar ao início</Link></section></main>;
  }

  return (
    <main className="shell py-8">
      <p className="eyebrow">Conta</p>
      <h1 className="display mt-2 text-4xl font-bold">Segurança e privacidade.</h1>
      <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-sm font-bold ${notice?.kind === "error" ? "text-[#b42318]" : "text-[#166534]"}`}>{notice?.text}</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section className="card p-6 sm:p-7">
          <p className="eyebrow">Ação sensível</p><h2 className="mt-2 text-2xl font-black">Confirme sua identidade</h2>
          <p className="mt-2 text-sm leading-6 text-[#657168]">A confirmação vale por 5 minutos e é exigida para exportar dados ou excluir a conta.</p>
          <form className="mt-5 grid gap-4" onSubmit={reauthenticate}><div className="field"><label htmlFor="reauth-password">Senha atual</label><input id="reauth-password" name="password" type="password" autoComplete="current-password" required /></div><button className="button-secondary" disabled={busy === "reauth"}>{busy === "reauth" ? "Confirmando…" : reauthenticated ? "Identidade confirmada" : "Confirmar identidade"}</button></form>
        </section>

        <section className="card p-6 sm:p-7">
          <p className="eyebrow">Credencial</p><h2 className="mt-2 text-2xl font-black">Alterar senha</h2>
          <form className="mt-5 grid gap-4" onSubmit={changePassword}><div className="field"><label htmlFor="current-password">Senha atual</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></div><div className="field"><label htmlFor="new-password">Nova senha</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><p className="text-xs text-[#657168]">Use pelo menos 12 caracteres.</p></div><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" name="revokeOtherSessions" type="checkbox" defaultChecked />Encerrar as outras sessões após a troca</label><button className="button-primary" disabled={busy === "password"}>{busy === "password" ? "Alterando…" : "Alterar senha"}</button></form>
        </section>
      </div>

      <section className="card mt-5 p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Acesso</p><h2 className="mt-2 text-2xl font-black">Sessões ativas</h2><p className="mt-2 text-sm text-[#657168]">A localização é aproximada e pode não estar disponível.</p></div>{sessions.length > 1 && <button className="button-secondary" onClick={revokeOtherSessions} disabled={busy === "sessions"}>Encerrar outras</button>}</div>
        <div className="mt-5 grid gap-3">{sessions.map((session) => <article key={session.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfe5dc] p-4"><div><h3 className="font-black">{session.device} {session.current && <span className="text-[#166534]">· esta sessão</span>}</h3><p className="mt-1 text-sm text-[#657168]">{session.location} · atividade em {formatDate(session.lastActiveAt)}</p><p className="mt-1 text-xs text-[#657168]">Criada em {formatDate(session.createdAt)} · expira em {formatDate(session.expiresAt)}</p></div><button className="button-ghost" onClick={() => revokeSession(session.id, session.current)} disabled={busy === `session-${session.id}`}>Encerrar</button></article>)}</div>
      </section>

      <section className="card mt-5 p-6 sm:p-7">
        <p className="eyebrow">Consentimentos</p><h2 className="mt-2 text-2xl font-black">Suas escolhas</h2>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfe5dc] p-4"><div><h3 className="font-black">Análises opcionais de produto</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-[#657168]">Permite métricas opcionais para melhorar a experiência. O funcionamento essencial não depende desta escolha.</p></div><button className="button-secondary" disabled={busy === "consent"} onClick={() => changeAnalyticsConsent(!analyticsAccepted)}>{analyticsAccepted ? "Revogar" : "Aceitar"}</button></div>
        <Link className="mt-4 inline-block text-sm font-black text-[#166534] underline" href="/privacidade">Ler a Política de Privacidade</Link>
      </section>

      <section className="card mt-5 p-6 sm:p-7">
        <p className="eyebrow">Portabilidade</p><h2 className="mt-2 text-2xl font-black">Exportar meus dados</h2><p className="mt-2 text-sm leading-6 text-[#657168]">Gera um arquivo JSON estruturado, disponível somente nesta sessão autenticada até a expiração.</p>
        <button className="button-primary mt-5" onClick={requestExport} disabled={!reauthenticated || busy === "export"}>{busy === "export" ? "Gerando…" : "Solicitar exportação"}</button>{!reauthenticated && <p className="mt-2 text-xs font-bold text-[#8a5b00]">Confirme sua identidade acima antes de solicitar.</p>}
        {exports.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[#dfe5dc]"><th className="py-3">Protocolo</th><th>Estado</th><th>Solicitado</th><th>Expira</th><th>Resultado</th></tr></thead><tbody>{exports.map((item) => <tr className="border-b border-[#edf0eb]" key={item.id}><td className="py-3 font-bold">{item.receiptCode}</td><td>{item.status}</td><td>{formatDate(item.requestedAt)}</td><td>{formatDate(item.expiresAt)}</td><td>{item.status === "COMPLETED" && item.expiresAt && new Date(item.expiresAt) > new Date() ? <a className="font-black text-[#166534] underline" href={`/api/privacy/exports/${item.id}/download`}>Baixar JSON</a> : "Indisponível"}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="mt-5 rounded-[2rem] border border-[#f1b7b2] bg-[#fff8f7] p-6 sm:p-7">
        <p className="eyebrow text-[#b42318]">Zona de risco</p><h2 className="mt-2 text-2xl font-black">Excluir minha conta</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a47]">Esta ação remove a conta e os dados ativos associados e encerra a sessão. Confirme sua identidade acima e digite exatamente <strong>{username}</strong>.</p>
        <form className="mt-5 grid max-w-xl gap-4" onSubmit={deleteAccount}><div className="field"><label htmlFor="delete-confirmation">ID de usuário para confirmação</label><input id="delete-confirmation" name="confirmation" autoComplete="off" required /></div><button className="button-secondary border-[#b42318] text-[#b42318]" disabled={!reauthenticated || busy === "delete"}>{busy === "delete" ? "Excluindo…" : "Excluir conta definitivamente"}</button>{!reauthenticated && <p className="text-xs font-bold text-[#8a5b00]">Confirme sua identidade antes de excluir.</p>}</form>
      </section>
    </main>
  );
}
