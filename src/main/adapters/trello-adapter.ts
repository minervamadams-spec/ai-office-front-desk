import { TrelloItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/** Maps HTTP failures to one human-readable sentence — never the raw response body, which Trello
 * sometimes returns as plain text ("invalid key", "invalid token") rather than JSON. */
function mapError(status: number | null, cause?: unknown): string {
  if (status === 401) return 'That API key and token were not accepted by Trello. Confirm the token has not been revoked.';
  if (status === 400) return 'Trello rejected that request — check the API key and token were pasted correctly.';
  if (status !== null) return `Trello responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach Trello. Check the network connection.';
  }
  return 'Could not complete the request to Trello.';
}

function authParams(key: string, token: string): string {
  return new URLSearchParams({ key, token }).toString();
}

export async function testTrelloConnection(key: string, token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ username: string }>> {
  try {
    const response = await fetchImpl(`https://api.trello.com/1/members/me?${authParams(key, token)}`);
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { username?: string; fullName?: string };
    return { ok: true, value: { username: body.username ?? body.fullName ?? 'your account' } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncTrelloItems(key: string, token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<TrelloItem[]>> {
  try {
    const params = `${authParams(key, token)}&fields=name,due,url&filter=open`;
    const response = await fetchImpl(`https://api.trello.com/1/members/me/cards?${params}`);
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as Array<{ id: string; name: string; due: string | null; url: string }>;
    const items: TrelloItem[] = body.map((card) => ({ id: card.id, title: card.name, due: card.due, url: card.url }));
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
