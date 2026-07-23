import { expect, test } from '@playwright/test';

test('headers de segurança e ocultação de tecnologia estão presentes', async ({ request }) => {
  const response = await request.get('/entrar');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toContain('camera=(self)');
  expect(headers['x-powered-by']).toBeUndefined();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
});

test('mutações sem origem confiável são recusadas antes da autenticação', async ({ request }) => {
  const hostile = await request.post('/api/auth/login', { headers: { Origin: 'https://attacker.example' }, data: { username: 'qualquer', password: 'qualquer' } });
  expect(hostile.status()).toBe(403);
  const missing = await request.post('/api/auth/login', { data: { username: 'qualquer', password: 'qualquer' } });
  expect(missing.status()).toBe(403);
});

test('páginas públicas têm foco por teclado, reflow estreito e movimento reduzido', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/entrar', '/cadastro', '/privacidade']) {
    await page.goto(path);
    await page.keyboard.press('Tab');
    const focus = page.locator(':focus');
    await expect(focus).toHaveCount(1);
    expect(await focus.evaluate((element) => element.tagName)).not.toBe('BODY');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.goto('/entrar');
  const transitionDuration = await page.getByRole('button', { name: 'Entrar' }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);
});

test('ajuda contextual pública mantém posição e encaminhamento consistentes', async ({ page }) => {
  await page.goto('/entrar');
  const loginHelp = page.getByRole('complementary', { name: 'Ajuda contextual' });
  await expect(loginHelp.getByText('Precisa de ajuda?')).toBeVisible();
  await expect(loginHelp.getByRole('link', { name: 'Criar uma nova conta' })).toHaveAttribute('href', '/cadastro');

  await page.goto('/privacidade');
  const privacyHelp = page.getByRole('complementary', { name: 'Ajuda contextual' });
  await expect(privacyHelp.getByText('Precisa de ajuda?')).toBeVisible();
  await expect(privacyHelp.getByRole('link', { name: 'Abrir controles da conta' })).toHaveAttribute('href', '/conta');
});
