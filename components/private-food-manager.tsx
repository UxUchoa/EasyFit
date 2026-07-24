"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PrivateFood = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  baseQuantity: string;
  baseUnit: string;
  calories: string;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  fatGrams: string | null;
  fiberGrams: string | null;
  portions: Array<{ id: string; name: string; unit: string; quantityInBaseUnit: string }>;
};

function optionalNumber(data: FormData, name: string) {
  const value = String(data.get(name) ?? "").trim();
  return value ? Number(value) : null;
}

function parsePortions(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, unit, quantity] = line.split("|").map((part) => part.trim());
    if (!name || !unit || !quantity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) throw new Error("Use o formato nome | unidade | equivalente em cada porção.");
    return { name, unit, quantityInBaseUnit: Number(quantity) };
  });
}

export function PrivateFoodManager({ foods }: { foods: PrivateFood[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function update(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusy(id);
    setMessage("");
    setError(false);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/private-foods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), brand: String(data.get("brand") ?? "").trim() || null,
          barcode: String(data.get("barcode") ?? "").trim() || null,
          baseQuantity: Number(data.get("baseQuantity")), baseUnit: data.get("baseUnit"), calories: Number(data.get("calories")),
          proteinGrams: optionalNumber(data, "proteinGrams"), carbohydrateGrams: optionalNumber(data, "carbohydrateGrams"), fatGrams: optionalNumber(data, "fatGrams"), fiberGrams: optionalNumber(data, "fiberGrams"),
          portions: parsePortions(String(data.get("portions") ?? "")),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      setMessage("Alimento atualizado. Os registros antigos do diário continuam com seus snapshots originais.");
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }

  async function remove(food: PrivateFood) {
    if (!window.confirm(`Excluir “${food.name}” do seu catálogo? Registros anteriores serão preservados.`)) return;
    setBusy(food.id);
    setMessage("");
    const response = await fetch(`/api/private-foods/${food.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setError(true); setMessage("Não foi possível excluir o alimento."); }
    else { setError(false); setMessage("Alimento excluído do catálogo privado."); router.refresh(); }
    setBusy("");
  }

  return <>
    <p role="status" aria-live="polite" className={`mt-5 min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-[#166534]"}`}>{message}</p>
    {foods.length === 0 ? <section className="card mt-3 p-7"><h2 className="text-xl font-black">Nenhum alimento privado</h2><p className="mt-2 text-sm leading-6 text-[#657168]">Cadastre o primeiro pela tela Registro. Ele aparecerá aqui para manutenção.</p></section> : <div className="mt-3 grid gap-5">{foods.map((food) => <form key={food.id} className="card grid gap-4 p-6 sm:p-7" onSubmit={(event) => update(event, food.id)}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Alimento privado</p><h2 className="mt-1 text-xl font-black">{food.name}</h2></div><button type="button" className="rounded-full border border-[#f0d5d2] px-4 py-2 text-sm font-bold text-[#b42318]" disabled={busy === food.id} onClick={() => remove(food)}>Excluir</button></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="field"><label htmlFor={`name-${food.id}`}>Nome</label><input id={`name-${food.id}`} name="name" defaultValue={food.name} minLength={2} maxLength={180} required /></div><div className="field"><label htmlFor={`brand-${food.id}`}>Marca</label><input id={`brand-${food.id}`} name="brand" defaultValue={food.brand ?? ""} maxLength={120} /></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="field"><label htmlFor={`barcode-${food.id}`}>Código de barras</label><input id={`barcode-${food.id}`} name="barcode" inputMode="numeric" pattern="[0-9]{8,14}" defaultValue={food.barcode ?? ""} /></div><div className="field"><label htmlFor={`quantity-${food.id}`}>Porção de referência</label><input id={`quantity-${food.id}`} name="baseQuantity" type="number" min="0.001" step="0.001" defaultValue={food.baseQuantity} required /></div><div className="field"><label htmlFor={`unit-${food.id}`}>Unidade-base</label><select id={`unit-${food.id}`} name="baseUnit" defaultValue={food.baseUnit}><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="unidade">unidade</option></select></div></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><div className="field"><label htmlFor={`calories-${food.id}`}>Calorias</label><input id={`calories-${food.id}`} name="calories" type="number" min="0" step="0.1" defaultValue={food.calories} required /></div><div className="field"><label htmlFor={`protein-${food.id}`}>Proteína</label><input id={`protein-${food.id}`} name="proteinGrams" type="number" min="0" step="0.1" defaultValue={food.proteinGrams ?? ""} /></div><div className="field"><label htmlFor={`carbs-${food.id}`}>Carbo</label><input id={`carbs-${food.id}`} name="carbohydrateGrams" type="number" min="0" step="0.1" defaultValue={food.carbohydrateGrams ?? ""} /></div><div className="field"><label htmlFor={`fat-${food.id}`}>Gordura</label><input id={`fat-${food.id}`} name="fatGrams" type="number" min="0" step="0.1" defaultValue={food.fatGrams ?? ""} /></div><div className="field"><label htmlFor={`fiber-${food.id}`}>Fibra</label><input id={`fiber-${food.id}`} name="fiberGrams" type="number" min="0" step="0.1" defaultValue={food.fiberGrams ?? ""} /></div></div>
      <div className="field"><label htmlFor={`portions-${food.id}`}>Porções alternativas</label><textarea id={`portions-${food.id}`} name="portions" rows={Math.max(3, food.portions.length)} defaultValue={food.portions.map((portion) => `${portion.name} | ${portion.unit} | ${portion.quantityInBaseUnit}`).join("\n")} placeholder={"fatia | fatia | 25\ncopo | copo | 200"} /><p className="text-xs leading-5 text-[#657168]">Uma por linha: nome | unidade digitada | equivalente na unidade-base.</p></div>
      <button className="button-primary" disabled={busy === food.id}>{busy === food.id ? "Salvando…" : "Salvar alterações"}</button>
    </form>)}</div>}
  </>;
}
