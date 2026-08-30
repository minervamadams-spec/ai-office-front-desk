import { describe, expect, it, vi } from 'vitest';
import { syncAsanaItems, testAsanaConnection } from '../src/main/adapters/asana-adapter';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('asana adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { errors: [{ message: 'Not Authorized' }] }));
    const result = await testAsanaConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('Not Authorized');
    expect(result.error).toMatch(/personal access token/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND app.asana.com'));
    const result = await testAsanaConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach asana/i);
  });

  it('rejects a token for an account with no workspaces', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: { name: 'Minerva', workspaces: [] } }));
    const result = await testAsanaConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a member of any workspace/i);
  });

  it('returns the account name on success, sent as a Bearer token', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      expect((opts?.headers as Record<string, string>).Authorization).toBe('Bearer token');
      return Promise.resolve(jsonResponse(200, { data: { name: 'Minerva', workspaces: [{ gid: 'W1', name: 'Acme' }] } }));
    });
    const result = await testAsanaConnection('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ name: 'Minerva' });
  });

  it('aggregates assigned incomplete tasks across every workspace the account belongs to', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) return Promise.resolve(jsonResponse(200, { data: { name: 'Minerva', workspaces: [{ gid: 'W1' }, { gid: 'W2' }] } }));
      if (url.includes('workspace=W1')) return Promise.resolve(jsonResponse(200, { data: [{ gid: 'T1', name: 'Ship the pilot', due_on: '2026-09-01', permalink_url: 'https://app.asana.com/0/1/T1' }] }));
      return Promise.resolve(jsonResponse(200, { data: [{ gid: 'T2', name: 'Review budget', due_on: null, permalink_url: 'https://app.asana.com/0/2/T2' }] }));
    });
    const result = await syncAsanaItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      { id: 'T1', title: 'Ship the pilot', dueOn: '2026-09-01', url: 'https://app.asana.com/0/1/T1' },
      { id: 'T2', title: 'Review budget', dueOn: null, url: 'https://app.asana.com/0/2/T2' }
    ]);
  });

  it('renders an empty item list rather than throwing when nothing is assigned', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) return Promise.resolve(jsonResponse(200, { data: { name: 'Minerva', workspaces: [{ gid: 'W1' }] } }));
      return Promise.resolve(jsonResponse(200, { data: [] }));
    });
    const result = await syncAsanaItems('token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
