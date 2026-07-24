const EXACT_PT_BR = new Map<string, string>([
  ["egg whole cooked hard boiled", "Ovo inteiro cozido"],
  ["egg whole cooked scrambled", "Ovo inteiro mexido"],
  ["egg whole cooked fried", "Ovo inteiro frito"],
  ["egg whole raw fresh", "Ovo inteiro cru"],
  ["egg white raw fresh", "Clara de ovo crua"],
  ["egg yolk raw fresh", "Gema de ovo crua"],
  ["bread white commercially prepared", "Pão branco industrializado"],
  ["bananas raw", "Banana crua"],
  ["apples raw with skin", "Maçã crua com casca"],
  ["oil olive salad or cooking", "Azeite de oliva para salada ou cozinha"],
]);

const PT_BR_PHRASES: Array<[string, string]> = [
  ["commercially prepared", "industrializado"],
  ["hard-boiled", "cozido"],
  ["whole milk", "leite integral"],
  ["long-grain", "grão longo"],
  ["short-grain", "grão curto"],
  ["meat only", "somente a carne"],
  ["without skin", "sem pele"],
  ["with skin", "com pele"],
  ["dry heat", "calor seco"],
  ["salad or cooking", "para salada ou cozinha"],
  ["chicken breast", "peito de frango"],
  ["turkey breast", "peito de peru"],
  ["olive oil", "azeite de oliva"],
  ["protein powder", "proteína em pó"],
  ["prepackaged", "pré-embalado"],
  ["mozzarella", "muçarela"],
  ["scrambled", "mexido"],
  ["poached", "pochê"],
  ["grilled", "grelhado"],
  ["roasted", "assado"],
  ["fried", "frito"],
  ["cooked", "cozido"],
  ["enriched", "enriquecido"],
  ["whole", "inteiro"],
  ["fresh", "fresco"],
  ["raw", "cru"],
  ["white", "branco"],
  ["egg", "ovo"],
  ["eggs", "ovos"],
  ["bread", "pão"],
  ["rice", "arroz"],
  ["cheese", "queijo"],
  ["milk", "leite"],
  ["chicken", "frango"],
  ["turkey", "peru"],
  ["fish", "peixe"],
  ["beef", "carne bovina"],
  ["pork", "carne suína"],
  ["bacon", "bacon"],
  ["banana", "banana"],
  ["bananas", "bananas"],
  ["apple", "maçã"],
  ["apples", "maçãs"],
  ["salad", "salada"],
  ["vegetables", "vegetais"],
  ["oil", "óleo"],
  ["with", "com"],
  ["without", "sem"],
];

const KNOWN_ENGLISH_TOKENS = new Set(PT_BR_PHRASES.flatMap(([english]) => normalized(english).split(" ")));
const ACCEPTED_BRAZILIAN_TERMS = new Set(["whey", "protein", "bacon", "light", "diet", "fitness"]);
const PORTUGUESE_CATALOG_TOKENS = new Set(["ovo", "ovos", "pao", "arroz", "banana", "bananas", "maca", "macas", "frango", "peru", "peixe", "carne", "bovina", "suina", "queijo", "mucarela", "leite", "azeite", "oleo", "salada", "vegetais", "cozido", "cozida", "mexido", "mexida", "frito", "frita", "grelhado", "grelhada", "assado", "assada", "cru", "crua", "inteiro", "inteira", "branco", "branca", "integral", "industrializado", "enriquecido", "grao", "longo", "curto", "somente", "pele", "calor", "seco", "pre", "embalado", "proteina", "fresco", "fresca", "sal", "cozinha", "casca", "com", "sem", "de", "da", "do", "para", "ou", "em", "a", "o", "po"]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function translateUsdaDescriptionToPtBr(description: string) {
  const exact = EXACT_PT_BR.get(normalized(description));
  if (exact) return exact;
  let translated = description.toLocaleLowerCase("en-US");
  for (const [english, portuguese] of PT_BR_PHRASES) translated = translated.replace(new RegExp(`\\b${escaped(english)}\\b`, "gi"), portuguese);
  const uniqueParts = translated.split(",").map((part) => part.trim()).filter((part, index, all) => part && all.indexOf(part) === index);
  const result = uniqueParts.join(", ").replace(/\s+/g, " ").trim();
  return result ? result.charAt(0).toLocaleUpperCase("pt-BR") + result.slice(1) : description;
}

function preparationInPtBr(description: string) {
  const value = normalized(description);
  if (value.includes("scrambled")) return "mexido";
  if (value.includes("fried")) return "frito";
  if (value.includes("grilled")) return "grelhado";
  if (value.includes("roasted")) return "assado";
  if (value.includes("hard boiled") || value.includes("boiled") || value.includes("cooked")) return "cozido";
  if (value.includes("raw")) return "cru";
  return null;
}

function descriptionIsFullyCovered(description: string) {
  if (EXACT_PT_BR.has(normalized(description))) return true;
  return normalized(description).split(" ").every((token) => /^\d+$/.test(token) || KNOWN_ENGLISH_TOKENS.has(token) || ACCEPTED_BRAZILIAN_TERMS.has(token));
}

function portugueseFallback(label: string, description: string) {
  const clean = label.trim();
  const base = clean ? clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1) : "Alimento";
  const preparation = preparationInPtBr(description);
  if (preparation && !normalized(base).includes(normalized(preparation))) return `${base} — ${preparation}`;
  return `${base} — referência nutricional USDA`;
}

function alreadyLocalizedInPtBr(name: string) {
  const tokens = normalized(name).split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => PORTUGUESE_CATALOG_TOKENS.has(token) || ACCEPTED_BRAZILIAN_TERMS.has(token) || /^\d+$/.test(token));
}

export function localizedFoodName(name: string, source: string, locale = "pt-BR", portugueseSearchTerm = "") {
  if (locale !== "pt-BR" || source !== "USDA_FDC") return name;
  if (alreadyLocalizedInPtBr(name)) return name;
  if (portugueseSearchTerm.trim() && normalized(name) === normalized(portugueseSearchTerm)) return portugueseFallback(portugueseSearchTerm, "").replace(" — referência nutricional USDA", "");
  if (descriptionIsFullyCovered(name)) return translateUsdaDescriptionToPtBr(name);
  return portugueseFallback(portugueseSearchTerm, name);
}
