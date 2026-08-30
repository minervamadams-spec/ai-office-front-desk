import { describe, expect, it, vi } from 'vitest';
import { syncTrelloItems, testTrelloConnection } from '../src/main/adapters/trello-adapter';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('trello adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => { throw new Error('not json'); } } as unknown as Response);
    const result = await testTrelloConnection('key', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not accepted by Trello/i);
  });

  it('maps a 400 to an actionable message about the pasted values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => { throw new Error('not json'); } } as unknown as Response);
    const result = await testTrelloConnection('key', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pasted correctly/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND api.trello.com'));
    const result = await testTrelloConnection('key', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach trello/i);
  });

  it('sends the key and token as query parameters and returns the username on success', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain('key=my-key');
      expect(url).toContain('token=my-token');
      return Promise.resolve(jsonResponse(200, { username: 'minervamadams', fullName: 'Minerva' }));
    });
    const result = await testTrelloConnection('my-key', 'my-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ username: 'minervamadams' });
  });

  it('normalizes open cards into the display-safe TrelloItem shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [
      { id: 'C1', name: 'Ship the pilot', due: '2026-09-01T00:00:00.000Z', url: 'https://trello.com/c/C1' }
    ]));
    const result = await syncTrelloItems('key', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([{ id: 'C1', title: 'Ship the pilot', due: '2026-09-01T00:00:00.000Z', url: 'https://trello.com/c/C1' }]);
  });

  it('renders an empty item list rather than throwing when no cards are assigned', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const result = await syncTrelloItems('key', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
