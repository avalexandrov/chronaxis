import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('vanilla browser timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:4173');
  });

  test('mounts, navigates, pans, activates, and replaces data', async ({ page }) => {
    const timeline = page.getByLabel('Product delivery timeline');
    const item = timeline.getByRole('button', { name: 'Customer interviews' });
    await expect(item).toBeVisible();

    await item.focus();
    await item.press('Enter');
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/itemClick — Customer interviews/)).toBeVisible();

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByText(/rangeChange .* via zoomIn/)).toBeVisible();

    const box = await timeline.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.7, box!.y + 120);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.6, box!.y + 120, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByText(/rangeChange .* via pan/).last()).toBeVisible();

    await timeline.hover();
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
    await expect(page.getByText(/rangeChange .* via wheel/)).toBeVisible();

    await page.getByRole('button', { name: 'Load updated schedule' }).click();
    await expect(timeline.getByRole('button', { name: 'Interactive timeline' })).toBeVisible();
  });

  test('has no serious automated accessibility findings', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  });
});

test.describe('React adapter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:4174');
  });

  test('survives Strict Mode, updates data, and cleans up on unmount', async ({ page }) => {
    const timeline = page.getByLabel('React project timeline');
    await expect(timeline.locator('.chronaxis')).toHaveCount(1);
    const research = timeline.getByRole('button', { name: 'Research' });
    await research.focus();
    await research.press(' ');
    await expect(page.getByText('Selected: Research')).toBeVisible();

    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(page.getByText('Range: fit')).toBeVisible();
    await page.getByRole('button', { name: 'Update items' }).click();
    await expect(timeline.getByRole('button', { name: 'Engine + integration' })).toBeVisible();
    await page.getByRole('button', { name: 'Update rows + items' }).click();
    await expect(timeline.getByText('Adoption')).toBeVisible();
    await expect(timeline.getByRole('button', { name: 'Launch docs' })).toBeVisible();

    await page.getByRole('button', { name: 'Unmount' }).click();
    await expect(page.locator('.chronaxis')).toHaveCount(0);
    await page.getByRole('button', { name: 'Remount' }).click();
    await expect(page.locator('.chronaxis')).toHaveCount(1);
  });

  test('has no serious automated accessibility findings', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  });
});
