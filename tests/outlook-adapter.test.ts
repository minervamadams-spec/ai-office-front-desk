import { describe, expect, it, vi } from 'vitest';
import { syncOutlook } from '../src/main/adapters/outlook-adapter';
import type { OutlookConnectInput } from '../src/shared/contracts';

const input: OutlookConnectInput = { clientId: 'client-id', tenant: 'common' };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('syncOutlook', () => {
  it('maps a 401 token refresh failure to a human-readable message, never the raw body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant', error_description: 'AADSTS70008: expired token' }));
    const result = await syncOutlook(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('AADSTS70008');
    expect(result.error).toMatch(/client id/i);
  });

  it('refreshes the access token then reads inbox unread count and recent messages', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { unreadItemCount: 7 }))
      .mockResolvedValueOnce(jsonResponse(200, { value: [{ subject: 'Q3 numbers', from: { emailAddress: { name: 'Finance' } }, receivedDateTime: '2026-08-01T00:00:00Z' }] }));
    const result = await syncOutlook(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ inboxUnread: 7, recentMessages: [{ subject: 'Q3 numbers', from: 'Finance', receivedDateTime: '2026-08-01T00:00:00Z' }] });
  });

  it('renders an empty message list rather than throwing when the inbox has no messages', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { unreadItemCount: 0 }))
      .mockResolvedValueOnce(jsonResponse(200, { value: [] }));
    const result = await syncOutlook(input, 'refresh-token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ inboxUnread: 0, recentMessages: [] });
  });
});
