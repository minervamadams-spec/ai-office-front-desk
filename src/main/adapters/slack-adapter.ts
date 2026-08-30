import { SlackItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

/** Slack's Web API always answers HTTP 200 — success/failure lives in the JSON body's `ok`/`error`
 * fields instead of the status code, so errors are mapped from that string, not a status number. */
function mapSlackError(code: string | undefined): string {
  switch (code) {
    case 'invalid_auth':
    case 'not_authed':
    case 'token_revoked':
    case 'account_inactive':
      return 'That bot token was not accepted by Slack. Confirm it is still installed and has not been revoked.';
    case 'missing_scope':
      return "This token is missing a required permission (scope) — add channels:history and channels:read to the Slack app's Bot Token Scopes, then reinstall it to the workspace.";
    case 'channel_not_found':
      return 'One of those channels could not be found. Check the spelling, and that it is a public channel.';
    case 'not_in_channel':
      return "The bot isn't a member of one of those channels yet — invite it with /invite in that channel, then try again.";
    default:
      return code ? `Slack responded with an unexpected error (${code}). Try again in a moment.` : 'Could not complete the request to Slack.';
  }
}

function mapTransportError(cause: unknown): string {
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach Slack. Check the network connection.';
  }
  return 'Could not complete the request to Slack.';
}

/** Same plain-text, comma-or-newline list pattern as GitHub's repo list — one field, not a
 * repeatable form. Installers type channel names without the leading "#". */
export function parseChannelList(raw: string): string[] {
  return [...new Set(raw.split(/[\n,]/).map((entry) => entry.trim().replace(/^#/, '')).filter((entry) => entry.length > 0))];
}

async function resolveChannelIds(names: string[], token: string, fetchImpl: FetchLike): Promise<AdapterResult<Map<string, string>>> {
  const found = new Map<string, string>();
  let cursor = '';
  do {
    const params = new URLSearchParams({ types: 'public_channel', exclude_archived: 'true', limit: '200', cursor });
    const response = await fetchImpl(`https://slack.com/api/conversations.list?${params}`, { headers: authHeaders(token) });
    const body = (await response.json()) as { ok: boolean; error?: string; channels?: Array<{ id: string; name: string }>; response_metadata?: { next_cursor?: string } };
    if (!body.ok) return { ok: false, error: mapSlackError(body.error) };
    for (const channel of body.channels ?? []) if (names.includes(channel.name)) found.set(channel.name, channel.id);
    cursor = body.response_metadata?.next_cursor ?? '';
  } while (cursor && found.size < names.length);
  return { ok: true, value: found };
}

export async function testSlackConnection(token: string, channels: string[], fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ team: string }>> {
  if (channels.length === 0) return { ok: false, error: 'List at least one public channel name (without the #), e.g. general.' };
  try {
    const authResponse = await fetchImpl('https://slack.com/api/auth.test', { method: 'POST', headers: authHeaders(token) });
    const auth = (await authResponse.json()) as { ok: boolean; error?: string; team?: string };
    if (!auth.ok) return { ok: false, error: mapSlackError(auth.error) };
    const resolved = await resolveChannelIds(channels, token, fetchImpl);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const missing = channels.filter((name) => !resolved.value?.has(name));
    if (missing.length > 0) return { ok: false, error: `Could not find channel(s): ${missing.join(', ')}. Check the spelling and that they're public.` };
    return { ok: true, value: { team: auth.team ?? 'your workspace' } };
  } catch (cause) {
    return { ok: false, error: mapTransportError(cause) };
  }
}

export async function syncSlackItems(channels: string[], token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<SlackItem[]>> {
  try {
    const resolved = await resolveChannelIds(channels, token, fetchImpl);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const items: SlackItem[] = [];
    for (const [name, channelId] of resolved.value ?? []) {
      const params = new URLSearchParams({ channel: channelId, limit: '5' });
      const response = await fetchImpl(`https://slack.com/api/conversations.history?${params}`, { headers: authHeaders(token) });
      const body = (await response.json()) as { ok: boolean; error?: string; messages?: Array<{ user?: string; text?: string; ts: string }> };
      if (!body.ok) return { ok: false, error: mapSlackError(body.error) };
      for (const message of body.messages ?? []) {
        items.push({
          channel: name,
          author: message.user ?? 'unknown',
          // Preview only — never the full message, consistent with this app's metadata-over-content stance elsewhere.
          preview: (message.text ?? '').slice(0, 140),
          ts: message.ts,
          url: `https://slack.com/archives/${channelId}/p${message.ts.replace('.', '')}`
        });
      }
    }
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapTransportError(cause) };
  }
}
