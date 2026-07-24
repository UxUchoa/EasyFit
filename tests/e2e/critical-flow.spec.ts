import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { db } from '@/lib/db';

async function expectNoSeriousAccessibilityViolations(page: Page) {
  await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js') });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (document: Document, options: object) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string }> }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  });
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test('páginas públicas críticas não têm violações axe sérias', async ({ page }) => {
  for (const path of ['/entrar', '/cadastro', '/privacidade']) {
    await page.goto(path);
    await expectNoSeriousAccessibilityViolations(page);
  }
});

test('cadastro, onboarding e adição rápida preservam o fluxo principal', async ({ page }) => {
  test.setTimeout(90_000);
  const username = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = 'Senha-e2e-segura-2026!';

  await page.goto('/cadastro');
  await page.getByLabel('ID de usuário').fill(username);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  const birthDateBox = await page.getByLabel('Data de nascimento').boundingBox();
  const viewport = page.viewportSize();
  expect(birthDateBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(birthDateBox!.x + birthDateBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByLabel('Como podemos chamar você?').fill('Pessoa E2E');
  await page.getByLabel('Data de nascimento').fill('1990-05-10');
  await page.getByLabel('Sexo para o cálculo').selectOption('female');
  await page.getByLabel('Altura (cm)').fill('165');
  await page.getByLabel('Peso atual (kg)').fill('68');
  await page.getByLabel('Peso desejado (kg)').fill('64');
  await page.getByLabel('Nível de atividade no dia a dia').selectOption('sedentary');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Objetivo principal').selectOption('maintain');
  await page.getByLabel('Experiência de treino').selectOption('beginner');
  await page.getByLabel('Dias por semana').fill('3');
  await page.getByRole('button', { name: 'Revisar dados' }).click();
  await expect(page.getByRole('heading', { name: 'Confira antes de concluir' })).toBeVisible();
  await expect(page.getByText('Pessoa E2E')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir perfil' }).click();

  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByRole('heading', { name: 'Olá, Pessoa.' })).toBeVisible();
  const e2eUser = await db.user.findUniqueOrThrow({ where: { username } });
  const e2eSession = await db.session.findFirstOrThrow({ where: { userId: e2eUser.id, revokedAt: null } });
  await db.session.update({ where: { id: e2eSession.id }, data: { rotatedAt: new Date(Date.now() - 2 * 86_400_000) } });
  await page.reload();
  await expect.poll(() => db.auditEvent.count({ where: { actorUserId: e2eUser.id, action: 'session.rotate', objectId: e2eSession.id } })).toBe(1);
  await expect(page.getByRole('heading', { name: 'Olá, Pessoa.' })).toBeVisible();
  await page.goto('/registro');
  const morningSnack = page.getByRole('article').filter({ hasText: 'Lanche da manhã' });
  await morningSnack.getByRole('button', { name: 'Adicionar em Lanche da manhã' }).click();
  await expect(page.getByLabel('Refeição')).toHaveValue('lanche-da-manha');
  await expect(page.getByRole('button', { name: 'Usar código de barras' })).toBeVisible();
  await page.getByRole('button', { name: 'Usar código de barras' }).click();
  await expect(page.getByRole('heading', { name: 'Ler código de barras' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar e voltar para o registro' }).click();
  await page.getByTestId('diary-action-quick').click();
  await page.getByLabel('Descrição').fill('Lanche automatizado');
  await page.getByLabel('Calorias (kcal)').fill('245');
  await page.getByRole('button', { name: 'Adicionar ao diário' }).click();
  const savedEntry = page.getByRole('listitem').filter({ hasText: 'Lanche automatizado' });
  await expect(savedEntry).toBeVisible();
  await expect(savedEntry).toContainText('245 kcal');
  await expect(page.getByText(/Macros parciais/)).toBeVisible();

  const offlineEntry = await db.mealEntry.findFirstOrThrow({ where: { snapshotName: 'Lanche automatizado', meal: { dayLog: { user: { username } } } } });
  await page.context().setOffline(true);
  await savedEntry.getByRole('button', { name: 'Editar' }).click();
  await savedEntry.getByLabel(/Nova quantidade/).fill('2');
  await savedEntry.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Sincronização local' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Editar Lanche automatizado' })).toContainText('PENDENTE');
  await db.mealEntry.update({ where: { id: offlineEntry.id }, data: { quantity: 3, snapshotCalories: 735 } });
  await page.context().setOffline(false);
  const offlineConflict = page.getByRole('article').filter({ hasText: 'Editar Lanche automatizado' });
  await expect(offlineConflict).toContainText('CONFLITO');
  await expect(offlineConflict).toContainText('Servidor: 3');
  await expect(offlineConflict).toContainText('Local: 2');
  await offlineConflict.getByRole('button', { name: 'Aplicar versão local' }).click();
  await expect(offlineConflict).not.toBeVisible();
  await expect(savedEntry).toContainText('2 porção');
  expect(Number((await db.mealEntry.findUniqueOrThrow({ where: { id: offlineEntry.id } })).quantity)).toBe(2);
  await page.context().setOffline(true);
  await page.getByTestId('diary-action-quick').click();
  await page.getByLabel('Descrição').fill('Lanche criado offline');
  await page.getByLabel('Calorias (kcal)').fill('180');
  await page.getByRole('button', { name: 'Adicionar ao diário' }).click();
  await expect(page.getByRole('article').filter({ hasText: 'Lanche criado offline' })).toContainText('PENDENTE');
  await page.context().setOffline(false);
  await expect(page.getByRole('listitem').filter({ hasText: 'Lanche criado offline' })).toBeVisible();
  expect(await db.mealEntry.count({ where: { snapshotName: 'Lanche criado offline', meal: { dayLog: { user: { username } } } } })).toBe(1);

  const conflictName = `Arroz fontes ${Date.now()}`;
  await Promise.all([
    db.food.create({ data: { name: conflictName, source: 'TACO', baseQuantity: 100, baseUnit: 'g', calories: 130, proteinGrams: 2.5, carbohydrateGrams: 28, fatGrams: 0.3 } }),
    db.food.create({ data: { name: conflictName, source: 'USDA', baseQuantity: 100, baseUnit: 'g', calories: 125, proteinGrams: 2.7, carbohydrateGrams: 27, fatGrams: 0.4 } }),
  ]);
  await page.getByTestId('diary-action-search').click();
  const foodSearchForm = page.getByTestId('food-search-form');
  await foodSearchForm.getByLabel('Pesquisar por nome ou marca').fill(conflictName);
  await foodSearchForm.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  const tacoAlternative = page.getByRole('article').filter({ hasText: conflictName }).filter({ hasText: 'Fonte: TACO' });
  await expect(tacoAlternative).toContainText('Conflito entre fontes');
  await expect(page.getByRole('article').filter({ hasText: conflictName }).filter({ hasText: 'Fonte: USDA' })).toContainText('Conflito entre fontes');
  await tacoAlternative.getByRole('button', { name: 'Escolher e adicionar' }).click();
  await page.getByTestId('diary-action-search').click();
  await foodSearchForm.getByLabel('Pesquisar por nome ou marca').fill(conflictName);
  await foodSearchForm.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: conflictName }).filter({ hasText: 'Fonte: TACO' })).toContainText('Esta foi sua última escolha');
  await page.getByRole('button', { name: 'Fechar e voltar para o registro' }).click();

  let dialogOpened = false;
  page.on('dialog', async (dialog) => { dialogOpened = true; await dialog.dismiss(); });
  const inertMarkup = '<img src=x onerror=alert(1)>';
  await page.getByTestId('diary-action-quick').click();
  await page.getByLabel('Descrição').fill(inertMarkup);
  await page.getByLabel('Calorias (kcal)').fill('1');
  await page.getByRole('button', { name: 'Adicionar ao diário' }).click();
  await expect(page.getByText(inertMarkup, { exact: true })).toBeVisible();
  expect(dialogOpened).toBe(false);
  await expectNoSeriousAccessibilityViolations(page);

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.goto('/registro?date=' + yesterday);
  await page.getByTestId('diary-action-quick').click();
  await page.getByLabel('Descrição').fill('Registro retroativo');
  await page.getByLabel('Calorias (kcal)').fill('100');
  await page.getByRole('button', { name: 'Adicionar ao diário' }).click();
  const retroactiveEntry = page.getByRole('listitem').filter({ hasText: 'Registro retroativo' });
  await retroactiveEntry.getByRole('button', { name: 'Editar' }).click();
  await retroactiveEntry.getByLabel(/Nova quantidade/).fill('2');
  await retroactiveEntry.getByLabel('Motivo da correção').fill('Quantidade anotada incorretamente');
  await retroactiveEntry.getByRole('button', { name: 'Salvar' }).click();
  await expect(retroactiveEntry.getByText(/Histórico de correções/)).toBeVisible();
  await retroactiveEntry.getByText(/Histórico de correções/).click();
  await expect(retroactiveEntry).toContainText('Quantidade anotada incorretamente');

  await page.goto('/importacoes');
  await expect(page.getByRole('complementary', { name: 'Ajuda contextual' }).getByRole('link', { name: 'Voltar à dieta' })).toBeVisible();
  const importedFoodName = `Banana automatizada ${Date.now()}`;
  const importedFood = await db.food.create({ data: { name: importedFoodName, source: 'TEST_IMPORT', baseQuantity: 100, baseUnit: 'g', calories: 100, proteinGrams: 2, carbohydrateGrams: 20, fatGrams: 1 } });
  const importContent = JSON.stringify({ name: 'Plano alimentar E2E', days: [{ label: 'Segunda-feira', meals: [{ name: 'Almoço', items: [{ food: importedFoodName, quantity: 150, unit: 'g' }, { food: 'Uma fruta' }] }] }] });
  await page.getByLabel('Arquivo da dieta').setInputFiles({ name: 'dieta-e2e.json', mimeType: 'application/json', buffer: Buffer.from(importContent) });
  await page.getByRole('button', { name: 'Receber arquivo' }).click();
  const importCard = page.getByRole('article').filter({ hasText: 'dieta-e2e.json' });
  await expect(importCard).toContainText('Em revisão');
  await expect(importCard).toContainText('1 de 2 itens foram preparados automaticamente');
  await expect(importCard).toContainText('quantidade ausente');
  await importCard.getByLabel('Decisão').selectOption('MANUAL');
  await importCard.getByLabel('Alimento final').fill('Banana');
  await importCard.getByLabel('Quantidade').fill('1');
  await importCard.getByLabel('Unidade').fill('un');
  await importCard.getByRole('button', { name: 'Salvar este item' }).click();
  await expect(page.getByRole('status')).toContainText('Item revisado');
  await importCard.getByRole('button', { name: 'Confirmar e ativar dieta' }).click();
  await expect(page.getByRole('status')).toContainText('Dieta confirmada');
  await expect(importCard).toContainText('Plano alimentar E2E');
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto('/dieta?date=2026-07-27');
  const activeDiet = page.getByRole('region', { name: 'Plano alimentar E2E' });
  await expect(activeDiet).toContainText('150 kcal previstas');
  await activeDiet.getByRole('button', { name: 'Comi esta refeição' }).click();
  await expect(activeDiet.getByRole('button', { name: 'Refeição registrada' })).toBeDisabled();
  await page.goto('/registro?date=2026-07-27');
  await expect(page.getByRole('listitem').filter({ hasText: importedFoodName }).filter({ hasText: 'REALIZADO' })).toContainText('150 kcal');
  expect(await db.mealEntry.count({ where: { foodId: importedFood.id, meal: { dayLog: { userId: e2eUser.id, logicalDate: new Date('2026-07-27T00:00:00.000Z') } } } })).toBe(1);

  const supportTarget = `support-target-${Date.now()}`;
  await db.user.update({ where: { username }, data: { role: 'SUPPORT' } });
  await db.user.create({ data: { username: supportTarget, passwordHash: 'e2e-target-not-authenticated' } });
  await page.goto('/perfil');
  await page.getByRole('link', { name: 'Operações' }).click();
  await expect(page.getByRole('heading', { name: 'Saúde sem exposição por padrão.' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'imports.receive' })).toBeVisible();
  await page.getByLabel('ID da conta').fill(supportTarget);
  await page.getByLabel('Justificativa operacional').fill('Validar atendimento solicitado pelo titular no teste E2E');
  await page.getByLabel('Metadados da conta').check();
  await page.getByRole('button', { name: 'Solicitar por 15 minutos' }).click();
  await page.getByLabel('Confirme sua senha').fill(password);
  await page.getByRole('button', { name: 'Confirmar senha' }).click();
  await expect(page.getByRole('status')).toContainText('Senha confirmada');
  await page.getByRole('button', { name: 'Solicitar por 15 minutos' }).click();
  const accessCard = page.getByRole('article').filter({ hasText: supportTarget });
  await expect(accessCard).toContainText('Ativo');
  await accessCard.getByRole('button', { name: 'Consultar resumo autorizado' }).click();
  await expect(accessCard).toContainText(`Conta: ${supportTarget}`);
  await accessCard.getByRole('button', { name: 'Revogar agora' }).click();
  await expect(accessCard).toContainText('Revogado');
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto('/perfil');
  await page.getByLabel('Data', { exact: true }).fill(yesterday);
  await page.getByLabel('Peso (kg)').fill('67.5');
  await page.getByLabel('Cintura (cm)').fill('80');
  await page.getByRole('button', { name: 'Registrar medição' }).click();
  await expect(page.getByRole('row').filter({ hasText: '67.5 kg' })).toBeVisible();

  await page.goto('/relatorios');
  await expect(page.getByRole('heading', { name: /Semana de/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evolução de peso' })).toBeVisible();
  await expect(page.getByText('67,5 kg')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto('/lembretes');
  const mealReminder = page.getByRole('group', { name: 'Refeição' });
  await mealReminder.getByRole('checkbox').check();
  await mealReminder.getByLabel('Horário').fill('12:30');
  await page.getByLabel('Ativar janela silenciosa').check();
  await page.getByRole('button', { name: 'Salvar lembretes' }).click();
  await expect(page.getByRole('status')).toContainText('Preferências de lembrete atualizadas.');
  await expect(page.getByRole('button', { name: 'Permitir notificações push' })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto('/treino');
  await expect(page.getByRole('button', { name: 'Usar template Full body' })).toHaveCount(0);
  await page.getByLabel('Divisão do plano', { exact: true }).selectOption('ABCDE');
  await page.getByLabel('Foco do treino', { exact: true }).selectOption('STRENGTH');
  await page.getByRole('button', { name: 'Gerar sugestão revisável' }).click();
  await expect(page.getByRole('heading', { name: 'Revisão obrigatória antes de ativar' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Revisão obrigatória antes de ativar' })).toContainText('Força');
  await expect(page.getByRole('region', { name: 'Revisão obrigatória antes de ativar' })).toContainText('E · Bíceps, tríceps e antebraços');
  const exerciseSearch = page.getByLabel('Pesquisar exercício');
  await exerciseSearch.fill('crucifixo');
  await expect(page.getByRole('button', { name: /Crucifixo máquina/ })).toBeVisible();
  await exerciseSearch.clear();
  await expect(page.getByRole('button', { name: 'Arrastar Supino reto para reordenar' })).toBeVisible();
  const draggedHandle = page.getByRole('button', { name: 'Arrastar Supino máquina para reordenar' });
  await draggedHandle.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Mover Supino máquina para cima' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mover Supino inclinado com halteres para cima' }).click();
  await page.getByRole('button', { name: 'Mover Supino inclinado com halteres para cima' }).click();
  await expect(page.getByRole('button', { name: 'Mover Supino inclinado com halteres para cima' })).toBeDisabled();
  await page.getByLabel('Nome do plano').fill('Plano E2E revisado');
  await page.getByRole('button', { name: 'Salvar plano' }).click();
  const generatedPlan = page.getByRole('article').filter({ hasText: 'Plano E2E revisado' });
  await expect(generatedPlan.getByText(/Sugestão gerada pela regra/)).toBeVisible();
  await generatedPlan.getByTestId('workout-day-0').click();
  await expect(page).toHaveURL(/\/treino\/sessao\//);
  const firstExercise = page.getByRole('article').filter({ hasText: 'Exercício 1' });
  await expect(firstExercise).toContainText('Supino inclinado com halteres');
  await firstExercise.getByRole('button', { name: 'Substituir exercício' }).click();
  await firstExercise.getByTestId('workout-alternative').first().click();
  await expect(page.getByText(/Substituído de/)).toBeVisible();
  await page.goto('/relatorios');
  await expect(page.getByTestId('training-expected')).toContainText('1');
  await expect(page.getByTestId('training-started')).toContainText('1');
  await expect(page.getByTestId('training-adherence')).toContainText('0%');
});

test('login inválido não revela se o ID existe', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('ID de usuário').fill(`inexistente-${Date.now()}`);
  await page.getByLabel('Senha').fill('Senha-incorreta-2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('status')).toContainText('ID ou senha incorretos.');
});
