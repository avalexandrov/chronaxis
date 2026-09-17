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

  test('does not select labels or item text during pointer interaction', async ({ page }) => {
    const timeline = page.getByLabel('Product delivery timeline');
    const root = timeline.locator('.chronaxis');
    await expect(root).toHaveCSS('user-select', 'none');

    await root.locator('.chronaxis-row-label').first().click({ clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');

    await root.locator('.chronaxis-tick-label').first().click({ clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');

    await timeline.getByRole('button', { name: 'Customer interviews' }).click({ clickCount: 2 });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');

    const plot = await root.locator('.chronaxis-items').boundingBox();
    expect(plot).not.toBeNull();
    const emptyPoint = { x: plot!.x + 5, y: plot!.y + plot!.height - 5 };
    const itemAtPoint = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-chronaxis-item-id]') ?? null,
      emptyPoint,
    );
    expect(itemAtPoint).toBeNull();
    await page.mouse.click(emptyPoint.x, emptyPoint.y, { clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  });

  test('overlay mode follows the later item DOM sibling at a shared pointer target', async ({ page }) => {
    const timeline = page.getByLabel('Product delivery timeline');
    const earlier = timeline.getByRole('button', { name: 'Customer interviews' });
    const later = timeline.getByRole('button', { name: 'Market landscape' });
    const [earlierBox, laterBox] = await Promise.all([earlier.boundingBox(), later.boundingBox()]);
    expect(earlierBox).not.toBeNull();
    expect(laterBox).not.toBeNull();

    const sharedLeft = Math.max(earlierBox!.x, laterBox!.x);
    const sharedRight = Math.min(earlierBox!.x + earlierBox!.width, laterBox!.x + laterBox!.width);
    const sharedTop = Math.max(earlierBox!.y, laterBox!.y);
    const sharedBottom = Math.min(earlierBox!.y + earlierBox!.height, laterBox!.y + laterBox!.height);
    expect(sharedRight).toBeGreaterThan(sharedLeft);
    expect(sharedBottom).toBeGreaterThan(sharedTop);
    const point = {
      x: (sharedLeft + sharedRight) / 2,
      y: (sharedTop + sharedBottom) / 2,
    };

    const hitItemId = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-chronaxis-item-id]')
        ?.dataset.chronaxisItemId ?? null,
      point,
    );
    expect(hitItemId).toBe('landscape');

    await page.mouse.click(point.x, point.y);
    await expect(page.getByText(/itemClick — Market landscape/)).toBeVisible();
  });

  test('stack mode gives overlapping items distinct native targets and preserves panning', async ({ page }) => {
    const timeline = page.getByLabel('Stack overlap timeline');
    const checkout = timeline.getByRole('button', { name: 'Checkout UI' });
    const experiment = timeline.getByRole('button', { name: 'Experiment wiring' });
    const eventOutput = page.locator('#stack-overlap-event');
    await expect(checkout).toBeVisible();
    await expect(experiment).toBeVisible();
    await checkout.scrollIntoViewIfNeeded();

    const [checkoutBox, experimentBox] = await Promise.all([checkout.boundingBox(), experiment.boundingBox()]);
    expect(checkoutBox).not.toBeNull();
    expect(experimentBox).not.toBeNull();
    const boxesOverlapVertically = checkoutBox!.y < experimentBox!.y + experimentBox!.height
      && experimentBox!.y < checkoutBox!.y + checkoutBox!.height;
    expect(boxesOverlapVertically).toBe(false);

    for (const [item, expectedId, expectedLabel] of [
      [checkout, 'checkout-ui', 'Checkout UI'],
      [experiment, 'experiment-wiring', 'Experiment wiring'],
    ] as const) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
      const hitItemId = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)
          ?.closest<HTMLElement>('[data-chronaxis-item-id]')
          ?.dataset.chronaxisItemId ?? null,
        point,
      );
      expect(hitItemId).toBe(expectedId);
      await page.mouse.click(point.x, point.y);
      await expect(eventOutput).toHaveText(`Activated: ${expectedLabel}`);
    }

    for (const item of [checkout, experiment]) {
      const before = await item.boundingBox();
      expect(before).not.toBeNull();
      const start = { x: before!.x + before!.width / 2, y: before!.y + before!.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 30, start.y, { steps: 3 });
      await page.mouse.up();
      await expect(eventOutput).toHaveText('Panned — item lanes remain fixed.');
      await expect.poll(async () => {
        const after = await item.boundingBox();
        return after !== null && Math.abs(after.x - before!.x) > 0.5;
      }).toBe(true);
    }
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
