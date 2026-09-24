import { expect, test } from '@playwright/test';

test('Vue adapter mounts, navigates, selects, and replaces data', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  const timeline = page.getByLabel('Vue project timeline');
  const scope = timeline.getByRole('button', { name: 'Scope' });
  const review = timeline.getByRole('button', { name: 'Review' });
  await expect(scope).toBeVisible();
  await expect(review).toBeVisible();
  const [scopeBox, reviewBox] = await Promise.all([scope.boundingBox(), review.boundingBox()]);
  expect(scopeBox?.y).not.toBe(reviewBox?.y);

  await scope.focus();
  await scope.press('Enter');
  await expect(scope).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Activated: Scope — Mina')).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.getByText('Range: zoomIn')).toBeVisible();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(scope).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Update items' }).click();
  await expect(timeline.getByRole('button', { name: 'Build and verify' })).toBeVisible();
  await page.getByRole('button', { name: 'Update data' }).click();
  await expect(timeline.getByRole('button', { name: 'Release' })).toBeVisible();
});
