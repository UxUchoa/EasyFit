import type { Metadata } from "next";
import Link from "next/link";
import { PrivateFoodManager } from "@/components/private-food-manager";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Alimentos privados" };

export default async function PrivateFoodsPage() {
  const user = await requireUser();
  const foods = await db.food.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, include: { portions: { orderBy: { name: "asc" } } } });
  return <main className="shell py-8"><p className="eyebrow">Catálogo pessoal</p><h1 className="display mt-2 text-4xl font-bold">Alimentos privados.</h1><p className="mt-3 max-w-2xl leading-7 text-[#657168]">Edite dados nutricionais e equivalências como fatia, copo ou pacote. Alterações futuras não reescrevem seu histórico.</p><Link className="button-secondary mt-5" href="/dieta">← Voltar ao diário</Link><PrivateFoodManager foods={foods.map((food) => ({ ...food, baseQuantity: String(food.baseQuantity), calories: String(food.calories), proteinGrams: food.proteinGrams === null ? null : String(food.proteinGrams), carbohydrateGrams: food.carbohydrateGrams === null ? null : String(food.carbohydrateGrams), fatGrams: food.fatGrams === null ? null : String(food.fatGrams), fiberGrams: food.fiberGrams === null ? null : String(food.fiberGrams), portions: food.portions.map((portion) => ({ ...portion, quantityInBaseUnit: String(portion.quantityInBaseUnit) })) }))} /></main>;
}
