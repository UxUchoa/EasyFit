"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DIET_PLAN_APPLIED_EVENT, type DietPlanAppliedDetail } from "@/lib/diary/events";

type PlannedItem = {
  sourcePointer: string;
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

type ReviewFood = {
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
  portions: Array<{ id: string; name: string; unit: string; quantityInBaseUnit: string }>;
};

function format(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

function sourceLabel(source: string) {
  if (source === "USDA_FDC") return "USDA FoodData Central";
  if (source === "OPEN_FOOD_FACTS") return "Open Food Facts";
  if (source === "TACO_BR") return "Tabela TACO";
  if (source === "PRIVATE") return "Catálogo pessoal";
  return source;
}

function normalizedUnit(unit: string) {
  const normalized = unit.trim().toLocaleLowerCase("pt-BR");
  return ["un", "und", "unid", "unidade", "unidades"].includes(normalized) ? "unidade" : normalized;
}

function supportsPlanUnit(food: ReviewFood, requestedUnit: string) {
  const requested = normalizedUnit(requestedUnit);
  const base = normalizedUnit(food.baseUnit);
  if (requested === base) return true;
  const mass = new Set(["g", "kg"]);
  const volume = new Set(["ml", "l"]);
  if ((mass.has(requested) && mass.has(base)) || (volume.has(requested) && volume.has(base))) return true;
  return food.portions.some((portion) => normalizedUnit(portion.unit) === requested || normalizedUnit(portion.name) === requested);
}

export function ActiveDietPlan({ planName, dayLabel, date, meals }: { planName: string; dayLabel: string; date: string; meals: PlannedMeal[] }) {
  const router = useRouter();
  const reviewDialogRef = useRef<HTMLDialogElement>(null);
  const [currentMeals, setCurrentMeals] = useState(meals);
  const [pendingMeal, setPendingMeal] = useState<string | null>(null);
  const [completedMeals, setCompletedMeals] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [itemPending, setItemPending] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<PlannedItem | null>(null);
  const [addingToMeal, setAddingToMeal] = useState<PlannedMeal | null>(null);
  const [newQuantity, setNewQuantity] = useState("100");
  const [newUnit, setNewUnit] = useState("g");
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewFoods, setReviewFoods] = useState<ReviewFood[]>([]);
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewSearchedExternal, setReviewSearchedExternal] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if ((reviewing || addingToMeal) && dialog && !dialog.open) dialog.showModal();
  }, [reviewing, addingToMeal]);

  const totals = currentMeals.flatMap((meal) => meal.items).reduce((sum, item) => ({
    calories: sum.calories + (item.calories ?? 0),
    protein: sum.protein + (item.proteinGrams ?? 0),
    carbs: sum.carbs + (item.carbohydrateGrams ?? 0),
    fat: sum.fat + (item.fatGrams ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const unresolved = currentMeals.flatMap((meal) => meal.items).filter((item) => item.calories === null).length;

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
      setMessage(result?.skipped ? `Refeição registrada; ${result.skipped} item(ns) sem nutrientes foram ignorados.` : "Refeição registrada com calorias e macros.");
      if (result?.mealSlug && result.entries?.length) window.dispatchEvent(new CustomEvent<DietPlanAppliedDetail>(DIET_PLAN_APPLIED_EVENT, { detail: { mealSlug: result.mealSlug, entries: result.entries } }));
      router.refresh();
    }
    setPendingMeal(null);
  }

  async function searchReviewFoods(query: string, includeExternal = false) {
    if (query.trim().length < 2) return;
    setReviewPending(true); setReviewError(""); setReviewFoods([]);
    let response = await fetch(`/api/foods/search?q=${encodeURIComponent(query.trim())}${includeExternal ? "&external=1" : ""}`).catch(() => null);
    let result = response ? await response.json().catch(() => ({})) as { foods?: ReviewFood[]; error?: string; externalSearchUnavailable?: boolean } : null;
    if (response?.ok && !includeExternal && !(result?.foods?.length)) {
      response = await fetch(`/api/foods/search?q=${encodeURIComponent(query.trim())}&external=1`).catch(() => null);
      result = response ? await response.json().catch(() => ({})) as typeof result : null;
      includeExternal = true;
    }
    setReviewSearchedExternal(includeExternal);
    if (!response?.ok) setReviewError(result?.error ?? "Não foi possível pesquisar os alimentos.");
    else {
      setReviewFoods(result?.foods ?? []);
      if (!(result?.foods?.length)) setReviewError(result?.externalSearchUnavailable ? "As bases externas estão indisponíveis agora. Tente novamente." : "Nenhuma alternativa encontrada. Tente um termo mais simples.");
    }
    setReviewPending(false);
  }

  function openReview(item: PlannedItem) {
    setAddingToMeal(null); setReviewing(item); setReviewQuery(item.name); setReviewFoods([]); setReviewError(""); setReviewSearchedExternal(false);
    void searchReviewFoods(item.name);
  }

  function openAdd(meal: PlannedMeal) {
    setReviewing(null); setAddingToMeal(meal); setReviewQuery(""); setReviewFoods([]); setReviewError(""); setReviewSearchedExternal(false); setNewQuantity("100"); setNewUnit("g");
  }

  function closeReview() {
    reviewDialogRef.current?.close();
    setReviewing(null); setAddingToMeal(null); setReviewFoods([]); setReviewError("");
  }

  async function selectReviewFood(food: ReviewFood) {
    if (!reviewing && !addingToMeal) return;
    setReviewPending(true); setReviewError("");
    const adding = Boolean(addingToMeal);
    const response = await fetch(adding ? "/api/diet-plans/active/items" : "/api/diet-plans/active/review", {
      method: adding ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding ? {
        dayLabel,
        mealLabel: addingToMeal!.label,
        foodId: food.id,
        name: food.name,
        quantity: Number(newQuantity),
        unit: newUnit,
      } : { sourcePointer: reviewing!.sourcePointer, foodId: food.id }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { item?: PlannedItem; error?: string } : null;
    if (!response?.ok || !result?.item) {
      setReviewError(result?.error ?? "Não foi possível usar este alimento.");
      setReviewPending(false);
      return;
    }
    setCurrentMeals((current) => current.map((meal) => meal.label === addingToMeal?.label
      ? { ...meal, items: [...meal.items, result.item!] }
      : { ...meal, items: meal.items.map((item) => item.sourcePointer === result.item!.sourcePointer ? result.item! : item) }));
    setMessage(adding ? `${food.name} foi adicionado a ${addingToMeal!.label}.` : `${reviewing!.name} foi associado a ${food.name} e recalculado.`);
    setError(false);
    setReviewPending(false);
    closeReview();
    router.refresh();
  }

  async function updatePlanItem(event: FormEvent<HTMLFormElement>, item: PlannedItem) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setItemPending(item.sourcePointer); setMessage(""); setError(false);
    const response = await fetch("/api/diet-plans/active/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePointer: item.sourcePointer, name: data.get("name"), quantity: Number(data.get("quantity")), unit: data.get("unit") }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { item?: PlannedItem; error?: string } : null;
    if (!response?.ok || !result?.item) {
      setError(true); setMessage(result?.error ?? "Não foi possível atualizar o item.");
    } else {
      setCurrentMeals((current) => current.map((meal) => ({ ...meal, items: meal.items.map((candidate) => candidate.sourcePointer === result.item!.sourcePointer ? result.item! : candidate) })));
      setMessage(`${result.item.name} foi atualizado na dieta.`);
    }
    setItemPending(null);
  }

  async function removePlanItem(item: PlannedItem) {
    if (!window.confirm(`Remover “${item.name}” desta dieta?`)) return;
    setItemPending(item.sourcePointer); setMessage(""); setError(false);
    const response = await fetch("/api/diet-plans/active/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePointer: item.sourcePointer }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
    if (!response?.ok) {
      setError(true); setMessage(result?.error ?? "Não foi possível remover o item.");
    } else {
      setCurrentMeals((current) => current.map((meal) => ({ ...meal, items: meal.items.filter((candidate) => candidate.sourcePointer !== item.sourcePointer) })));
      setMessage(`${item.name} foi removido da dieta.`);
    }
    setItemPending(null);
  }

  return <section id="plano-ativo" className="card mt-6 p-5 sm:p-7" aria-labelledby="active-diet-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Plano ativo · {dayLabel}</p><h2 id="active-diet-title" className="mt-2 text-2xl font-black">{planName}</h2><p className="mt-2 text-sm leading-6 text-[#657168]">{editMode ? "Ajuste os itens abaixo ou pesquise novos alimentos para esta dieta." : "Siga a prescrição do dia e registre cada refeição quando consumir."}</p></div>
      <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" className="button-secondary !min-h-11 !px-4" onClick={() => setEditMode((current) => !current)}>{editMode ? "Concluir edição" : "Editar dieta"}</button><div className="rounded-2xl bg-[#153d28] px-4 py-3 text-right text-white"><strong className="text-xl">{format(totals.calories)} kcal</strong><p className="text-xs text-white/70">P {format(totals.protein, 1)} g · C {format(totals.carbs, 1)} g · G {format(totals.fat, 1)} g</p></div></div>
    </div>
    {unresolved > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fffbed] p-3 text-sm font-bold text-[#725d00]"><p>{unresolved} item(ns) precisam de revisão. Escolha o alimento correto no catálogo ou nas APIs abertas.</p><button type="button" className="rounded-full border border-[#d8c56e] bg-white px-4 py-2 text-xs font-black" onClick={() => { const next = currentMeals.flatMap((meal) => meal.items).find((item) => item.calories === null); if (next) openReview(next); }}>Revisar próximo alimento</button></div>}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{currentMeals.map((meal) => {
      const mealCalories = meal.items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
      const canConsume = Boolean(meal.slug && meal.items.some((item) => item.calories !== null));
      const completed = completedMeals.includes(meal.label);
      return <article key={meal.label} className="rounded-2xl border border-[#dfe5dc] p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{meal.label}</h3><p className="mt-1 text-sm text-[#657168]">{format(mealCalories)} kcal previstas</p></div>{completed && <span className="rounded-full bg-[#e9f5e9] px-2 py-1 text-[10px] font-black text-[#166534]">REGISTRADA</span>}</div>
        <ul className="mt-3 divide-y divide-[#edf0eb]">{meal.items.map((item) => <li key={item.sourcePointer} className="py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong>{item.name}</strong>{item.calories === null && <span className="rounded-full bg-[#fff0b8] px-2 py-1 text-[10px] font-black text-[#725d00]">PRECISA DE REVISÃO</span>}</div><p className="mt-1 text-xs text-[#657168]">{format(item.quantity, 2)} {item.unit}{item.source ? ` · ${sourceLabel(item.source)}` : ""}</p></div><div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end"><span className="whitespace-nowrap text-right font-bold">{item.calories === null ? "Sem cálculo" : `${format(item.calories)} kcal`}</span><button type="button" aria-label={`${item.calories === null ? "Revisar e escolher alimento para" : "Trocar alimento"} ${item.name}`} className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-xs font-black shadow-sm ${item.calories === null ? "border-[#d8c56e] bg-[#fff8d9] text-[#725d00] hover:bg-[#fff0b8]" : "border-[#b9d4bd] bg-white text-[#166534] hover:bg-[#edf4eb]"}`} onClick={() => openReview(item)}><span aria-hidden="true">{item.calories === null ? "!" : "↔"}</span><span className="ml-2">{item.calories === null ? "Revisar e escolher" : "Trocar alimento"}</span></button></div></div>
          {item.calories !== null && <p className="mt-1 text-xs text-[#657168]">P {item.proteinGrams === null ? "—" : format(item.proteinGrams, 1)} g · C {item.carbohydrateGrams === null ? "—" : format(item.carbohydrateGrams, 1)} g · G {item.fatGrams === null ? "—" : format(item.fatGrams, 1)} g</p>}
          {editMode && <form className="mt-3 grid gap-3 rounded-2xl bg-[#f4f6f1] p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]" onSubmit={(event) => void updatePlanItem(event, item)}>
            <div className="field"><label htmlFor={`plan-name-${item.sourcePointer}`}>Nome no plano</label><input id={`plan-name-${item.sourcePointer}`} name="name" defaultValue={item.name} minLength={1} maxLength={180} required /></div>
            <div className="field"><label htmlFor={`plan-quantity-${item.sourcePointer}`}>Quantidade</label><input id={`plan-quantity-${item.sourcePointer}`} name="quantity" type="number" inputMode="decimal" defaultValue={item.quantity} min="0.001" step="0.001" required /></div>
            <div className="field"><label htmlFor={`plan-unit-${item.sourcePointer}`}>Unidade</label><input id={`plan-unit-${item.sourcePointer}`} name="unit" defaultValue={item.unit} maxLength={24} required /></div>
            <div className="flex gap-2 sm:col-span-3"><button className="button-secondary !min-h-10 flex-1 !px-3" disabled={itemPending !== null}>{itemPending === item.sourcePointer ? "Salvando…" : "Salvar alterações"}</button><button type="button" className="rounded-full border border-[#f0d5d2] px-4 py-2 text-xs font-black text-[#b42318]" disabled={itemPending !== null} onClick={() => void removePlanItem(item)}>Remover</button></div>
          </form>}
        </li>)}</ul>
        {editMode ? <button type="button" className="button-secondary mt-3 w-full" onClick={() => openAdd(meal)}>+ Adicionar alimento</button> : <button type="button" className="button-primary mt-3 w-full" disabled={!canConsume || pendingMeal !== null || completed} onClick={() => consumeMeal(meal.label)}>{pendingMeal === meal.label ? "Registrando…" : completed ? "Refeição registrada" : "Comi esta refeição"}</button>}
      </article>;
    })}</div>
    <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-sm font-bold ${error ? "text-[#b42318]" : "text-[#166534]"}`}>{message}</p>

    <dialog ref={reviewDialogRef} className="app-dialog m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-[1.75rem] border border-[#dfe5dc] bg-[#f8faf6] p-0 text-[#17201b] shadow-2xl backdrop:bg-[#07120c]/70" aria-labelledby="review-food-title" onCancel={closeReview} onClick={(event) => { if (event.target === event.currentTarget) closeReview(); }}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{addingToMeal ? "Adicionar à dieta" : "Revisar alimento"}</p><h2 id="review-food-title" className="mt-2 text-xl font-black">{addingToMeal ? addingToMeal.label : reviewing?.name}</h2><p className="mt-2 text-sm leading-6 text-[#657168]">{addingToMeal ? "Pesquise e selecione um alimento para incluir nesta refeição." : "Escolha qual alimento representa melhor o termo usado no plano. A quantidade original será preservada."}</p></div><button type="button" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#dfe5dc] bg-white text-xl" onClick={closeReview} aria-label="Fechar revisão">×</button></div>
        {addingToMeal && <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[#f4f6f1] p-4"><div className="field"><label htmlFor="new-plan-quantity">Quantidade</label><input id="new-plan-quantity" type="number" inputMode="decimal" min="0.001" step="0.001" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} required /></div><div className="field"><label htmlFor="new-plan-unit">Unidade</label><input id="new-plan-unit" value={newUnit} onChange={(event) => setNewUnit(event.target.value)} maxLength={24} required /></div></div>}
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void searchReviewFoods(reviewQuery); }}>
          <div className="field"><label htmlFor="review-food-query">Nome do alimento</label><input id="review-food-query" value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} minLength={2} required /></div>
          <button className="button-primary min-h-[3.25rem]" disabled={reviewPending}>{reviewPending ? "Buscando…" : "Pesquisar"}</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-[#657168]">{reviewSearchedExternal ? "Resultados do catálogo, USDA FoodData Central e Open Food Facts." : "Resultados encontrados primeiro no seu catálogo."}</p>{reviewFoods.length > 0 && !reviewSearchedExternal && <button type="button" className="rounded-full border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-black text-[#166534]" disabled={reviewPending} onClick={() => void searchReviewFoods(reviewQuery, true)}>Buscar também nas bases abertas</button>}</div>
        {reviewError && <p role="alert" className="mt-4 rounded-xl bg-[#fff1ef] p-3 text-sm font-bold text-[#b42318]">{reviewError}</p>}
        {reviewPending && reviewFoods.length === 0 && <div className="mt-4 grid gap-3" aria-label="Buscando alternativas"><div className="h-28 animate-pulse rounded-2xl bg-[#e9eee7]" /><div className="h-28 animate-pulse rounded-2xl bg-[#e9eee7]" /></div>}
        <div className="mt-4 grid gap-3">{reviewFoods.map((food) => {
          const targetUnit = reviewing?.unit ?? newUnit;
          const compatible = supportsPlanUnit(food, targetUnit);
          return <article key={food.id} className="rounded-2xl border border-[#dfe5dc] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-black">{food.name}</h3><p className="mt-1 text-xs font-bold text-[#166534]">{sourceLabel(food.source)}{food.brand ? ` · ${food.brand}` : ""}</p><p className="mt-2 text-sm text-[#657168]">{format(Number(food.calories), 1)} kcal por {food.baseQuantity} {food.baseUnit} · P {food.proteinGrams ?? "—"} g · C {food.carbohydrateGrams ?? "—"} g · G {food.fatGrams ?? "—"} g</p>{food.portions.length > 0 && <p className="mt-1 text-xs text-[#657168]">Porções: {food.portions.map((portion) => `${portion.name} = ${portion.quantityInBaseUnit} ${food.baseUnit}`).join(", ")}</p>}{!compatible && <p className="mt-2 text-xs font-bold text-[#8a6c00]">Sem equivalência para a unidade “{targetUnit}”.</p>}</div><button type="button" className="button-secondary !min-h-10 shrink-0 !px-4" disabled={reviewPending || !compatible || (addingToMeal !== null && (!Number.isFinite(Number(newQuantity)) || Number(newQuantity) <= 0))} onClick={() => void selectReviewFood(food)}>{compatible ? (addingToMeal ? "Adicionar" : "Usar este") : "Incompatível"}</button></div>
          </article>;
        })}</div>
      </div>
    </dialog>
  </section>;
}
