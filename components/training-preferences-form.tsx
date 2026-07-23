"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const EQUIPMENT = ["Peso corporal", "Halteres", "Barra", "Máquinas", "Cabos", "Faixas elásticas"];
const MUSCLE_GROUPS = ["Pernas", "Glúteos", "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraços", "Core"];

type Preferences = {
  objective: string;
  trainingExperience: string;
  trainingDaysPerWeek: number;
  physicalRestrictions: string;
  availableEquipment: string[];
  priorityMuscleGroups: string[];
};

export function TrainingPreferencesForm({ initial }: { initial: Preferences }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError(false);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/profile/training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: data.get("objective"),
        trainingExperience: data.get("trainingExperience"),
        trainingDaysPerWeek: Number(data.get("trainingDaysPerWeek")),
        physicalRestrictions: data.get("physicalRestrictions"),
        availableEquipment: data.getAll("availableEquipment"),
        priorityMuscleGroups: data.getAll("priorityMuscleGroups"),
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json()) as { error?: string }) : null;
      setMessage(result?.error ?? "Não foi possível salvar as preferências.");
      setError(true);
    } else {
      setMessage("Preferências de treino salvas.");
      router.refresh();
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3"><div className="field"><label htmlFor="training-objective">Objetivo</label><select id="training-objective" name="objective" defaultValue={initial.objective}><option value="lose">Reduzir peso</option><option value="maintain">Manter peso</option><option value="gain">Aumentar peso</option></select></div><div className="field"><label htmlFor="training-experience">Experiência</label><select id="training-experience" name="trainingExperience" defaultValue={initial.trainingExperience}><option value="beginner">Iniciante</option><option value="intermediate">Intermediário</option><option value="advanced">Avançado</option></select></div><div className="field"><label htmlFor="training-days">Dias por semana</label><input id="training-days" name="trainingDaysPerWeek" type="number" min="1" max="7" defaultValue={initial.trainingDaysPerWeek} required /></div></div>
      <fieldset><legend className="text-sm font-black">Equipamentos disponíveis</legend><div className="mt-3 flex flex-wrap gap-2">{EQUIPMENT.map((item) => <label key={item} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold"><input type="checkbox" name="availableEquipment" value={item} defaultChecked={initial.availableEquipment.includes(item)} />{item}</label>)}</div></fieldset>
      <fieldset><legend className="text-sm font-black">Grupos prioritários</legend><div className="mt-3 flex flex-wrap gap-2">{MUSCLE_GROUPS.map((item) => <label key={item} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold"><input type="checkbox" name="priorityMuscleGroups" value={item} defaultChecked={initial.priorityMuscleGroups.includes(item)} />{item}</label>)}</div></fieldset>
      <div className="field"><label htmlFor="training-restrictions">Restrições físicas informadas</label><textarea id="training-restrictions" name="physicalRestrictions" rows={4} maxLength={1000} defaultValue={initial.physicalRestrictions} /><p className="text-xs leading-5 text-[#657168]">Essas informações ajudam a filtrar opções; não são interpretadas como diagnóstico ou liberação médica.</p></div>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm font-bold ${error ? "text-[#b42318]" : "text-[#166534]"}`}>{message}</p>
      <button className="button-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar preferências de treino"}</button>
    </form>
  );
}
