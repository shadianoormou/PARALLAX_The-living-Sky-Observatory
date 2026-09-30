import { expect, test } from '@playwright/test';

test('judge route exposes production-facing access controls', async ({ page }) => {
  await page.goto('/parallax-x');
  await expect(page.getByRole('heading', { name: 'Built for review across borders.' })).toBeVisible();
  await expect(page.getByText('Public read-only evidence link')).toBeVisible();
  await expect(page.getByText('Keyboard · contrast · screen reader')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open pilot dashboard' })).toHaveAttribute('href', '/classroom');
});

test('classroom route exposes an honest pilot dashboard', async ({ page }) => {
  await page.goto('/classroom');
  await expect(page.getByRole('heading', { name: 'Measure reach without overstating adoption.' })).toBeVisible();
  await expect(page.getByText('Exact location, names, and email are never collected.')).toBeVisible();
});
