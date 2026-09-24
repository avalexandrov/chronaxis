import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4176';

test.describe('static discovery site', () => {
  test('home hero, keyboard selection, framework tabs, and live demos', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin);
    await expect(page.getByRole('heading', { name: 'Framework-agnostic timelines for the web.' })).toBeVisible();
    const hero = page.getByLabel('Product launch timeline');
    const item = hero.getByRole('button', { name: 'Release scope' });
    await expect(item).toBeVisible();
    await item.focus();
    await item.press('Enter');
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hero-detail')).toContainText('Release scope');
    const beforeZoom = await item.boundingBox();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(async () => (await item.boundingBox())!.width).toBeGreaterThan(beforeZoom!.width);
    await page.getByRole('tab', { name: 'React' }).click();
    await expect(page.getByRole('tabpanel', { name: 'React' })).toContainText('initialRange');
    await page.getByRole('tab', { name: 'React' }).press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Vue' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Vue' })).toContainText(':initial-range');
    await page.getByRole('link', { name: 'Try Vue live' }).click();
    await expect(page.getByRole('heading', { name: 'Chronaxis in Vue' })).toBeVisible();
    await page.goto(`${origin}/try/react/`);
    await expect(page.getByRole('heading', { name: 'Chronaxis — React Adapter' })).toBeVisible();
    await page.goto(`${origin}/try/vanilla/`);
    await expect(page.getByRole('heading', { name: 'Chronaxis — Vanilla TypeScript Demo' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const [slug, label] of [
    ['project-release', 'Project / release planning'],
    ['deployment', 'Deployment timeline'],
    ['booking', 'Booking / resource schedule'],
    ['history', 'Historical / event timeline'],
  ]) {
    test(`${slug} route renders and selects`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${origin}/examples/${slug}/`);
      await expect(page.getByRole('heading', { name: label, level: 1 })).toBeVisible();
      const timeline = page.getByLabel(`${label} timeline`);
      const first = timeline.getByRole('button').first();
      await expect(first).toBeVisible();
      const hostHeight = (await timeline.boundingBox())!.height;
      const contentHeight = (await timeline.locator('.chronaxis').boundingBox())!.height;
      expect(hostHeight).toBeGreaterThanOrEqual(contentHeight);
      await first.click();
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#example-detail')).not.toContainText('Select an item');
      await page.getByRole('button', { name: 'Fit' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      if (slug === 'project-release') {
        await page.getByRole('button', { name: 'Simulate update' }).click();
        await expect(page.getByRole('button', { name: 'Restore plan' })).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }

  test('home and example have no serious accessibility findings', async ({ page }) => {
    for (const route of ['', 'examples/booking/']) {
      await page.goto(`${origin}/${route}`);
      const report = await new AxeBuilder({ page }).analyze();
      expect(report.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    }
  });

  test('guide and performance routes render', async ({ page }) => {
    for (const route of ['guide/vanilla/', 'guide/react/', 'guide/vue/', 'performance/']) {
      await page.goto(`${origin}/${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main a').first()).toBeVisible();
    }
  });
});
