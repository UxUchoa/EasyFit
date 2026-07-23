import type { Metadata } from 'next';
import { AdminAccessManager } from '@/components/admin-access-manager';
import { requireStaff } from '@/lib/admin/auth';
import { canViewAudit } from '@/lib/admin/policy';
import { db } from '@/lib/db';
import { parseLogicalDate } from '@/lib/diary/date';
import { estimatePercentileUpperBound } from '@/lib/observability/metrics';

export const metadata: Metadata = { title: 'Operações' };

function dateBoundary(value: string | undefined, end = false) {
  if (!value) return null;
  const date = parseLogicalDate(value);
  if (!date || !end) return date;
  return new Date(date.getTime() + 86_400_000 - 1);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 86_400_000);
  const from = dateBoundary(params.from) ?? defaultFrom;
  const to = dateBoundary(params.to, true) ?? now;
  const [imports, providers, access, audit, operationalMetrics] = await Promise.all([
    db.importJob.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { status: true, attemptCount: true, startedAt: true, reviewReadyAt: true } }),
    db.externalProviderState.findMany({ orderBy: { provider: 'asc' } }),
    db.supportAccess.findMany({ where: { operatorUserId: session.userId }, orderBy: { createdAt: 'desc' }, take: 20, include: { target: { select: { username: true } }, consulted: { orderBy: { consultedAt: 'desc' }, take: 20 } } }),
    canViewAudit(session.user.role) ? db.auditEvent.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' }, take: 100 }) : Promise.resolve([]),
    db.operationalMetric.findMany({ where: { bucketStart: { gte: from, lte: to } }, select: { metric: true, outcome: true, dimension: true, latencyUpperMs: true, count: true, totalDurationMs: true, maxDurationMs: true } }),
  ]);
  const durations = imports.flatMap((job) => job.startedAt && job.reviewReadyAt ? [job.reviewReadyAt.getTime() - job.startedAt.getTime()] : []);
  const averageLatencyMs = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const byStatus = Object.fromEntries(['PENDING', 'PROCESSING', 'REVIEW', 'FAILED', 'COMPLETED', 'CANCELLED'].map((status) => [status, imports.filter((job) => job.status === status).length]));
  const currentActors = audit.length ? await db.user.findMany({ where: { id: { in: [...new Set(audit.flatMap((event) => event.actorUserId ? [event.actorUserId] : []))] } }, select: { id: true, username: true, role: true } }) : [];
  const actorById = new Map(currentActors.map((actor) => [actor.id, actor]));
  const metricSummary = [...new Set(operationalMetrics.map((row) => row.metric))].sort().map((metric) => {
    const rows = operationalMetrics.filter((row) => row.metric === metric);
    const count = rows.reduce((sum, row) => sum + row.count, 0);
    return { metric, count, averageMs: count ? Math.round(rows.reduce((sum, row) => sum + row.totalDurationMs, 0) / count) : null, maximumMs: rows.reduce((maximum, row) => Math.max(maximum, row.maxDurationMs), 0), p95UpperMs: estimatePercentileUpperBound(rows), outcomes: Object.entries(Object.groupBy(rows, (row) => row.outcome)).map(([outcome, grouped]) => `${outcome}: ${grouped?.reduce((sum, row) => sum + row.count, 0) ?? 0}`).join(' · ') };
  });
  return <main className='shell py-8'>
    <p className='eyebrow'>Operações · {session.user.role === 'ADMIN' ? 'Admin' : 'Suporte'}</p>
    <h1 className='display mt-2 text-4xl font-bold'>Saúde sem exposição por padrão.</h1>
    <p className='mt-3 max-w-2xl leading-7 text-[#657168]'>Métricas são agregadas. Consultar uma conta exige senha recente, justificativa, escopo e gera uma trilha dos objetos vistos.</p>
    <form className='card mt-7 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]' method='get'><div className='field'><label htmlFor='admin-from'>De (UTC)</label><input id='admin-from' name='from' type='date' defaultValue={from.toISOString().slice(0, 10)} /></div><div className='field'><label htmlFor='admin-to'>Até (UTC)</label><input id='admin-to' name='to' type='date' defaultValue={to.toISOString().slice(0, 10)} /></div><button className='button-secondary self-end'>Aplicar período</button></form>
    <section className='mt-7'><h2 className='text-2xl font-black'>Importações no período</h2><div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'><article className='card p-5'><p className='eyebrow'>Volume</p><p className='mt-2 text-3xl font-black'>{imports.length}</p></article><article className='card p-5'><p className='eyebrow'>Falhas</p><p className='mt-2 text-3xl font-black'>{byStatus.FAILED}</p></article><article className='card p-5'><p className='eyebrow'>Retries</p><p className='mt-2 text-3xl font-black'>{imports.filter((job) => job.attemptCount > 1).length}</p></article><article className='card p-5'><p className='eyebrow'>Latência média</p><p className='mt-2 text-3xl font-black'>{averageLatencyMs === null ? '—' : averageLatencyMs + ' ms'}</p></article></div><div className='card mt-4 overflow-x-auto p-3'><table className='w-full text-left text-sm'><caption className='sr-only'>Volume de jobs por estado</caption><thead><tr>{Object.keys(byStatus).map((status) => <th className='p-3' key={status}>{status}</th>)}</tr></thead><tbody><tr>{Object.values(byStatus).map((count, index) => <td className='p-3 font-black' key={index}>{count}</td>)}</tr></tbody></table></div></section>
    <section className='mt-7'><h2 className='text-2xl font-black'>Integrações e quotas</h2>{providers.length ? <div className='mt-4 grid gap-3 sm:grid-cols-2'>{providers.map((provider) => <article key={provider.provider} className='card p-5'><h3 className='font-black'>{provider.provider}</h3><p className='mt-2 text-sm text-[#657168]'>{provider.requestCount} requisições na janela · {provider.consecutiveFailures} falhas consecutivas</p><p className='mt-1 text-sm'>{provider.circuitOpenUntil && provider.circuitOpenUntil > new Date() ? 'Circuito aberto até ' + provider.circuitOpenUntil.toLocaleString('pt-BR') : 'Circuito fechado'}</p></article>)}</div> : <div className='card mt-4 p-5 text-sm text-[#657168]'>Nenhuma integração registrou tráfego ainda.</div>}</section>
    <section className='mt-7'><h2 className='text-2xl font-black'>Métricas operacionais agregadas</h2><p className='mt-2 text-sm text-[#657168]'>Buckets horários sem usuário, IP, GTIN, arquivo ou conteúdo. P95 é o limite superior estimado do histograma.</p>{metricSummary.length ? <div className='mt-4 overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white p-2'><table className='w-full text-left text-sm'><caption className='sr-only'>Métricas agregadas de operação no período</caption><thead><tr className='border-b border-[#dfe5dc]'><th className='p-3'>Métrica</th><th>Volume</th><th>Média</th><th>P95 estimado</th><th>Máximo</th><th>Resultados</th></tr></thead><tbody>{metricSummary.map((metric) => <tr className='border-b border-[#edf0eb]' key={metric.metric}><td className='p-3 font-black'>{metric.metric}</td><td>{metric.count}</td><td>{metric.averageMs === null ? '—' : metric.averageMs + ' ms'}</td><td>≤ {metric.p95UpperMs ?? '—'} ms</td><td>{metric.maximumMs} ms</td><td className='min-w-72'>{metric.outcomes}</td></tr>)}</tbody></table></div> : <div className='card mt-4 p-5 text-sm text-[#657168]'>Nenhuma métrica agregada no período.</div>}</section>
    <AdminAccessManager access={access.map((item) => ({ id: item.id, targetUsername: item.target?.username ?? 'Conta removida', reason: item.reason, scopes: item.scopes, createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString(), revokedAt: item.revokedAt?.toISOString() ?? null, consulted: item.consulted.map((object) => ({ objectType: object.objectType, objectId: object.objectId, consultedAt: object.consultedAt.toISOString() })) }))} />
    {canViewAudit(session.user.role) && <section className='mt-7'><h2 className='text-2xl font-black'>Auditoria do período</h2><div className='mt-4 overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white p-2'><table className='w-full text-left text-sm'><caption className='sr-only'>Eventos de auditoria filtrados por período</caption><thead><tr className='border-b border-[#dfe5dc]'><th className='p-3'>Data</th><th>Ator</th><th>Ação</th><th>Objeto</th><th>Resultado</th></tr></thead><tbody>{audit.map((event) => { const actor = event.actorUserId ? actorById.get(event.actorUserId) : null; return <tr className='border-b border-[#edf0eb]' key={event.id}><td className='p-3 whitespace-nowrap'>{event.createdAt.toLocaleString('pt-BR')}</td><td>{actor ? `${actor.username} (${actor.role})` : event.actorUserId ? `Conta removida · ${event.actorUserId.slice(0, 8)}` : 'Sistema'}</td><td>{event.action}</td><td>{event.objectType ?? '—'} · {event.objectId ?? '—'}</td><td>{event.result}</td></tr>; })}</tbody></table></div></section>}
  </main>;
}
