import { describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../utils/fetchWithRetry';

describe('fetchWithRetry', () => {
  it('retries failed requests and resolves on success', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('Network error');
      }
      return new Response('OK', { status: 200 });
    }) as typeof fetch;

    const result = await fetchWithRetry('http://test.local', undefined, 3, 0);

    expect(attempts).toBe(3);
    expect(result.ok).toBe(true);
  });
});
