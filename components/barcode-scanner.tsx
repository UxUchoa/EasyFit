"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type BarcodeResult = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string;
  baseQuantity: string;
  baseUnit: string;
  calories: string;
  proteinGrams: string | null;
  carbohydrateGrams: string | null;
  fatGrams: string | null;
  source: string;
  sourceReference: string | null;
};

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

type BarcodeScannerProps = {
  date: string;
  meals: Array<{ slug: string; label: string }>;
  initialMealSlug?: string;
  onAdded(mealSlug: string, entry: {
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
    revisions: [];
  }): void;
  onManualSearch(): void;
  onManualRegister(code: string): void;
};

function sourceLabel(source: string) {
  if (source === "OPEN_FOOD_FACTS") return "Open Food Facts · dados abertos";
  if (source === "TACO_BR") return "Tabela TACO · Brasil";
  if (source === "PRIVATE") return "Seu catálogo";
  return source;
}

export function BarcodeScanner({ date, meals, initialMealSlug, onAdded, onManualSearch, onManualRegister }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const frameRef = useRef<number | null>(null);
  const foundRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [manualRegistration, setManualRegistration] = useState(false);
  const [code, setCode] = useState("");
  const [food, setFood] = useState<BarcodeResult | null>(null);
  const [sourceWarning, setSourceWarning] = useState("");

  function stopCamera() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  useEffect(() => stopCamera, []);

  async function lookup(rawCode: string) {
    if (foundRef.current) return;
    foundRef.current = true;
    stopCamera();
    setPending(true);
    setError("");
    setFood(null);
    setManualRegistration(false);
    setCode(rawCode);
    try {
      const response = await fetch(`/api/barcode/${encodeURIComponent(rawCode)}`);
      const result = (await response.json()) as {
        food?: BarcodeResult;
        error?: string;
        manualRegistration?: boolean;
        warning?: string;
        stale?: boolean;
      };
      if (!response.ok || !result.food) {
        setError(result.error ?? "Produto não encontrado.");
        setManualRegistration(Boolean(result.manualRegistration));
        return;
      }
      setSourceWarning(result.warning ?? (result.stale ? "Dados antigos da fonte aberta." : ""));
      setFood(result.food);
    } catch {
      setError("Sem conexão. Você ainda pode buscar um alimento já salvo pelo nome.");
    } finally {
      setPending(false);
    }
  }

  async function startCamera() {
    stopCamera();
    foundRef.current = false;
    setFood(null);
    setSourceWarning("");
    setError("");
    setManualRegistration(false);
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setError("A câmera não está disponível neste navegador. Digite o código ou busque pelo nome.");
      return;
    }

    setScanning(true);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    try {
      if (Detector) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ["ean_8", "ean_13", "upc_a", "upc_e", "itf"] });
        const scanFrame = async () => {
          if (!videoRef.current || foundRef.current) return;
          const results = await detector.detect(videoRef.current).catch(() => []);
          if (results[0]?.rawValue) await lookup(results[0].rawValue);
          else frameRef.current = requestAnimationFrame(scanFrame);
        };
        frameRef.current = requestAnimationFrame(scanFrame);
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (result) => {
            if (result && !foundRef.current) void lookup(result.getText());
          },
        );
      }
    } catch {
      stopCamera();
      setError("Não foi possível usar a câmera. Autorize o acesso, digite o código ou busque pelo nome.");
    }
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    foundRef.current = false;
    await lookup(String(new FormData(event.currentTarget).get("gtin") ?? "").trim());
  }

  async function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!food) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const mealSlug = String(data.get("mealSlug") ?? "");
    const response = await fetch(`/api/days/${date}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        mealSlug,
        kind: data.get("kind"),
        foodId: food.id,
        quantity: Number(data.get("quantity")),
        unit: data.get("unit"),
      }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { entry?: Parameters<BarcodeScannerProps["onAdded"]>[1] } : null;
    if (!response?.ok || !result?.entry) setError("Não foi possível adicionar o produto ao diário.");
    else onAdded(mealSlug, result.entry);
    setPending(false);
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <section className="overflow-hidden rounded-[1.5rem] bg-[#122f21] text-white">
        <div className="relative aspect-[4/3] max-h-[44dvh] bg-black/25">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Prévia da câmera" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-3xl border-2 border-[#d8f24a] shadow-[0_0_0_999px_rgb(0_0_0/.28)]" />
          {!scanning && <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><p className="text-lg font-black">Posicione o código na moldura</p><p className="mt-2 text-sm text-white/65">EAN-8, UPC, EAN-13 e GTIN-14</p></div></div>}
        </div>
        <div className="p-4"><button type="button" className="button-primary w-full !bg-[#d8f24a] !text-[#17201b]" onClick={scanning ? stopCamera : startCamera}>{scanning ? "Parar câmera" : "Usar câmera"}</button><p className="mt-2 text-center text-xs text-white/55">A imagem não sai do aparelho. Só o número detectado é consultado.</p></div>
      </section>

      <section className="rounded-[1.5rem] border border-[#dfe5dc] bg-white p-4 sm:p-5">
        <h3 className="text-lg font-black">Digitar código</h3>
        <form onSubmit={submitManual} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><div className="field"><label htmlFor="manual-gtin">Código de barras</label><input id="manual-gtin" name="gtin" inputMode="numeric" pattern="[0-9]{8}|[0-9]{12,14}" maxLength={14} required placeholder="789…" /></div><button className="button-primary !px-4" disabled={pending}>{pending ? "Buscando…" : "Consultar"}</button></form>

        <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>{error || "Tudo certo"}</p>

        {(manualRegistration || error) && <div className="mt-2 grid gap-2 rounded-2xl bg-[#f4f6f1] p-4"><p className="text-sm font-bold">Não achou pelo código?</p><button type="button" className="button-primary w-full" onClick={onManualSearch}>Buscar alimento pelo nome</button>{manualRegistration && code && <button type="button" className="button-secondary w-full" onClick={() => onManualRegister(code)}>Cadastrar usando o rótulo</button>}</div>}

        {food && <article className="mt-3 rounded-2xl border border-[#dfe5dc] p-4"><p className="text-xs font-black text-[#166534]">{food.sourceReference ? <a className="underline" href={food.sourceReference} target="_blank" rel="noreferrer">{sourceLabel(food.source)}</a> : sourceLabel(food.source)}</p><h3 className="mt-2 text-xl font-black">{food.name}</h3><p className="mt-1 text-sm text-[#657168]">{food.brand || "Sem marca"}</p><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f4f6f1] p-4 text-sm"><span><b>{food.calories} kcal</b><br />por {food.baseQuantity} {food.baseUnit}</span><span><b>{food.proteinGrams ?? "—"} g</b><br />proteína</span><span>{food.carbohydrateGrams ?? "—"} g carbo</span><span>{food.fatGrams ?? "—"} g gordura</span></div>{sourceWarning && <p className="mt-3 rounded-xl bg-[#fffbed] p-3 text-xs font-bold leading-5 text-[#725d00]">{sourceWarning}</p>}<p className="mt-3 text-xs leading-5 text-[#657168]">Dados colaborativos podem estar incompletos. Confira o rótulo antes de adicionar.</p><form onSubmit={addFood} className="mt-4 grid gap-3"><div className="field"><label htmlFor="scanner-meal">Refeição</label><select id="scanner-meal" name="mealSlug" defaultValue={meals.some((meal) => meal.slug === initialMealSlug) ? initialMealSlug : meals[0]?.slug}>{meals.map((meal) => <option key={meal.slug} value={meal.slug}>{meal.label}</option>)}</select></div><div className="field"><label htmlFor="scanner-kind">Registro</label><select id="scanner-kind" name="kind" defaultValue="CONSUMED"><option value="CONSUMED">Já consumi</option><option value="PLANNED">Estou planejando</option></select></div><div className="grid grid-cols-2 gap-3"><div className="field"><label htmlFor="scanner-quantity">Quantidade</label><input id="scanner-quantity" name="quantity" type="number" min="0.001" step="0.001" defaultValue={food.baseQuantity} required /></div><div className="field"><label htmlFor="scanner-unit">Unidade</label><input id="scanner-unit" name="unit" defaultValue={food.baseUnit} required /></div></div><button className="button-primary" disabled={pending}>Adicionar ao diário</button></form></article>}

        {!food && !error && <button type="button" className="button-secondary mt-4 w-full" onClick={onManualSearch}>Prefiro buscar pelo nome</button>}
      </section>
    </div>
  );
}
