import { describe, expect, it, vi } from 'vitest';
import { syncTeams } from '../src/main/adapters/teams-adapter';
import type { TeamsConnectInput } from '../src/shared/contracts';

const input: TeamsConnectInput = { clientId: 'client-id', tenant: 'common' };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('syncTeams', () => {
  it('maps a 401 token refresh failure to a human-readable message, never the raw body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant', error_description: 'AADSTS70008: expired token' }));
    const result = await syncTeams(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('AADSTS70008');
    expect(result.error).toMatch(/client id/i);
  });

  it('maps a 403 to an admin-approval message', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(403, {}));
    const result = await syncTeams(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/admin may need to approve/i);
  });

  it('refreshes the access token then reads recent chat messages, stripping HTML and truncating the preview', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { value: [{ chatId: '19:abc', from: { user: { displayName: 'Minerva' } }, body: { content: '<p>Hello <b>team</b></p>' }, createdDateTime: '2026-08-01T00:00:00Z', webUrl: 'https://teams.microsoft.com/l/message/19:abc/1' }] }));
    const result = await syncTeams(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([{ chat: '19:abc', author: 'Minerva', preview: 'Hello team', timestamp: '2026-08-01T00:00:00Z', url: 'https://teams.microsoft.com/l/message/19:abc/1' }]);
  });

  it('renders an empty item list rather than throwing when there are no recent chat messages', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { value: [] }));
    const result = await syncTeams(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
