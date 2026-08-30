import { describe, expect, it, vi } from 'vitest';
import { syncLinearItems, testLinearConnection } from '../src/main/adapters/linear-adapter';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('linear adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    const result = await testLinearConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('Unauthorized');
    expect(result.error).toMatch(/personal API key/i);
  });

  it('maps a GraphQL-level auth error (HTTP 200 with an errors array) to the same credential message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ message: 'Authentication required, invalid token' }] }));
    const result = await testLinearConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/personal API key/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND api.linear.app'));
    const result = await testLinearConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach linear/i);
  });

  it('sends the raw key as the Authorization header with no Bearer prefix', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      expect((opts?.headers as Record<string, string>).Authorization).toBe('raw-key');
      return Promise.resolve(jsonResponse(200, { data: { viewer: { name: 'Minerva' } } }));
    });
    const result = await testLinearConnection('raw-key', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: 'Minerva' });
  });

  it('normalizes assigned issues into the display-safe LinearItem shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      data: { issues: { nodes: [{ identifier: 'ENG-123', title: 'Fix the thing', url: 'https://linear.app/acme/issue/ENG-123', state: { name: 'In Progress' } }] } }
    }));
    const result = await syncLinearItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([{ key: 'ENG-123', title: 'Fix the thing', state: 'In Progress', url: 'https://linear.app/acme/issue/ENG-123' }]);
  });

  it('renders an empty item list rather than throwing when nothing is assigned', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: { issues: { nodes: [] } } }));
    const result = await syncLinearItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
