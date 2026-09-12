// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('@chronaxis/react import', () => {
  it('evaluates without browser globals', async () => {
    expect('document' in globalThis).toBe(false);
    expect('window' in globalThis).toBe(false);
    await expect(import('./index.js')).resolves.toHaveProperty('Timeline');
  });
});
