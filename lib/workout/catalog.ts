import { db } from "@/lib/db";

export const EXERCISE_CATALOG = [
  { name: "Agachamento livre", muscleGroup: "Pernas", equipment: "Peso corporal ou barra", instructions: "Mantenha os pés firmes, controle a descida e use uma amplitude confortável." },
  { name: "Avanço alternado", muscleGroup: "Pernas", equipment: "Peso corporal ou halteres", instructions: "Dê um passo estável e mantenha o joelho alinhado ao pé." },
  { name: "Elevação pélvica", muscleGroup: "Glúteos", equipment: "Peso corporal ou barra", instructions: "Eleve o quadril sem hiperestender a região lombar." },
  { name: "Flexão de braços", muscleGroup: "Peito", equipment: "Peso corporal", instructions: "Mantenha tronco e quadril alinhados; use apoio elevado se necessário." },
  { name: "Supino reto", muscleGroup: "Peito", equipment: "Barra ou halteres", instructions: "Use pegada estável e movimento controlado, sem rebater a carga." },
  { name: "Supino inclinado com halteres", muscleGroup: "Peito", equipment: "Halteres", instructions: "Ajuste o banco, mantenha os pés apoiados e controle a descida dos halteres." },
  { name: "Supino máquina", muscleGroup: "Peito", equipment: "Máquinas", instructions: "Ajuste o banco para alinhar as mãos ao peito e empurre sem travar os cotovelos." },
  { name: "Peck deck", muscleGroup: "Peito", equipment: "Máquinas", instructions: "Ajuste o assento, mantenha o peito apoiado e feche os braços sem usar impulso." },
  { name: "Remada sentada", muscleGroup: "Costas", equipment: "Cabo", instructions: "Puxe em direção ao tronco mantendo os ombros longe das orelhas." },
  { name: "Puxada frontal", muscleGroup: "Costas", equipment: "Cabo", instructions: "Puxe a barra à frente do corpo sem usar impulso." },
  { name: "Puxada alta", muscleGroup: "Costas", equipment: "Cabos", instructions: "Ajuste o apoio das pernas e puxe a barra em direção à parte alta do peito." },
  { name: "Remada baixa", muscleGroup: "Costas", equipment: "Cabos", instructions: "Mantenha o tronco estável e puxe o pegador em direção ao abdômen." },
  { name: "Remada máquina", muscleGroup: "Costas", equipment: "Máquinas", instructions: "Ajuste o apoio do peito e conduza os cotovelos para trás sem elevar os ombros." },
  { name: "Desenvolvimento de ombros", muscleGroup: "Ombros", equipment: "Halteres", instructions: "Controle a carga e evite compensar com a lombar." },
  { name: "Desenvolvimento na máquina", muscleGroup: "Ombros", equipment: "Máquinas", instructions: "Ajuste o assento, mantenha as costas apoiadas e empurre dentro de uma amplitude confortável." },
  { name: "Elevação lateral", muscleGroup: "Ombros", equipment: "Halteres", instructions: "Eleve os braços com controle até uma amplitude confortável." },
  { name: "Elevação lateral no cabo", muscleGroup: "Ombros", equipment: "Cabos", instructions: "Mantenha o tronco estável e eleve o braço lateralmente sem impulso." },
  { name: "Rosca direta", muscleGroup: "Bíceps", equipment: "Barra ou halteres", instructions: "Mantenha os cotovelos estáveis e evite balanço do tronco." },
  { name: "Rosca Scott", muscleGroup: "Bíceps", equipment: "Máquinas", instructions: "Ajuste o banco, apoie os braços e movimente a carga sem retirar os cotovelos do apoio." },
  { name: "Tríceps no cabo", muscleGroup: "Tríceps", equipment: "Cabo", instructions: "Estenda os cotovelos sem movimentar excessivamente os ombros." },
  { name: "Tríceps corda", muscleGroup: "Tríceps", equipment: "Cabos", instructions: "Mantenha os cotovelos junto ao corpo e afaste as pontas da corda ao final da extensão." },
  { name: "Prancha", muscleGroup: "Core", equipment: "Peso corporal", instructions: "Respire normalmente e mantenha o corpo alinhado pelo tempo confortável." },
  { name: "Leg press", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Ajuste o banco, mantenha os pés firmes e use amplitude confortável." },
  { name: "Leg press 45°", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Mantenha quadril e costas apoiados, pés firmes e joelhos alinhados durante o movimento." },
  { name: "Cadeira extensora", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Alinhe o joelho ao eixo da máquina e estenda as pernas sem lançar a carga." },
  { name: "Mesa flexora", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Ajuste o rolo acima dos calcanhares e flexione os joelhos mantendo o quadril apoiado." },
  { name: "Cadeira flexora", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Ajuste o encosto e flexione os joelhos com o tronco apoiado e movimento controlado." },
  { name: "Panturrilha em pé na máquina", muscleGroup: "Panturrilhas", equipment: "Máquinas", instructions: "Apoie a parte da frente dos pés, mantenha os joelhos estáveis e eleve os calcanhares com controle." },
  { name: "Panturrilha no leg press", muscleGroup: "Panturrilhas", equipment: "Máquinas", instructions: "Mantenha apenas a parte da frente dos pés na plataforma e movimente os tornozelos sem flexionar os joelhos." },
  { name: "Panturrilha sentada", muscleGroup: "Panturrilhas", equipment: "Máquinas", instructions: "Ajuste o apoio sobre as coxas e eleve os calcanhares usando uma amplitude confortável." },
  { name: "Hack squat", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Apoie costas e ombros, mantenha os pés firmes e use uma amplitude confortável." },
  { name: "Agachamento no smith", muscleGroup: "Pernas", equipment: "Máquinas", instructions: "Posicione os pés de forma estável e desça com controle mantendo os joelhos alinhados." },
  { name: "Agachamento goblet", muscleGroup: "Pernas", equipment: "Halteres", instructions: "Segure o halter junto ao peito e controle a descida." },
  { name: "Abdução de quadril", muscleGroup: "Glúteos", equipment: "Faixas elásticas", instructions: "Mantenha o tronco estável e execute sem impulso." },
  { name: "Cadeira abdutora", muscleGroup: "Glúteos", equipment: "Máquinas", instructions: "Mantenha o quadril apoiado e abra as pernas de forma controlada." },
  { name: "Hip thrust na máquina", muscleGroup: "Glúteos", equipment: "Máquinas", instructions: "Ajuste o apoio sobre o quadril e eleve sem hiperestender a região lombar." },
  { name: "Ponte unilateral", muscleGroup: "Glúteos", equipment: "Peso corporal", instructions: "Eleve o quadril com controle e sem desconforto lombar." },
  { name: "Crucifixo com halteres", muscleGroup: "Peito", equipment: "Halteres", instructions: "Use carga confortável e mantenha leve flexão dos cotovelos." },
  { name: "Remada unilateral", muscleGroup: "Costas", equipment: "Halteres", instructions: "Apoie o tronco e puxe o halter sem girar o corpo." },
  { name: "Remada com faixa", muscleGroup: "Costas", equipment: "Faixas elásticas", instructions: "Mantenha a faixa estável e aproxime as escápulas com controle." },
  { name: "Desenvolvimento com faixa", muscleGroup: "Ombros", equipment: "Faixas elásticas", instructions: "Pressione acima da cabeça dentro de uma amplitude confortável." },
  { name: "Elevação lateral com faixa", muscleGroup: "Ombros", equipment: "Faixas elásticas", instructions: "Controle a resistência durante a subida e a descida." },
  { name: "Rosca com faixa", muscleGroup: "Bíceps", equipment: "Faixas elásticas", instructions: "Mantenha os cotovelos próximos ao corpo." },
  { name: "Rosca alternada", muscleGroup: "Bíceps", equipment: "Halteres", instructions: "Alterne os braços sem projetar os cotovelos para a frente." },
  { name: "Rosca martelo", muscleGroup: "Bíceps", equipment: "Halteres", instructions: "Use pegada neutra e mantenha os punhos alinhados." },
  { name: "Tríceps francês", muscleGroup: "Tríceps", equipment: "Halteres", instructions: "Mantenha os cotovelos estáveis e use amplitude confortável." },
  { name: "Tríceps testa", muscleGroup: "Tríceps", equipment: "Barra ou halteres", instructions: "Flexione apenas os cotovelos e controle a aproximação da carga." },
  { name: "Mergulho no banco", muscleGroup: "Tríceps", equipment: "Peso corporal", instructions: "Mantenha os ombros estáveis e use uma amplitude confortável." },
  { name: "Rosca de punho", muscleGroup: "Antebraços", equipment: "Barra ou halteres", instructions: "Apoie os antebraços e movimente somente os punhos." },
  { name: "Rosca inversa", muscleGroup: "Antebraços", equipment: "Barra ou halteres", instructions: "Use pegada pronada e mantenha os cotovelos próximos ao corpo." },
  { name: "Caminhada do fazendeiro", muscleGroup: "Antebraços", equipment: "Halteres", instructions: "Caminhe com postura ereta, passos controlados e pegada firme." },
  { name: "Remada curvada", muscleGroup: "Costas", equipment: "Barra ou halteres", instructions: "Incline o tronco com a coluna neutra e puxe a carga em direção ao abdômen." },
  { name: "Pullover com halter", muscleGroup: "Costas", equipment: "Halteres", instructions: "Leve o halter para trás com controle, sem arquear excessivamente a lombar." },
  { name: "Stiff com halteres", muscleGroup: "Pernas", equipment: "Halteres", instructions: "Leve o quadril para trás mantendo a coluna neutra e os joelhos levemente flexionados." },
  { name: "Crucifixo inverso", muscleGroup: "Ombros", equipment: "Halteres", instructions: "Abra os braços com controle sem elevar os ombros." },
  { name: "Dead bug", muscleGroup: "Core", equipment: "Peso corporal", instructions: "Movimente braços e pernas alternadamente mantendo o tronco estável." },
  { name: "Abdominal na máquina", muscleGroup: "Core", equipment: "Máquinas", instructions: "Ajuste os apoios e flexione o tronco de forma controlada, sem puxar com os braços." },
] as const;

export async function ensureExerciseCatalog() {
  const catalog = await db.exercise.findMany({
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  });
  const byName = new Map(catalog.map((exercise) => [exercise.name, exercise]));
  const changed = EXERCISE_CATALOG.filter((exercise) => {
    const existing = byName.get(exercise.name);
    return !existing || existing.muscleGroup !== exercise.muscleGroup || existing.equipment !== exercise.equipment || existing.instructions !== exercise.instructions;
  });

  if (!changed.length) return catalog;

  await db.$transaction(
    changed.map((exercise) =>
      db.exercise.upsert({
        where: { name: exercise.name },
        create: exercise,
        update: {
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          instructions: exercise.instructions,
        },
      }),
    ),
  );

  return db.exercise.findMany({
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  });
}

export const STARTER_TEMPLATE = {
  name: "Corpo inteiro · 3 dias",
  days: [
    ["Agachamento livre", "Flexão de braços", "Remada sentada", "Panturrilha em pé na máquina"],
    ["Avanço alternado", "Supino reto", "Puxada frontal", "Elevação pélvica"],
    ["Agachamento livre", "Desenvolvimento de ombros", "Rosca direta", "Tríceps no cabo"],
  ],
} as const;
