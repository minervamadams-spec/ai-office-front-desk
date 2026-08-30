import { AsanaItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Maps HTTP failures to one human-readable sentence — never the raw response body. */
function mapError(status: number | null, cause?: unknown): string {
  if (status === 401) return 'That personal access token was not accepted by Asana. Confirm it is still active.';
  if (status === 403) return 'Asana rejected that request — the token may be missing access to a workspace.';
  if (status !== null) return `Asana responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach Asana. Check the network connection.';
  }
  return 'Could not complete the request to Asana.';
}

interface AsanaWorkspace { gid: string; name?: string }

async function fetchWorkspaces(token: string, fetchImpl: FetchLike): Promise<{ ok: true; name: string; workspaces: AsanaWorkspace[] } | { ok: false; error: string }> {
  const response = await fetchImpl('https://app.asana.com/api/1.0/users/me?opt_fields=name,workspaces.name', { headers: authHeaders(token) });
  if (!response.ok) return { ok: false, error: mapError(response.status) };
  const body = (await response.json()) as { data?: { name?: string; workspaces?: AsanaWorkspace[] } };
  if (!body.data?.name) return { ok: false, error: 'Asana did not return an account name for that token.' };
  return { ok: true, name: body.data.name, workspaces: body.data.workspaces ?? [] };
}

export async function testAsanaConnection(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ name: string }>> {
  try {
    const result = await fetchWorkspaces(token, fetchImpl);
    if (!result.ok) return { ok: false, error: result.error };
    if (result.workspaces.length === 0) return { ok: false, error: 'This Asana account is not a member of any workspace yet.' };
    return { ok: true, value: { name: result.name } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncAsanaItems(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<AsanaItem[]>> {
  try {
    const result = await fetchWorkspaces(token, fetchImpl);
    if (!result.ok) return { ok: false, error: result.error };
    const items: AsanaItem[] = [];
    for (const workspace of result.workspaces) {
      const params = new URLSearchParams({ assignee: 'me', workspace: workspace.gid, completed_since: 'now', opt_fields: 'name,due_on,permalink_url' });
      const response = await fetchImpl(`https://app.asana.com/api/1.0/tasks?${params}`, { headers: authHeaders(token) });
      if (!response.ok) return { ok: false, error: mapError(response.status) };
      const body = (await response.json()) as { data?: Array<{ gid: string; name: string; due_on?: string | null; permalink_url?: string }> };
      items.push(...(body.data ?? []).map((task) => ({
        id: task.gid,
        title: task.name,
        dueOn: task.due_on ?? null,
        url: task.permalink_url ?? ''
      })));
    }
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
