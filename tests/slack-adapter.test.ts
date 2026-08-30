import { describe, expect, it, vi } from 'vitest';
import { parseChannelList, syncSlackItems, testSlackConnection } from '../src/main/adapters/slack-adapter';

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

describe('parseChannelList', () => {
  it('splits on commas and newlines, trims whitespace, and strips a leading #', () => {
    expect(parseChannelList('general, #engineering\nrandom\n')).toEqual(['general', 'engineering', 'random']);
  });

  it('de-duplicates repeated entries', () => {
    expect(parseChannelList('general, general\ngeneral')).toEqual(['general']);
  });

  it('returns an empty list for blank input', () => {
    expect(parseChannelList('')).toEqual([]);
  });
});

describe('slack adapter error mapping', () => {
  it('refuses to test a connection with no channels listed, without making a request', async () => {
    const fetchImpl = vi.fn();
    const result = await testSlackConnection('token', [], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least one public channel/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps an invalid_auth error body to a human-readable credential message, never the raw code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: 'invalid_auth' }));
    const result = await testSlackConnection('token', ['general'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('invalid_auth');
    expect(result.error).toMatch(/bot token was not accepted/i);
  });

  it('maps a missing_scope error to an actionable permissions message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: 'missing_scope' }));
    const result = await testSlackConnection('token', ['general'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing a required permission/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND slack.com'));
    const result = await testSlackConnection('token', ['general'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach slack/i);
  });

  it('reports channels that could not be resolved by name', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('auth.test')) return Promise.resolve(jsonResponse({ ok: true, team: 'Acme' }));
      return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
    });
    const result = await testSlackConnection('token', ['general', 'nonexistent-channel'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nonexistent-channel/);
  });

  it('succeeds when auth and every listed channel resolve', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('auth.test')) return Promise.resolve(jsonResponse({ ok: true, team: 'Acme' }));
      return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
    });
    const result = await testSlackConnection('token', ['general'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ team: 'Acme' });
  });

  it('normalizes recent messages into a display-safe preview, truncated and never the full text', async () => {
    const longText = 'x'.repeat(300);
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.list')) return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
      return Promise.resolve(jsonResponse({ ok: true, messages: [{ user: 'U1', text: longText, ts: '1699999999.000100' }] }));
    });
    const result = await syncSlackItems(['general'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].preview.length).toBeLessThanOrEqual(140);
    expect(result.value?.[0]).toMatchObject({ channel: 'general', author: 'U1', ts: '1699999999.000100', url: 'https://slack.com/archives/C1/p1699999999000100' });
  });

  it('renders an empty item list rather than throwing when a channel has no recent messages', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.list')) return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
      return Promise.resolve(jsonResponse({ ok: true, messages: [] }));
    });
    const result = await syncSlackItems(['general'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
