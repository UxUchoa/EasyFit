import type { ReactNode } from "react";

function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

function LoadingFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main className="shell py-8" aria-busy="true" aria-live="polite">
      {children}
      <span className="sr-only">{label}</span>
    </main>
  );
}

function PageHeadingSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div>
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className={`mt-4 h-11 rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"}`} />
      <Skeleton className="mt-4 h-4 max-w-xl rounded-full" />
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-2xl bg-white/8 p-3">
      <Skeleton className="h-3 w-16 bg-white/15" />
      <Skeleton className="mt-3 h-6 w-20 bg-white/15" />
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <LoadingFrame label="Carregando a página.">
      <PageHeadingSkeleton wide />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Skeleton className="card min-h-64" />
        <Skeleton className="card min-h-64" />
      </div>
    </LoadingFrame>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingFrame label="Carregando o resumo de hoje.">
      <PageHeadingSkeleton wide />
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="overflow-hidden rounded-[1.75rem] bg-[#153d28] p-6">
          <Skeleton className="h-3 w-28 bg-white/15" />
          <Skeleton className="mt-4 h-12 w-48 bg-white/15" />
          <div className="mt-7 grid grid-cols-3 gap-3">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
          <Skeleton className="mt-6 h-12 w-full bg-white/15" />
        </section>
        <section className="card p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-2/3" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-7 h-12 w-full" />
        </section>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="card h-40" />)}
      </div>
    </LoadingFrame>
  );
}

export function DiarySkeleton() {
  return (
    <LoadingFrame label="Carregando o diário alimentar.">
      <PageHeadingSkeleton />
      <div className="mt-6 flex items-center justify-between gap-3">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-10 w-52 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
      </div>
      <section className="mt-5 rounded-[1.75rem] bg-[#153d28] p-6">
        <div className="flex flex-wrap justify-between gap-6">
          <div><Skeleton className="h-3 w-24 bg-white/15" /><Skeleton className="mt-3 h-11 w-44 bg-white/15" /></div>
          <div className="grid grid-cols-3 gap-3"><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></div>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-[1.25rem] sm:h-28" />)}
      </div>
      <div className="mt-8 grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <section className="card p-5 sm:p-6" key={index}>
            <div className="flex items-center justify-between"><div className="w-2/3"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-4 w-full" /></div><Skeleton className="size-11 rounded-full" /></div>
            {index === 0 && <><Skeleton className="mt-6 h-px w-full" /><Skeleton className="mt-4 h-5 w-2/3" /><Skeleton className="mt-3 h-4 w-1/2" /></>}
          </section>
        ))}
      </div>
    </LoadingFrame>
  );
}

export function WorkoutSkeleton() {
  return (
    <LoadingFrame label="Carregando seus treinos.">
      <PageHeadingSkeleton wide />
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Skeleton className="card h-40 lg:col-span-2" />
        <Skeleton className="card h-40" />
      </div>
      <section className="card mt-5 p-6">
        <div className="flex items-center justify-between"><Skeleton className="h-7 w-52" /><Skeleton className="h-11 w-36 rounded-full" /></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
      </section>
    </LoadingFrame>
  );
}

export function ReportsSkeleton() {
  return (
    <LoadingFrame label="Carregando seus relatórios.">
      <PageHeadingSkeleton wide />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="card h-32" />)}
      </div>
      <Skeleton className="card mt-4 h-72" />
      <div className="mt-10"><Skeleton className="h-7 w-52" /><Skeleton className="card mt-5 h-60" /></div>
    </LoadingFrame>
  );
}

export function ProfileSkeleton() {
  return (
    <LoadingFrame label="Carregando seu perfil.">
      <PageHeadingSkeleton />
      <section className="card mt-8 p-7"><Skeleton className="h-7 w-48" /><Skeleton className="mt-3 h-4 w-64" /><div className="mt-6 flex flex-wrap gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-40 rounded-full" />)}</div></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => <section className="card p-7" key={index}><Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-8 w-56" /><Skeleton className="mt-5 h-14 w-full rounded-2xl" /><Skeleton className="mt-3 h-14 w-full rounded-2xl" /><Skeleton className="mt-5 h-12 w-40 rounded-full" /></section>)}
      </div>
    </LoadingFrame>
  );
}

export function FoodResultsSkeleton() {
  return (
    <div className="mt-4 grid gap-4" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4" key={index}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/3" />
          <div className="mt-5 grid grid-cols-2 gap-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
          <Skeleton className="mt-4 h-12 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
