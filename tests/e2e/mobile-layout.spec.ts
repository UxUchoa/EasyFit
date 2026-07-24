import { expect, test, type Page } from '@playwright/test';
import { db } from '@/lib/db';
import { logicalDateKey } from '@/lib/diary/date';

async function expectContainedInViewport(page: Page, rootSelector: string) {
  const overflow = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const viewportWidth = document.documentElement.clientWidth;
    if (!root) return [{ selector, reason: 'raiz não encontrada' }];

    return [root, ...root.querySelectorAll('*')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 1 || rect.height <= 1) return [];
      if (rect.left >= -0.5 && rect.right <= viewportWidth + 0.5) return [];
      return [{
        element: element.id ? `#${element.id}` : element.getAttribute('data-testid') ?? element.tagName.toLowerCase(),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        viewportWidth,
      }];
    }).slice(0, 12);
  }, rootSelector);

  expect(overflow, JSON.stringify(overflow, null, 2)).toEqual([]);
}

test('onboarding, treino e resumo da dieta ativa funcionam no mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const username = `mobile-layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    await page.goto('/cadastro');
    await page.getByLabel('ID de usuário').fill(username);
    await page.getByLabel('Senha').fill('Senha-mobile-segura-2026!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.setViewportSize({ width: 320, height: 740 });
    await expectContainedInViewport(page, 'form');
    const birthDate = page.getByLabel('Data de nascimento');
    const birthDateBox = await birthDate.boundingBox();
    expect(birthDateBox).not.toBeNull();
    expect(birthDateBox!.width).toBeLessThanOrEqual(300);

    await page.getByLabel('Como podemos chamar você?').fill('Teste Mobile');
    await birthDate.fill('1990-05-10');
    await page.getByLabel('Sexo para o cálculo').selectOption('female');
    await page.getByLabel('Altura (cm)').fill('165');
    await page.getByLabel('Peso atual (kg)').fill('68');
    await page.getByLabel('Peso desejado (kg)').fill('64');
    await page.getByLabel('Nível de atividade no dia a dia').selectOption('sedentary');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Revisar dados' }).click();
    await page.getByRole('button', { name: 'Concluir perfil' }).click();
    await expect(page).toHaveURL(/\/hoje$/);

    await page.goto('/treino');
    await page.getByLabel('Divisão do plano', { exact: true }).selectOption('ABCDE');
    await page.getByLabel('Foco do treino', { exact: true }).selectOption('STRENGTH');
    await page.getByRole('button', { name: 'Gerar sugestão revisável' }).click();

    const review = page.getByTestId('workout-generation-review');
    await expect(review.getByRole('heading', { name: 'Revisão obrigatória antes de ativar' })).toBeVisible();
    await expect(review).toContainText('Treino ABCDE');
    await expect(review).toContainText('Força');
    await expect(review.locator('li')).toHaveCount(0);
    await expect(review.getByLabel('Dia E: Bíceps, tríceps e antebraços')).toBeVisible();

    await expectContainedInViewport(page, '[data-testid="workout-generation-review"]');
    await expectContainedInViewport(page, '[data-testid="workout-builder"]');
    await expectContainedInViewport(page, '[data-testid="workout-draft-day-0"]');

    await page.setViewportSize({ width: 393, height: 852 });
    await expectContainedInViewport(page, '[data-testid="workout-generation-review"]');
    await expectContainedInViewport(page, '[data-testid="workout-builder"]');

    await page.getByLabel('Nome do plano').fill('Plano mobile responsivo');
    await page.getByRole('button', { name: 'Salvar plano' }).click();
    const activePlan = page.getByTestId('workout-active-plan');
    await expect(activePlan).toBeVisible();
    await page.setViewportSize({ width: 320, height: 740 });
    await expectContainedInViewport(page, '[data-testid="workout-active-plan"]');
    await activePlan.getByTestId('workout-day-0').click();
    await expect(page).toHaveURL(/\/treino\/sessao\//);
    await expect(page.getByTestId('workout-rest-controls')).toBeVisible();
    await expect(page.getByTestId('workout-session-exercise').first()).toBeVisible();
    await expect(page.getByTestId('workout-set-form').first()).toBeVisible();
    await expectContainedInViewport(page, '[data-testid="workout-rest-controls"]');
    await expectContainedInViewport(page, '[data-testid="workout-session-exercise"]');
    await expectContainedInViewport(page, '[data-testid="workout-set-form"]');

    const testUser = await db.user.findUniqueOrThrow({ where: { username }, include: { profile: true } });
    const date = logicalDateKey(new Date(), testUser.profile?.timezone ?? 'America/Sao_Paulo', testUser.profile?.dayClosesAtMinutes ?? 0);
    const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`));
    await db.dietPlan.create({
      data: {
        userId: testUser.id,
        name: 'Dieta ativa do teste',
        active: true,
        versions: {
          create: {
            version: 1,
            confirmedAt: new Date(),
            snapshot: {
              importJobId: 'mobile-layout-test',
              parserVersion: 'test-v1',
              ignoredCount: 0,
              items: [
                { day: dayLabel, meal: 'Café da manhã', name: 'Pão', quantity: 70, unit: 'g', sourcePointer: '$.breakfast[0]', catalog: null, nutrition: { calories: 203, proteinGrams: 6.3, carbohydrateGrams: 38.2, fatGrams: 2.8 } },
                { day: dayLabel, meal: 'Café da manhã', name: 'Ovo', quantity: 2, unit: 'unidade', sourcePointer: '$.breakfast[1]', catalog: null, nutrition: null },
              ],
            },
          },
        },
      },
    });

    await page.goto('/hoje');
    await expect(page.getByLabel('Dieta ativa: Dieta ativa do teste')).toContainText('2 alimentos prescritos para hoje');
    const breakfast = page.getByTestId('today-meal-cafe-da-manha');
    await expect(breakfast).toContainText('NA DIETA');
    await expect(breakfast).toContainText('2 alimentos na dieta · 203 kcal previstas · 1 a revisar');
    await expect(breakfast.getByRole('link', { name: 'Ver refeição na dieta →' })).toBeVisible();
    await expect(page.getByTestId('today-meal-almoco')).toContainText('Nada planejado');
    await expectContainedInViewport(page, '[data-testid="today-meal-cafe-da-manha"]');
  } finally {
    await db.user.deleteMany({ where: { username } });
  }
});
