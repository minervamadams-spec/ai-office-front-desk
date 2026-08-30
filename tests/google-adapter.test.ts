import { describe, expect, it, vi } from 'vitest';
import { syncGoogle } from '../src/main/adapters/google-adapter';
import type { GoogleConnectInput } from '../src/shared/contracts';

const input: GoogleConnectInput = { clientId: 'client-id', clientSecret: 'shh' };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('syncGoogle', () => {
  it('maps a 401 token refresh failure to a human-readable message, never the raw body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant', error_description: 'Token has been revoked.' }));
    const result = await syncGoogle(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('invalid_grant');
    expect(result.error).toMatch(/client id and secret/i);
  });

  it('refreshes the access token then reads inbox unread count and recent Drive files', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { messagesUnread: 4 }))
      .mockResolvedValueOnce(jsonResponse(200, { files: [{ name: 'Roadmap.docx', modifiedTime: '2026-08-01T00:00:00Z', webViewLink: 'https://drive.google.com/x' }] }));
    const result = await syncGoogle(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ inboxUnread: 4, driveRecentFiles: [{ name: 'Roadmap.docx', modifiedTime: '2026-08-01T00:00:00Z', webViewLink: 'https://drive.google.com/x' }] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never sends the refresh token or client secret in a URL query string', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      expect(url).not.toContain('shh');
      expect(url).not.toContain('refresh-token');
      return Promise.resolve(jsonResponse(200, { access_token: 'fresh-token', messagesUnread: 0, files: [] }));
    });
    await syncGoogle(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
  });
});
