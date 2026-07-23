"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIET_PLAN_APPLIED_EVENT, type DietPlanAppliedDetail } from "@/lib/diary/events";

type PlannedItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  source: string | null;
};

type PlannedMeal = { label: string; slug: string | null; items: PlannedItem[] };

function format(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

export function ActiveDietPlan({ planName, dayLabel, date, meals }: { planName: string; dayLabel: string; date: string; meals: PlannedMeal[] }) {
  const router = useRouter();
  const [pendingMeal, setPendingMeal] = useState<string | null>(null);
  const [completedMeals, setCompletedMeals] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const totals = meals.flatMap((meal) => meal.items).reduce((sum, item) => ({
    calories: sum.calories + (item.calories ?? 0),
    protein: sum.protein + (item.proteinGrams ?? 0),
    carbs: sum.carbs + (item.carbohydrateGrams ?? 0),
    fat: sum.fat + (item.fatGrams ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const unresolved = meals.flatMap((meal) => meal.items).filter((item) => item.calories === null).length;

  async function consumeMeal(mealLabel: string) {
    setPendingMeal(mealLabel); setMessage(""); setError(false);
    const response = await fetch("/api/diet-plans/active/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealLabel }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string; skipped?: number; mealSlug?: string; entries?: unknown[] } : null;
    if (!response?.ok) {
      setError(true); setMessage(result?.error ?? "Não foi possível registrar a refeição.");
    } else {
      setCompletedMeals((current) => current.includes(mealLabel) ? current : [...current, mealLabel]);
      setMessage(result?.skipped ? `Refeição registrada; ${result.skipped} item(ns) sem nutrientes foram ignorados.` : "Refeição registrada no diário com calorias e macros.");
      if (result?.mealSlug && result.entries?.length) window.dispatchEvent(new CustomEvent<DietPlanAppliedDetail>(DIET_PLAN_APPLIED_EVENT, { detail: { mealSlug: result.mealSlug, entries: result.entries } }));
      router.refresh();
    }
    setPendingMeal(null);
  }

  return <section className="card mt-6 p-5 sm:p-7" aria-labelledby="active-diet-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Plano ativo · {dayLabel}</p><h2 id="active-diet-title" className="mt-2 text-2xl font-black">{planName}</h2><p className="mt-2 text-sm leading-6 text-[#657168]">Confira o previsto e registre uma refeição inteira quando realmente consumir.</p></div>
      <div className="rounded-2xl bg-[#153d28] px-4 py-3 text-right text-white"><strong className="text-xl">{format(totals.calories)} kcal</strong><p className="text-xs text-white/70">P {format(totals.protein, 1)} g · C {format(totals.carbs, 1)} g · G {format(totals.fat, 1)} g</p></div>
    </div>
    {unresolved > 0 && <p className="mt-4 rounded-xl bg-[#fffbed] p-3 text-sm font-bold text-[#725d00]">{unresolved} item(ns) ainda não possuem nutrientes e não entram nos totais.</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{meals.map((meal) => {
      const mealCalories = meal.items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
      const canConsume = Boolean(meal.slug && meal.items.some((item) => item.calories !== null));
      const completed = completedMeals.includes(meal.label);
      return <article key={meal.label} className="rounded-2xl border border-[#dfe5dc] p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{meal.label}</h3><p className="mt-1 text-sm text-[#657168]">{format(mealCalories)} kcal previstas</p></div>{completed && <span className="rounded-full bg-[#e9f5e9] px-2 py-1 text-[10px] font-black text-[#166534]">REGISTRADA</span>}</div>
        <ul className="mt-3 divide-y divide-[#edf0eb]">{meal.items.map((item, index) => <li key={`${item.name}-${index}`} className="py-3 text-sm"><div className="flex justify-between gap-3"><div><strong>{item.name}</strong><p className="mt-1 text-xs text-[#657168]">{format(item.quantity, 2)} {item.unit}{item.source ? ` · ${item.source}` : ""}</p></div><span className="whitespace-nowrap font-bold">{item.calories === null ? "Revisar" : `${format(item.calories)} kcal`}</span></div>{item.calories !== null && <p className="mt-1 text-xs text-[#657168]">P {item.proteinGrams === null ? "—" : format(item.proteinGrams, 1)} g · C {item.carbohydrateGrams === null ? "—" : format(item.carbohydrateGrams, 1)} g · G {item.fatGrams === null ? "—" : format(item.fatGrams, 1)} g</p>}</li>)}</ul>
        <button type="button" className="button-primary mt-3 w-full" disabled={!canConsume || pendingMeal !== null || completed} onClick={() => consumeMeal(meal.label)}>{pendingMeal === meal.label ? "Registrando…" : completed ? "Refeição registrada" : "Comi esta refeição"}</button>
      </article>;
    })}</div>
    <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-sm font-bold ${error ? "text-[#b42318]" : "text-[#166534]"}`}>{message}</p>
  </section>;
}
