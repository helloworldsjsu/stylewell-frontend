import { describe, expect, it, vi } from 'vitest';
import { requestJson, toUserFacingApiMessage } from './http';

describe('http requestJson retries', () => {
  it('retries once on transient 500 and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'temporary' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await requestJson<{ ok: boolean }>(
      'https://example.com/test',
      { method: 'GET' },
      { retries: 1, retryDelayMs: 1, operationName: 'load test payload' },
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns friendly message for repeated 500 failures', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ error: 'backend down' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestJson('https://example.com/fail', { method: 'GET' }, { retries: 1, retryDelayMs: 1, operationName: 'load test payload' }),
    ).rejects.toThrow('Server error. Please retry shortly.');
  });
});

describe('toUserFacingApiMessage', () => {
  it('maps network failures to a friendly message', () => {
    const message = toUserFacingApiMessage(new TypeError('Failed to fetch'), 'fallback');
    expect(message).toBe('Network error. Please check your connection and retry.');
  });
});
