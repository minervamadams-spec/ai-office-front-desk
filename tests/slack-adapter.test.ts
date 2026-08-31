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
    expect(result.error).toMatch(/at least one channel/i);
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

  it('lists both public and private channel types, so a private channel the bot has been invited to resolves too', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('auth.test')) return Promise.resolve(jsonResponse({ ok: true, team: 'Acme' }));
      expect(url).toContain('types=public_channel%2Cprivate_channel');
      return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C2', name: 'exec-private' }], response_metadata: { next_cursor: '' } }));
    });
    const result = await testSlackConnection('token', ['exec-private'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
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

  it('falls back to the raw user id when the users:read scope is missing, rather than failing the sync', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.list')) return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
      if (url.includes('conversations.history')) return Promise.resolve(jsonResponse({ ok: true, messages: [{ user: 'U1', text: 'hi', ts: '1.1' }] }));
      return Promise.resolve(jsonResponse({ ok: false, error: 'missing_scope' }));
    });
    const result = await syncSlackItems(['general'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.[0].author).toBe('U1');
  });

  it('resolves a real display name and inline @-mentions when users:read is available', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.list')) return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
      if (url.includes('conversations.history')) return Promise.resolve(jsonResponse({ ok: true, messages: [{ user: 'U1', text: 'hey <@U1>, ping <@U2> too', ts: '1.1' }] }));
      const id = new URL(url).searchParams.get('user');
      return Promise.resolve(jsonResponse({ ok: true, user: { profile: { display_name: id === 'U1' ? 'Minerva' : 'Dahlia' } } }));
    });
    const result = await syncSlackItems(['general'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.[0].author).toBe('Minerva');
    expect(result.value?.[0].preview).toBe('hey @Minerva, ping @Dahlia too');
  });

  it('filters out channel_join and similar system messages', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('conversations.list')) return Promise.resolve(jsonResponse({ ok: true, channels: [{ id: 'C1', name: 'general' }], response_metadata: { next_cursor: '' } }));
      return Promise.resolve(jsonResponse({ ok: true, messages: [{ user: 'U1', text: '<@U1> has joined the channel', subtype: 'channel_join', ts: '1.1' }, { user: 'U2', text: 'real message', ts: '2.2' }] }));
    });
    const result = await syncSlackItems(['general'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].preview).toBe('real message');
  });
});
