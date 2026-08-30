import { NotionItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const NOTION_VERSION = '2022-06-28';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' };
}

/** Maps HTTP failures to one human-readable sentence — never the raw response body. */
function mapError(status: number | null, cause?: unknown): string {
  if (status === 401) return 'That integration secret was not accepted by Notion. Confirm it is still active.';
  if (status === 403) return 'Notion rejected that request — check the integration has been shared with at least one page.';
  if (status !== null) return `Notion responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach Notion. Check the network connection.';
  }
  return 'Could not complete the request to Notion.';
}

interface NotionPage {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, { type: string; title?: Array<{ plain_text?: string }> }>;
}

function titleOf(page: NotionPage): string {
  const titleProperty = Object.values(page.properties ?? {}).find((property) => property.type === 'title');
  const text = titleProperty?.title?.map((fragment) => fragment.plain_text ?? '').join('') ?? '';
  return text.trim() || '(untitled)';
}

export async function testNotionConnection(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ workspace: string }>> {
  try {
    const response = await fetchImpl('https://api.notion.com/v1/users/me', { headers: authHeaders(token) });
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { bot?: { workspace_name?: string } };
    return { ok: true, value: { workspace: body.bot?.workspace_name ?? 'your workspace' } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncNotionItems(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<NotionItem[]>> {
  try {
    const response = await fetchImpl('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ page_size: 15, sort: { direction: 'descending', timestamp: 'last_edited_time' }, filter: { value: 'page', property: 'object' } })
    });
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { results?: NotionPage[] };
    const items: NotionItem[] = (body.results ?? []).map((page) => ({
      id: page.id,
      title: titleOf(page),
      lastEditedAt: page.last_edited_time ?? '',
      url: page.url ?? ''
    }));
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
