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
      return "This token is missing a required permission (scope) — add channels:history, channels:read, groups:history, and groups:read to the Slack app's Bot Token Scopes, then reinstall it to the workspace.";
    case 'channel_not_found':
      return 'One of those channels could not be found. Check the spelling — and if it\'s private, invite the bot to it first with /invite in that channel.';
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

// Slack's conversations.list only ever returns private channels the bot is already a member of —
// there is no way to discover a private channel it hasn't been invited to, by design. Listing both
// types together means a mix of public and private channel names in one field just works, as long
// as the bot has been /invite'd to each private one and the token has groups:read/groups:history.
async function resolveChannelIds(names: string[], token: string, fetchImpl: FetchLike): Promise<AdapterResult<Map<string, string>>> {
  const found = new Map<string, string>();
  let cursor = '';
  do {
    const params = new URLSearchParams({ types: 'public_channel,private_channel', exclude_archived: 'true', limit: '200', cursor });
    const response = await fetchImpl(`https://slack.com/api/conversations.list?${params}`, { headers: authHeaders(token) });
    const body = (await response.json()) as { ok: boolean; error?: string; channels?: Array<{ id: string; name: string }>; response_metadata?: { next_cursor?: string } };
    if (!body.ok) return { ok: false, error: mapSlackError(body.error) };
    for (const channel of body.channels ?? []) if (names.includes(channel.name)) found.set(channel.name, channel.id);
    cursor = body.response_metadata?.next_cursor ?? '';
  } while (cursor && found.size < names.length);
  return { ok: true, value: found };
}

export async function testSlackConnection(token: string, channels: string[], fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ team: string }>> {
  if (channels.length === 0) return { ok: false, error: 'List at least one channel name (without the #), e.g. general. Private channels work too, once the bot is invited.' };
  try {
    const authResponse = await fetchImpl('https://slack.com/api/auth.test', { method: 'POST', headers: authHeaders(token) });
    const auth = (await authResponse.json()) as { ok: boolean; error?: string; team?: string };
    if (!auth.ok) return { ok: false, error: mapSlackError(auth.error) };
    const resolved = await resolveChannelIds(channels, token, fetchImpl);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const missing = channels.filter((name) => !resolved.value?.has(name));
    if (missing.length > 0) return { ok: false, error: `Could not find channel(s): ${missing.join(', ')}. Check the spelling — private channels also need the bot invited first with /invite.` };
    return { ok: true, value: { team: auth.team ?? 'your workspace' } };
  } catch (cause) {
    return { ok: false, error: mapTransportError(cause) };
  }
}

// System messages ("X has joined the channel", topic/purpose changes) aren't real conversation
// content — filtered out rather than shown as a message with a mention-syntax body.
const NOISE_SUBTYPES = new Set(['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'channel_archive', 'channel_unarchive', 'bot_add', 'bot_remove']);

/** Best-effort real-name lookup: needs the separate users:read scope this connector doesn't
 * require, so a missing scope (or any other failure) just falls back to the raw user ID rather
 * than surfacing an error — this is a display nicety, not something that should ever block a sync. */
async function resolveUserNames(userIds: Set<string>, token: string, fetchImpl: FetchLike): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  await Promise.all([...userIds].map(async (id) => {
    try {
      const response = await fetchImpl(`https://slack.com/api/users.info?${new URLSearchParams({ user: id })}`, { headers: authHeaders(token) });
      const body = (await response.json()) as { ok: boolean; user?: { profile?: { display_name?: string }; real_name?: string } };
      if (body.ok) names.set(id, body.user?.profile?.display_name || body.user?.real_name || id);
    } catch { /* fall back to the raw id below */ }
  }));
  return names;
}

function formatPreview(text: string | undefined, names: Map<string, string>): string {
  const withNames = (text ?? '').replace(/<@([A-Z0-9]+)>/g, (_match, id) => `@${names.get(id) || id}`);
  return withNames.replace(/\s+/g, ' ').trim().slice(0, 140);
}

export async function syncSlackItems(channels: string[], token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<SlackItem[]>> {
  try {
    const resolved = await resolveChannelIds(channels, token, fetchImpl);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const rawMessages: Array<{ name: string; channelId: string; message: { user?: string; text?: string; ts: string; subtype?: string } }> = [];
    for (const [name, channelId] of resolved.value ?? []) {
      const params = new URLSearchParams({ channel: channelId, limit: '5' });
      const response = await fetchImpl(`https://slack.com/api/conversations.history?${params}`, { headers: authHeaders(token) });
      const body = (await response.json()) as { ok: boolean; error?: string; messages?: Array<{ user?: string; text?: string; ts: string; subtype?: string }> };
      if (!body.ok) return { ok: false, error: mapSlackError(body.error) };
      for (const message of body.messages ?? []) {
        if (message.subtype && NOISE_SUBTYPES.has(message.subtype)) continue;
        rawMessages.push({ name, channelId, message });
      }
    }
    const userIds = new Set<string>();
    for (const { message } of rawMessages) {
      if (message.user) userIds.add(message.user);
      for (const match of (message.text ?? '').matchAll(/<@([A-Z0-9]+)>/g)) userIds.add(match[1]);
    }
    const names = await resolveUserNames(userIds, token, fetchImpl);
    // Preview only — never the full message, consistent with this app's metadata-over-content stance elsewhere.
    const items: SlackItem[] = rawMessages.map(({ name, channelId, message }) => ({
      channel: name,
      // A raw Slack user id (U02UAJP0F) is meaningless to a person reading the dashboard — leave
      // author blank rather than show it when no real name is available (no users:read scope).
      author: (message.user && names.get(message.user)) || '',
      preview: formatPreview(message.text, names),
      ts: message.ts,
      url: `https://slack.com/archives/${channelId}/p${message.ts.replace('.', '')}`
    }));
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapTransportError(cause) };
  }
}
