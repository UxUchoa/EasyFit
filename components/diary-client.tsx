"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enqueueOfflineMutation, OFFLINE_SYNC_COMPLETED_EVENT, putOfflineMutation, type OfflineSyncCompletedDetail } from '@/lib/offline/queue';
import type { OfflineConflict } from '@/lib/offline/domain';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { FoodResultsSkeleton } from '@/components/page-skeletons';
import { DIET_PLAN_APPLIED_EVENT, type DietPlanAppliedDetail } from '@/lib/diary/events';

type DiaryEntry = {
  id: string;
  updatedAt: string;
  kind: "PLANNED" | "CONSUMED";
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  macrosComplete: boolean;
  revisions: Array<{ id: string; previousQuantity: number; nextQuantity: number; reason: string | null; correctedAt: string }>;
};

type DiaryMeal = {
  id: string | null;
  slug: string;
  label: string;
  custom: boolean;
  entries: DiaryEntry[];
};

type FoodResult = {
  id: string;
  name: string;
  brand: string | null;
  baseQuantity: string;
  baseUnit: string;
  calories: string;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  fatGrams: string | null;
  source: string;
  conflictKey: string | null;
  conflictSize: number;
  preferredSource: boolean;
  favorite: boolean;
  portions: Array<{ id: string; name: string; unit: string; quantityInBaseUnit: string }>;
};

function shiftedDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

type DiaryActionIconName = "search" | "barcode" | "quick" | "meal";

function DiaryActionIcon({ name }: { name: DiaryActionIconName }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "barcode") return <svg {...common}><path d="M4 5v14M8 5v14M11 5v14M16 5v14M20 5v14" /></svg>;
  if (name === "quick") return <svg {...common}><path d="M13 2 5 14h7l-1 8 8-12h-7l1-8Z" /></svg>;
  return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
}

export function DiaryClient({ date, today, userScope, meals: initialMeals, initialBarcode = "", initialScanner = false }: { date: string; today: string; userScope: string; meals: DiaryMeal[]; initialBarcode?: string; initialScanner?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [meals, setMeals] = useState(initialMeals);
  const [panel, setPanel] = useState<"quick" | "search" | "private" | "meal" | "barcode" | null>(initialBarcode ? "private" : initialScanner ? "barcode" : null);
  const [mealSlug, setMealSlug] = useState(meals[0]?.slug ?? "cafe-da-manha");
  const [entryKind, setEntryKind] = useState<"PLANNED" | "CONSUMED">("CONSUMED");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<FoodResult[]>([]);
  const [foodListLoaded, setFoodListLoaded] = useState(false);
  const [canSearchExternal, setCanSearchExternal] = useState(false);
  const [searchedExternal, setSearchedExternal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [notice, setNotice] = useState("");

  const activeDraftKey = panel === "quick" || panel === "private" ? `easyfit:draft:${date}:${panel}` : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel && dialog && !dialog.open) dialog.showModal();
  }, [panel]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const syncCompleted = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSyncCompletedDetail>).detail;
      const entry = detail?.response.entry as DiaryEntry | undefined;
      if (!entry) return;
      const targetMealSlug = typeof detail.mutation.body.mealSlug === 'string' ? detail.mutation.body.mealSlug : null;
      setMeals((items) => items.map((meal) => {
        if (meal.entries.some((candidate) => candidate.id === entry.id)) {
          return { ...meal, entries: meal.entries.map((candidate) => candidate.id === entry.id ? entry : candidate) };
        }
        if (detail.mutation.method === 'POST' && targetMealSlug === meal.slug) {
          return { ...meal, entries: [...meal.entries, entry] };
        }
        return meal;
      }));
      setNotice('Alteração offline sincronizada com o diário.');
    };
    window.addEventListener(OFFLINE_SYNC_COMPLETED_EVENT, syncCompleted);
    return () => window.removeEventListener(OFFLINE_SYNC_COMPLETED_EVENT, syncCompleted);
  }, []);

  useEffect(() => {
    const planApplied = (event: Event) => {
      const detail = (event as CustomEvent<DietPlanAppliedDetail<DiaryEntry>>).detail;
      if (!detail?.mealSlug || !detail.entries?.length) return;
      setMeals((items) => items.map((meal) => meal.slug === detail.mealSlug
        ? { ...meal, entries: [...meal.entries.filter((entry) => !detail.entries.some((next) => next.id === entry.id)), ...detail.entries] }
        : meal));
      setNotice('Refeição da dieta adicionada ao diário.');
    };
    window.addEventListener(DIET_PLAN_APPLIED_EVENT, planApplied);
    return () => window.removeEventListener(DIET_PLAN_APPLIED_EVENT, planApplied);
  }, []);

  function showNotice(message: string) {
    setNotice(message);
  }

  useEffect(() => {
    queueMicrotask(() => setDraftRestored(false));
    if (!activeDraftKey) return;
    try {
      const raw = window.localStorage.getItem(activeDraftKey);
      if (!raw) return;
      const values = JSON.parse(raw) as Record<string, string>;
      const form = document.querySelector<HTMLFormElement>(`section[data-draft-key="${activeDraftKey}"] form`);
      if (!form) return;
      for (const [name, value] of Object.entries(values)) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
      }
      queueMicrotask(() => setDraftRestored(true));
    } catch { window.localStorage.removeItem(activeDraftKey); }
  }, [activeDraftKey]);

  function saveDraft(event: FormEvent<HTMLElement>) {
    const key = event.currentTarget.dataset.draftKey;
    if (!key) return;
    const form = event.currentTarget.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;
    const values = Object.fromEntries([...new FormData(form).entries()].map(([name, value]) => [name, String(value)]));
    window.localStorage.setItem(key, JSON.stringify(values));
  }

  function clearDraft(kind: "quick" | "private") {
    window.localStorage.removeItem(`easyfit:draft:${date}:${kind}`);
    setDraftRestored(false);
  }

  const totals = useMemo(() => {
    const entries = meals.flatMap((meal) => meal.entries.filter((item) => item.kind === "CONSUMED"));
    const planned = meals.flatMap((meal) => meal.entries.filter((item) => item.kind === "PLANNED"));
    return {
      calories: entries.reduce((sum, item) => sum + item.calories, 0),
      protein: entries.reduce((sum, item) => sum + (item.proteinGrams ?? 0), 0),
      carbs: entries.reduce((sum, item) => sum + (item.carbohydrateGrams ?? 0), 0),
      fat: entries.reduce((sum, item) => sum + (item.fatGrams ?? 0), 0),
      complete: entries.every((item) => item.macrosComplete),
      plannedCalories: planned.reduce((sum, item) => sum + item.calories, 0),
    };
  }, [meals]);

  function openPanel(next: "quick" | "search" | "private" | "meal" | "barcode", slug?: string) {
    if (slug) setMealSlug(slug);
    setError("");
    if (next === "search") {
      setQuery("");
      setFoods([]);
      setFoodListLoaded(false);
      setCanSearchExternal(false);
      setSearchedExternal(false);
    }
    setPanel(next);
  }

  function closePanel() {
    setPanel(null);
    if (initialBarcode || initialScanner) window.history.replaceState(null, "", `/dieta?date=${date}`);
  }

  async function postEntry(payload: Record<string, unknown>, label = 'Novo registro alimentar') {
    setPending(true);
    setError("");
    const idempotencyKey = crypto.randomUUID();
    const body = { mealSlug, kind: entryKind, ...payload };
    const queueLocally = async () => {
      try {
        await enqueueOfflineMutation({ userScope, url: `/api/days/${date}/entries`, method: 'POST', body, idempotencyKey, label });
        setPanel(null);
        showNotice("Registro salvo no aparelho e aguardando sincronização.");
        return true;
      } catch { setError('Não foi possível preservar esta alteração no dispositivo.'); return false; }
    };
    try {
      if (!navigator.onLine) return await queueLocally();
      const response = await fetch(`/api/days/${date}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      body: JSON.stringify(body),
      });
      const result = (await response.json()) as { entry?: DiaryEntry; error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível adicionar o alimento.");
        return false;
      }
      if (!result.entry) {
        setError("O servidor não retornou o registro criado.");
        return false;
      }
      setMeals((items) => items.map((meal) => meal.slug === mealSlug
        ? { ...meal, entries: meal.entries.some((entry) => entry.id === result.entry!.id) ? meal.entries : [...meal.entries, result.entry!] }
        : meal));
      setPanel(null);
      showNotice(`${label} adicionado ao diário.`);
      return true;
    } catch {
      return await queueLocally();
    } finally {
      setPending(false);
    }
  }

  async function submitQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const caloriesInput = String(data.get("calories") ?? "").trim();
    const calories = Number(caloriesInput);
    if (name.length < 2) {
      setError("Informe uma descrição com pelo menos 2 caracteres.");
      document.getElementById("quick-name")?.focus();
      return;
    }
    if (caloriesInput === "" || !Number.isFinite(calories) || calories < 0) {
      setError("Informe a quantidade de calorias do alimento ou da refeição.");
      document.getElementById("quick-calories")?.focus();
      return;
    }
    const optional = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : Number(value);
    };
    const saved = await postEntry({
      quantity: 1,
      unit: "porção",
      quick: {
        name,
        calories,
        proteinGrams: optional("proteinGrams"),
        carbohydrateGrams: optional("carbohydrateGrams"),
        fatGrams: optional("fatGrams"),
      },
    }, name);
    if (saved) clearDraft("quick");
  }

  async function searchFoods(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFoodListLoaded(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`);
      let result = (await response.json()) as { foods?: FoodResult[]; error?: string; externalSearchUnavailable?: boolean; canSearchExternal?: boolean };
      if (!response.ok) setError(result.error ?? "A busca falhou.");
      if (response.ok && (result.foods?.length ?? 0) === 0) {
        const externalResponse = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}&external=1`);
        result = (await externalResponse.json()) as typeof result;
        if (!externalResponse.ok) setError(result.error ?? "A busca na base aberta falhou.");
        setSearchedExternal(true);
      } else {
        setSearchedExternal(false);
      }
      setFoods(result.foods ?? []);
      setCanSearchExternal(Boolean(result.canSearchExternal));
      if (result.externalSearchUnavailable) setError("A base aberta está temporariamente indisponível; exibimos apenas alimentos já salvos.");
    } catch {
      setError("Não foi possível buscar agora.");
    } finally {
      setPending(false);
    }
  }

  async function searchExternalFoods() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}&external=1`);
      const result = (await response.json()) as { foods?: FoodResult[]; error?: string; externalSearchUnavailable?: boolean };
      if (!response.ok) setError(result.error ?? "A busca na base aberta falhou.");
      setFoods(result.foods ?? []);
      setCanSearchExternal(false);
      setSearchedExternal(true);
      if (result.externalSearchUnavailable) setError("A base aberta está temporariamente indisponível; exibimos apenas alimentos já salvos.");
    } catch {
      setError("Não foi possível consultar a base aberta agora.");
    } finally {
      setPending(false);
    }
  }

  async function loadFoodScope(scope: "recent" | "favorites") {
    setFoodListLoaded(true);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/foods/search?scope=${scope}`);
      const result = (await response.json()) as { foods?: FoodResult[]; error?: string };
      if (!response.ok) setError(result.error ?? "Não foi possível carregar os alimentos.");
      setFoods(result.foods ?? []);
      setQuery("");
      setCanSearchExternal(false);
      setSearchedExternal(false);
    } catch {
      setError("Não foi possível carregar os alimentos agora.");
    } finally {
      setPending(false);
    }
  }

  async function toggleFavorite(food: FoodResult) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/foods/${food.id}/favorite`, { method: food.favorite ? "DELETE" : "POST" }).catch(() => null);
    if (!response?.ok) setError("Não foi possível atualizar o favorito.");
    else setFoods((items) => items.map((item) => item.id === food.id ? { ...item, favorite: !item.favorite } : item));
    setPending(false);
  }

  async function copyFromPrevious(sourceMealSlug?: string) {
    if (!sourceMealSlug && !window.confirm("Copiar todos os registros do dia anterior para este dia?")) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/days/${date}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDate: shiftedDate(date, -1), sourceMealSlug, targetMealSlug: sourceMealSlug }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string; copiedEntries?: number; entries?: Array<{ mealSlug: string; entry: DiaryEntry }> } : null;
    if (!response?.ok) setError(result?.error ?? "Não foi possível copiar os registros.");
    else {
      setMeals((items) => items.map((meal) => ({
        ...meal,
        entries: [...meal.entries, ...(result?.entries ?? []).filter((item) => item.mealSlug === meal.slug).map((item) => item.entry)],
      })));
      showNotice(sourceMealSlug ? "Refeição anterior copiada." : "Dia anterior copiado.");
    }
    setPending(false);
  }

  async function submitPrivateFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optional = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value === "" ? null : Number(value);
    };
    try {
      const response = await fetch("/api/private-foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          brand: data.get("brand"),
          barcode: data.get("barcode"),
          baseQuantity: Number(data.get("baseQuantity")),
          baseUnit: data.get("baseUnit"),
          calories: Number(data.get("calories")),
          proteinGrams: optional("proteinGrams"),
          carbohydrateGrams: optional("carbohydrateGrams"),
          fatGrams: optional("fatGrams"),
          fiberGrams: optional("fiberGrams"),
          portion: String(data.get("portionName") ?? "").trim() ? { name: data.get("portionName"), unit: data.get("portionUnit"), quantityInBaseUnit: Number(data.get("portionQuantity")) } : undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível cadastrar.");
        return;
      }
      openPanel("search");
      clearDraft("private");
      showNotice("Alimento salvo. Agora você pode pesquisá-lo no catálogo.");
    } catch {
      setError("Sem conexão. Os dados digitados foram preservados.");
    } finally {
      setPending(false);
    }
  }

  async function removeEntry(id: string) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) setError("Não foi possível remover o registro.");
    else {
      setMeals((items) => items.map((meal) => ({ ...meal, entries: meal.entries.filter((entry) => entry.id !== id) })));
      showNotice("Registro removido do diário.");
    }
    setPending(false);
  }

  async function confirmConsumed(id: string) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/entries/${id}/consume`, { method: "POST" }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { entry?: DiaryEntry } : null;
    if (!response?.ok || !result?.entry) setError("Não foi possível confirmar o consumo.");
    else {
      setMeals((items) => items.map((meal) => meal.entries.some((entry) => entry.id === id)
        ? { ...meal, entries: meal.entries.some((entry) => entry.id === result.entry!.id) ? meal.entries : [...meal.entries, result.entry!] }
        : meal));
      showNotice("Item marcado como consumido.");
    }
    setPending(false);
  }

  async function createMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/days/${date}/meals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name") }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { meal?: { id: string; slug: string; customName: string | null } } : null;
    if (!response?.ok || !result?.meal) setError("Não foi possível criar a refeição.");
    else {
      setPanel(null);
      setMeals((items) => [...items, { id: result.meal!.id, slug: result.meal!.slug, label: result.meal!.customName ?? "Refeição", custom: true, entries: [] }]);
      showNotice("Refeição personalizada criada.");
    }
    setPending(false);
  }

  async function updateMeal(id: string, data: { name?: string; position?: number }) {
    setPending(true);
    const response = await fetch(`/api/meals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { meal?: { id: string; customName: string | null; position: number } } : null;
    if (!response?.ok || !result?.meal) setError("Não foi possível atualizar a refeição.");
    else {
      setMeals((items) => {
        const updated = items.map((meal) => meal.id === id ? { ...meal, label: result.meal!.customName ?? meal.label } : meal);
        if (data.position === undefined) return updated;
        const from = updated.findIndex((meal) => meal.id === id);
        if (from < 0) return updated;
        const [moved] = updated.splice(from, 1);
        updated.splice(Math.min(Math.max(0, result.meal!.position), updated.length), 0, moved);
        return [...updated];
      });
      showNotice(data.name ? "Nome da refeição atualizado." : "Ordem das refeições atualizada.");
    }
    setPending(false);
  }

  async function removeMeal(id: string) {
    setPending(true);
    const response = await fetch(`/api/meals/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) setError("Não foi possível excluir a refeição.");
    else {
      setMeals((items) => items.filter((meal) => meal.id !== id));
      showNotice("Refeição excluída.");
    }
    setPending(false);
  }

  async function editQuantity(event: FormEvent<HTMLFormElement>, entry: DiaryEntry) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const body = { quantity: Number(data.get("quantity")), reason: String(data.get('reason') ?? '').trim() || undefined, expectedUpdatedAt: entry.updatedAt };
    const queueLocally = async (conflict: OfflineConflict | null = null, message: string | null = null) => {
      try {
        const queued = await enqueueOfflineMutation({ userScope, url: `/api/entries/${entry.id}`, method: 'PATCH', body, idempotencyKey: null, label: `Editar ${entry.name}` });
        if (conflict) await putOfflineMutation({ ...queued, status: 'CONFLICT', conflict, error: message });
        setEditingId(null);
        showNotice(conflict ? "Edição preservada para resolver um conflito." : "Edição salva no aparelho e aguardando sincronização.");
        return true;
      } catch { setError('Não foi possível preservar esta edição no dispositivo.'); return false; }
    };
    try {
      if (!navigator.onLine) { await queueLocally(); return; }
      const response = await fetch(`/api/entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { entry?: DiaryEntry; error?: string; conflict?: OfflineConflict };
      if (response.status === 409 && result.conflict) { await queueLocally(result.conflict, result.error ?? null); return; }
      if (!response.ok) { setError(result.error ?? "Não foi possível atualizar a quantidade."); return; }
      if (!result.entry) { setError("O servidor não retornou o registro atualizado."); return; }
      setMeals((items) => items.map((meal) => ({
        ...meal,
        entries: meal.entries.map((candidate) => {
          if (candidate.id !== entry.id) return candidate;
          const revisions = [...result.entry!.revisions, ...candidate.revisions]
            .filter((revision, index, all) => all.findIndex((item) => item.id === revision.id) === index)
            .slice(0, 10);
          return { ...result.entry!, revisions };
        }),
      })));
      setEditingId(null);
      showNotice("Quantidade atualizada.");
    } catch { await queueLocally(); }
    finally { setPending(false); }
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <Link className="button-secondary !min-h-11 !px-4" href={`/dieta?date=${shiftedDate(date, -1)}`} aria-label="Dia anterior">←</Link>
        <time dateTime={date} className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-black">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}
        </time>
        <Link className="button-secondary !min-h-11 !px-4" href={`/dieta?date=${shiftedDate(date, 1)}`} aria-label="Próximo dia">→</Link>
      </div>

      <section aria-label="Resumo nutricional" className="mt-5 rounded-[1.75rem] bg-[#153d28] p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-bold text-white/60">CONSUMIDO</p><p className="mt-1 text-4xl font-black">{formatNumber(totals.calories)} <span className="text-base font-medium text-white/60">kcal</span></p></div>
          <div className="grid grid-cols-3 gap-5 text-sm"><span><b>{formatNumber(totals.protein, 1)} g</b><br /><small className="text-white/55">proteína</small></span><span><b>{formatNumber(totals.carbs, 1)} g</b><br /><small className="text-white/55">carbo</small></span><span><b>{formatNumber(totals.fat, 1)} g</b><br /><small className="text-white/55">gordura</small></span></div>
        </div>
        {!totals.complete && <p className="mt-4 text-xs font-bold text-[#d8f24a]">Macros parciais: há registros somente com calorias.</p>}
        {totals.plannedCalories > 0 && <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/70">Planejado: <strong className="text-white">{formatNumber(totals.plannedCalories)} kcal</strong> · diferença realizada: <strong className="text-white">{formatNumber(totals.calories - totals.plannedCalories)} kcal</strong></p>}
      </section>

      <section className="mt-5" aria-labelledby="diary-actions-title">
        <div className="flex items-end justify-between gap-3">
          <div><p className="eyebrow">Registro rápido</p><h2 id="diary-actions-title" className="mt-1 text-xl font-black">Como quer adicionar?</h2></div>
          <p className="hidden text-xs text-[#657168] sm:block">Tudo fica na refeição escolhida</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button type="button" data-testid="diary-action-search" className="action-tile action-tile-primary" onClick={() => openPanel("search")}><span className="action-tile-icon"><DiaryActionIcon name="search" /></span><span><strong>Buscar alimento</strong><small>Nome ou marca</small></span></button>
          <button type="button" className="action-tile" onClick={() => openPanel("barcode")}><span className="action-tile-icon"><DiaryActionIcon name="barcode" /></span><span><strong>Ler código</strong><small>Use a câmera</small></span></button>
          <button type="button" data-testid="diary-action-quick" className="action-tile" onClick={() => openPanel("quick")}><span className="action-tile-icon"><DiaryActionIcon name="quick" /></span><span><strong>Calorias rápidas</strong><small>Digite os valores</small></span></button>
          <button type="button" className="action-tile" onClick={() => openPanel("meal")}><span className="action-tile-icon"><DiaryActionIcon name="meal" /></span><span><strong>Nova refeição</strong><small>Personalize o dia</small></span></button>
        </div>
      </section>

      <details className="utility-panel card mt-4 overflow-hidden">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-3 font-black text-[#334039] hover:bg-[#f8faf6]">
          <span><span className="block text-sm">Mais opções do diário</span><span className="mt-0.5 block text-xs font-medium text-[#657168]">Copiar registros e gerenciar seu catálogo</span></span>
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#edf4eb] text-lg text-[#166534]">⌄</span>
        </summary>
        <div className="border-t border-[#dfe5dc] p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="button-secondary" disabled={pending} onClick={() => copyFromPrevious()}>Copiar dia anterior</button>
            <button className="button-secondary" onClick={() => openPanel("private")}>Cadastrar alimento pelo rótulo</button>
            <Link className="button-secondary sm:col-span-2" href="/alimentos">Gerenciar alimentos privados</Link>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-[#f4f6f1] p-4"><div className="field min-w-52 flex-1"><label htmlFor="copy-meal">Copiar refeição do dia anterior</label><select id="copy-meal" value={mealSlug} onChange={(event) => setMealSlug(event.target.value)}>{meals.map((meal) => <option key={meal.slug} value={meal.slug}>{meal.label}</option>)}</select></div><button className="button-secondary" disabled={pending} onClick={() => copyFromPrevious(mealSlug)}>Copiar refeição</button></div>
        </div>
      </details>

      {panel && (
        <dialog ref={dialogRef} className="app-dialog m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-[1.75rem] border border-[#dfe5dc] bg-[#f8faf6] p-0 text-[#17201b] shadow-2xl backdrop:bg-[#07120c]/70" aria-labelledby="entry-panel-title" onClose={closePanel} onCancel={() => setPanel(null)} onClick={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
        <div className="p-4 sm:p-7" data-draft-key={activeDraftKey ?? undefined} onInput={saveDraft}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Adicionar à dieta</p><h2 id="entry-panel-title" className="mt-2 text-xl font-black">{panel === "quick" ? "Adição rápida" : panel === "search" ? "Buscar alimento" : panel === "private" ? "Cadastrar pelo rótulo" : panel === "barcode" ? "Ler código de barras" : "Refeição personalizada"}</h2>{panel === "barcode" && <p className="mt-2 text-sm text-[#657168]">Leitura local e consulta gratuita no Open Food Facts.</p>}</div>
            <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#dfe5dc] bg-white text-xl" onClick={closePanel} aria-label="Fechar e voltar para a dieta">×</button>
          </div>
          {panel !== "private" && panel !== "meal" && panel !== "barcode" && <div className="field mt-5"><label htmlFor="mealSlug">Refeição</label><select id="mealSlug" value={mealSlug} onChange={(event) => setMealSlug(event.target.value)}>{meals.map((meal) => <option key={meal.slug} value={meal.slug}>{meal.label}</option>)}</select></div>}
          {panel !== "private" && panel !== "meal" && panel !== "barcode" && <div className="field mt-4"><label htmlFor="entryKind">Tipo de registro</label><select id="entryKind" value={entryKind} onChange={(event) => setEntryKind(event.target.value as "PLANNED" | "CONSUMED")}><option value="CONSUMED">Já consumi</option><option value="PLANNED">Estou planejando</option></select></div>}

          {panel === "barcode" && <BarcodeScanner
            date={date}
            meals={meals.map((meal) => ({ slug: meal.slug, label: meal.label }))}
            onAdded={(slug, entry) => {
              setMeals((items) => items.map((meal) => meal.slug === slug
                ? { ...meal, entries: meal.entries.some((candidate) => candidate.id === entry.id) ? meal.entries : [...meal.entries, entry] }
                : meal));
              setPanel(null);
              showNotice("Produto adicionado ao diário.");
              window.history.replaceState(null, "", `/dieta?date=${date}`);
            }}
            onManualSearch={() => openPanel("search")}
            onManualRegister={(barcode) => router.replace(`/dieta?date=${date}&barcode=${encodeURIComponent(barcode)}`)}
          />}

          {panel === "quick" && (
            <div className="mt-5" aria-busy={pending}>
              <div className="rounded-2xl border border-[#dfe5dc] bg-[#f4f6f1] p-4">
                <h3 className="font-black">O que você deseja adicionar?</h3>
                <p className="mt-1 text-sm leading-6 text-[#657168]">Use a adição rápida quando você já souber as calorias. Para escolher um produto e preencher os nutrientes automaticamente, pesquise no catálogo.</p>
                <button type="button" className="button-secondary mt-3 w-full min-h-12" onClick={() => openPanel("search")}>Pesquisar alimento no catálogo</button>
              </div>
          
              <form noValidate onSubmit={submitQuick} className="mt-5 grid gap-4">
                <div className="field">
                  <label htmlFor="quick-name">Descrição <span aria-hidden="true" className="text-[#b42318]">*</span></label>
                  <input id="quick-name" name="name" minLength={2} maxLength={180} aria-required="true" placeholder="Ex.: almoço no restaurante" />
                </div>
                <div className="field">
                  <label htmlFor="quick-calories">Calorias (kcal) <span aria-hidden="true" className="text-[#b42318]">*</span></label>
                  <input id="quick-calories" name="calories" type="number" inputMode="decimal" min="0" step="0.1" aria-required="true" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="field"><label htmlFor="quick-protein">Proteína (g)</label><input id="quick-protein" name="proteinGrams" type="number" min="0" step="0.1" /></div>
                  <div className="field"><label htmlFor="quick-carbs">Carboidratos (g)</label><input id="quick-carbs" name="carbohydrateGrams" type="number" min="0" step="0.1" /></div>
                  <div className="field"><label htmlFor="quick-fat">Gordura (g)</label><input id="quick-fat" name="fatGrams" type="number" min="0" step="0.1" /></div>
                </div>
                <p className="text-xs leading-5 text-[#657168]"><span className="font-black text-[#b42318]">*</span> Campos obrigatórios. Os macronutrientes são opcionais e não serão inventados se ficarem vazios.</p>
                <button className="button-primary" disabled={pending}>{pending ? "Salvando…" : "Adicionar ao diário"}</button>
              </form>
            </div>
          )}

          {panel === "search" && (
            <div className="mt-5" aria-busy={pending}>
              <form data-testid="food-search-form" onSubmit={searchFoods} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="field">
                  <label htmlFor="food-query">Pesquisar por nome ou marca</label>
                  <input id="food-query" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} required placeholder="Ex.: aveia, iogurte, arroz…" />
                </div>
                <button className="button-primary min-h-12 sm:self-end" disabled={pending}>{pending ? "Buscando…" : "Pesquisar"}</button>
              </form>
          
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtros do catálogo">
                <button type="button" className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold" onClick={() => loadFoodScope("recent")} disabled={pending}>Recentes</button>
                <button type="button" className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold" onClick={() => loadFoodScope("favorites")} disabled={pending}>Favoritos</button>
              </div>

              {!foodListLoaded && <p className="mt-5 rounded-2xl bg-[#f4f6f1] p-4 text-sm leading-6 text-[#657168]">Digite o nome ou a marca do alimento e toque em <strong>Pesquisar</strong> para consultar o Open Food Facts.</p>}

              {foodListLoaded && <>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black">Produtos disponíveis</h3>
                  <p className="mt-1 text-xs text-[#657168]">{pending && foods.length === 0 ? "Carregando catálogo…" : `${foods.length} produto${foods.length === 1 ? "" : "s"}`}</p>
                </div>
                <span className="rounded-full bg-[#edf4eb] px-3 py-1 text-xs font-black text-[#166534]">{searchedExternal ? "Open Food Facts + salvos" : "Resultados salvos"}</span>
              </div>

              {canSearchExternal && <button type="button" className="button-secondary mt-3 w-full min-h-12" onClick={searchExternalFoods} disabled={pending}>Buscar também na base aberta</button>}
          
              <div className="mt-4 grid gap-4">
                {pending && foods.length === 0 && <FoodResultsSkeleton />}
                {foods.map((food) => (
                  <article key={food.id} className="rounded-2xl border border-[#dfe5dc] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black leading-5">{food.name}</h3>
                        <p className="mt-1 text-sm text-[#657168]">{food.brand || "Sem marca"}</p>
                        <p className="mt-1 text-xs font-bold text-[#166534]">Fonte: {food.source === "PRIVATE" ? "cadastro privado" : food.source === "TACO_BR" ? "Tabela TACO (Brasil)" : food.source === "OPEN_FOOD_FACTS" ? "Open Food Facts" : food.source}</p>
                      </div>
                      <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#dfe5dc] bg-white text-xl" onClick={() => toggleFavorite(food)} disabled={pending} aria-label={food.favorite ? `Remover ${food.name} dos favoritos` : `Favoritar ${food.name}`}>{food.favorite ? "★" : "☆"}</button>
                    </div>
          
                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#657168]">Porção de referência: {food.baseQuantity} {food.baseUnit}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[#f4f6f1] p-3"><dt className="text-xs text-[#657168]">Calorias</dt><dd className="mt-1 font-black">{formatNumber(Number(food.calories), 1)} kcal</dd></div>
                      <div className="rounded-xl bg-[#f4f6f1] p-3"><dt className="text-xs text-[#657168]">Proteína</dt><dd className="mt-1 font-black">{food.proteinGrams === null ? "—" : `${formatNumber(Number(food.proteinGrams), 1)} g`}</dd></div>
                      <div className="rounded-xl bg-[#f4f6f1] p-3"><dt className="text-xs text-[#657168]">Carboidratos</dt><dd className="mt-1 font-black">{food.carbohydrateGrams === null ? "—" : `${formatNumber(Number(food.carbohydrateGrams), 1)} g`}</dd></div>
                      <div className="rounded-xl bg-[#f4f6f1] p-3"><dt className="text-xs text-[#657168]">Gordura</dt><dd className="mt-1 font-black">{food.fatGrams === null ? "—" : `${formatNumber(Number(food.fatGrams), 1)} g`}</dd></div>
                    </dl>
          
                    {food.portions.length > 0 && <p className="mt-3 text-xs leading-5 text-[#657168]">Outras porções: {food.portions.map((portion) => `${portion.name} (${portion.quantityInBaseUnit} ${food.baseUnit})`).join(", ")}</p>}
                    {food.conflictKey && <div className="mt-3 rounded-xl border border-[#eadc9c] bg-[#fffbed] p-3 text-xs leading-5 text-[#625521]"><p><strong>Conflito entre fontes:</strong> há {food.conflictSize} alternativas equivalentes. Compare os nutrientes antes de escolher.</p>{food.preferredSource && <p className="mt-1 font-black text-[#166534]">Esta foi sua última escolha para este grupo.</p>}</div>}
          
                    <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end" onSubmit={async (event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      await postEntry({ foodId: food.id, sourceConflictKey: food.conflictKey ?? undefined, quantity: Number(data.get("quantity")), unit: data.get("unit") }, food.name);
                    }}>
                      <div className="field"><label htmlFor={`quantity-${food.id}`}>Quantidade</label><input id={`quantity-${food.id}`} name="quantity" type="number" min="0.001" step="0.001" defaultValue={food.baseQuantity} required /></div>
                      <div className="field"><label htmlFor={`unit-${food.id}`}>Unidade</label><select id={`unit-${food.id}`} name="unit" defaultValue={food.baseUnit}><option value={food.baseUnit}>{food.baseUnit}</option>{food.portions.map((portion) => <option key={portion.id} value={portion.unit}>{portion.name}</option>)}</select></div>
                      <button className="button-primary min-h-[3.25rem] w-full px-4" disabled={pending}>{food.conflictKey ? "Escolher e adicionar" : "Adicionar"}</button>
                    </form>
                  </article>
                ))}
          
                {foods.length === 0 && !pending && foodListLoaded && (
                  <div className="rounded-2xl bg-[#f4f6f1] p-4 text-sm text-[#657168]">
                    <p>Nenhum produto encontrado. Tente outro nome ou cadastre os dados do rótulo.</p>
                    <button type="button" className="button-secondary mt-3 w-full min-h-12" onClick={() => { setPanel("private"); setError(""); }}>Cadastrar alimento manualmente</button>
                  </div>
                )}
              </div>
              </>}
            </div>
          )}

          {panel === "private" && <form onSubmit={submitPrivateFood} className="mt-5 grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><div className="field"><label htmlFor="private-name">Nome</label><input id="private-name" name="name" minLength={2} maxLength={180} required /></div><div className="field"><label htmlFor="private-brand">Marca (opcional)</label><input id="private-brand" name="brand" maxLength={120} /></div></div><div className="field"><label htmlFor="private-barcode">Código de barras (opcional)</label><input id="private-barcode" name="barcode" inputMode="numeric" pattern="[0-9]{8,14}" defaultValue={initialBarcode} /></div><div className="grid grid-cols-2 gap-4"><div className="field"><label htmlFor="base-quantity">Porção de referência</label><input id="base-quantity" name="baseQuantity" type="number" min="0.001" step="0.001" defaultValue="100" required /></div><div className="field"><label htmlFor="base-unit">Unidade</label><select id="base-unit" name="baseUnit" defaultValue="g"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="unidade">unidade</option></select></div></div><div className="field"><label htmlFor="private-calories">Calorias na porção (kcal)</label><input id="private-calories" name="calories" type="number" min="0" step="0.1" required /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="field"><label htmlFor="private-protein">Proteína (g)</label><input id="private-protein" name="proteinGrams" type="number" min="0" step="0.1" /></div><div className="field"><label htmlFor="private-carbs">Carbo (g)</label><input id="private-carbs" name="carbohydrateGrams" type="number" min="0" step="0.1" /></div><div className="field"><label htmlFor="private-fat">Gordura (g)</label><input id="private-fat" name="fatGrams" type="number" min="0" step="0.1" /></div><div className="field"><label htmlFor="private-fiber">Fibra (g)</label><input id="private-fiber" name="fiberGrams" type="number" min="0" step="0.1" /></div></div><fieldset className="rounded-2xl border border-[#dfe5dc] p-4"><legend className="px-2 text-sm font-black">Porção alternativa (opcional)</legend><div className="grid gap-3 sm:grid-cols-3"><div className="field"><label htmlFor="portion-name">Nome</label><input id="portion-name" name="portionName" placeholder="Ex.: fatia" /></div><div className="field"><label htmlFor="portion-unit">Unidade</label><input id="portion-unit" name="portionUnit" placeholder="fatia" /></div><div className="field"><label htmlFor="portion-quantity">Equivale a</label><input id="portion-quantity" name="portionQuantity" type="number" min="0.001" step="0.001" placeholder="25" /></div></div><p className="mt-2 text-xs text-[#657168]">Informe o equivalente na unidade de referência acima.</p></fieldset><p className="text-xs leading-5 text-[#657168]">Este alimento ficará visível somente na sua conta. Informe os valores exatamente para a porção de referência.</p><button className="button-primary" disabled={pending}>{pending ? "Cadastrando…" : "Salvar alimento privado"}</button></form>}
          {panel === "meal" && <form onSubmit={createMeal} className="mt-5 grid gap-4"><div className="field"><label htmlFor="custom-meal-name">Nome da refeição</label><input id="custom-meal-name" name="name" minLength={2} maxLength={80} required placeholder="Ex.: Pós-treino" /></div><button className="button-primary" disabled={pending}>{pending ? "Criando…" : "Criar refeição"}</button></form>}
          <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-sm font-bold ${error ? "text-[#b42318]" : draftRestored ? "text-[#725d00]" : "text-transparent"}`}>{error || (draftRestored ? "Rascunho local recuperado; ele ainda não foi enviado." : "Tudo certo")}</p>
        </div>
        </dialog>
      )}

      {notice && !error && <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#153d28] px-4 py-3 text-sm font-bold text-white shadow-2xl md:bottom-6" role="status" aria-live="polite"><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#d8f24a] text-[#153d28]">✓</span><span>{notice}</span></div>}
      {error && !panel && <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[#f0d5d2] bg-[#fff7f6] px-4 py-3 text-sm font-bold text-[#8f1f17] shadow-2xl md:bottom-6" role="alert"><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f7dfdc]">!</span><span className="flex-1">{error}</span><button type="button" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[#f7dfdc]" onClick={() => setError("")} aria-label="Fechar mensagem de erro">×</button></div>}

      <section className="mt-8 grid gap-4">
        {meals.map((meal) => {
          const consumedEntries = meal.entries.filter((entry) => entry.kind === "CONSUMED");
          const plannedEntries = meal.entries.filter((entry) => entry.kind === "PLANNED");
          const mealCalories = consumedEntries.reduce((sum, entry) => sum + entry.calories, 0);
          const plannedCalories = plannedEntries.reduce((sum, entry) => sum + entry.calories, 0);
          const percentDifference = plannedCalories > 0 ? Math.round(((mealCalories - plannedCalories) / plannedCalories) * 100) : null;
          return <article key={meal.slug} className="card p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{meal.label}</h2>{meal.custom && meal.id && <span className="rounded-full bg-[#edf4eb] px-2 py-1 text-[10px] font-black text-[#166534]">PERSONALIZADA</span>}</div><p className="mt-1 text-sm text-[#657168]">{consumedEntries.length ? `${formatNumber(mealCalories)} kcal realizadas` : "Nada consumido"}{plannedCalories > 0 ? ` · ${formatNumber(plannedCalories)} kcal planejadas${percentDifference === null ? "" : ` · ${percentDifference > 0 ? "+" : ""}${percentDifference}%`}` : ""}</p></div><button className="grid size-11 place-items-center rounded-full bg-[#edf4eb] text-xl font-black text-[#166534] hover:bg-[#d8f24a]" onClick={() => openPanel("quick", meal.slug)} aria-label={`Adicionar em ${meal.label}`}>+</button></div>{meal.custom && meal.id && <div className="mt-3 flex flex-wrap gap-2"><button className="rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" disabled={pending} onClick={() => { const name = window.prompt("Novo nome da refeição", meal.label); if (name) updateMeal(meal.id!, { name }); }}>Renomear</button><button className="rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" disabled={pending || meals.indexOf(meal) === 0} onClick={() => updateMeal(meal.id!, { position: Math.max(0, meals.indexOf(meal) - 1) })}>Mover acima</button><button className="rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" disabled={pending || meals.indexOf(meal) === meals.length - 1} onClick={() => updateMeal(meal.id!, { position: meals.indexOf(meal) + 1 })}>Mover abaixo</button><button className="rounded-full border border-[#f0d5d2] px-3 py-2 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => removeMeal(meal.id!)}>Excluir refeição</button></div>}{meal.entries.length > 0 && <ul className="mt-4 divide-y divide-[#e6ebe4]">{meal.entries.map((entry) => <li key={entry.id} className="py-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-bold">{entry.name}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${entry.kind === "PLANNED" ? "bg-[#fff5cc] text-[#725d00]" : "bg-[#e9f5e9] text-[#166534]"}`}>{entry.kind === "PLANNED" ? "PLANEJADO" : "REALIZADO"}</span></div><p className="mt-1 text-sm text-[#657168]">{formatNumber(entry.quantity, 2)} {entry.unit} · {formatNumber(entry.calories)} kcal{!entry.macrosComplete ? " · macros parciais" : ""}</p></div><div className="flex flex-wrap justify-end gap-2">{entry.kind === "PLANNED" && <button className="rounded-full bg-[#166534] px-3 py-2 text-xs font-bold text-white" disabled={pending} onClick={() => confirmConsumed(entry.id)}>Consumido</button>}<button className="rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" onClick={() => setEditingId(editingId === entry.id ? null : entry.id)}>Editar</button><button className="rounded-full border border-[#f0d5d2] px-3 py-2 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => removeEntry(entry.id)}>Remover</button></div></div>{editingId === entry.id && <form onSubmit={(event) => editQuantity(event, entry)} className='mt-3 grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto]'><div className='field'><label htmlFor={'edit-' + entry.id}>Nova quantidade ({entry.unit})</label><input id={'edit-' + entry.id} name='quantity' type='number' min='0.001' step='0.001' defaultValue={entry.quantity} required /></div>{date < today ? <div className='field'><label htmlFor={'reason-' + entry.id}>Motivo da correção</label><input id={'reason-' + entry.id} name='reason' minLength={2} maxLength={160} required placeholder='Ex.: quantidade anotada incorretamente' /></div> : <input type='hidden' name='reason' value='Ajuste no dia atual' />}<button className='button-primary !min-h-[3.25rem] !px-4' disabled={pending}>Salvar</button></form>}{entry.revisions.length > 0 && <details className='mt-3 rounded-xl bg-[#f5f7f3] p-3 text-xs'><summary className='cursor-pointer font-black text-[#166534]'>Histórico de correções ({entry.revisions.length})</summary><ul className='mt-2 grid gap-2'>{entry.revisions.map((revision) => <li key={revision.id}><time dateTime={revision.correctedAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(revision.correctedAt))}</time> · {formatNumber(revision.previousQuantity, 2)} → {formatNumber(revision.nextQuantity, 2)} {entry.unit}{revision.reason ? ' · ' + revision.reason : ''}</li>)}</ul></details>}</li>)}</ul>}</article>;
        })}
      </section>
    </>
  );
}
