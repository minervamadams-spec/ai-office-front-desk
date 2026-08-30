import { describe, expect, it, vi } from 'vitest';
import { syncNotionItems, testNotionConnection } from '../src/main/adapters/notion-adapter';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('notion adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { object: 'error', code: 'unauthorized', message: 'API token is invalid.' }));
    const result = await testNotionConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('API token is invalid');
    expect(result.error).toMatch(/integration secret was not accepted/i);
  });

  it('maps a 403 to a sharing-permission message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, {}));
    const result = await testNotionConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/shared with at least one page/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND api.notion.com'));
    const result = await testNotionConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach notion/i);
  });

  it('returns the workspace name on success, sending the required Notion-Version header', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      expect((opts?.headers as Record<string, string>)['Notion-Version']).toBe('2022-06-28');
      expect((opts?.headers as Record<string, string>).Authorization).toBe('Bearer token');
      return Promise.resolve(jsonResponse(200, { bot: { workspace_name: 'Acme Co' } }));
    });
    const result = await testNotionConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ workspace: 'Acme Co' });
  });

  it('extracts the title from whichever property has type "title", and falls back to (untitled)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      results: [
        { id: 'p1', url: 'https://notion.so/p1', last_edited_time: '2026-08-01T00:00:00Z', properties: { Name: { type: 'title', title: [{ plain_text: 'Q3 ' }, { plain_text: 'plan' }] } } },
        { id: 'p2', url: 'https://notion.so/p2', last_edited_time: '2026-08-02T00:00:00Z', properties: { Status: { type: 'select' } } }
      ]
    }));
    const result = await syncNotionItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      { id: 'p1', title: 'Q3 plan', lastEditedAt: '2026-08-01T00:00:00Z', url: 'https://notion.so/p1' },
      { id: 'p2', title: '(untitled)', lastEditedAt: '2026-08-02T00:00:00Z', url: 'https://notion.so/p2' }
    ]);
  });

  it('renders an empty item list rather than throwing when no pages are shared with the integration', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { results: [] }));
    const result = await syncNotionItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
