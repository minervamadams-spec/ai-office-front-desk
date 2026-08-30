import { LinearItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/** Linear's Personal API key goes in the Authorization header with no "Bearer" prefix. */
function authHeaders(token: string): Record<string, string> {
  return { Authorization: token, 'Content-Type': 'application/json' };
}

interface GraphQlError { message?: string }
interface GraphQlResponse<T> { data?: T; errors?: GraphQlError[] }

/** Maps HTTP and GraphQL-level failures to one human-readable sentence — never the raw response body. */
function mapError(status: number | null, graphQlErrors?: GraphQlError[], cause?: unknown): string {
  if (status === 401 || status === 403) return 'That personal API key was not accepted by Linear. Confirm it is still active.';
  if (graphQlErrors?.length) {
    const message = graphQlErrors[0]?.message ?? '';
    if (/auth|token|key/i.test(message)) return 'That personal API key was not accepted by Linear. Confirm it is still active.';
    return 'Linear rejected that request. Try again in a moment.';
  }
  if (status !== null) return `Linear responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach Linear. Check the network connection.';
  }
  return 'Could not complete the request to Linear.';
}

async function graphQl<T>(query: string, token: string, fetchImpl: FetchLike): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const response = await fetchImpl('https://api.linear.app/graphql', { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ query }) });
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as GraphQlResponse<T>;
    if (body.errors?.length) return { ok: false, error: mapError(null, body.errors) };
    if (!body.data) return { ok: false, error: 'Linear did not return the expected data.' };
    return { ok: true, value: body.data };
  } catch (cause) {
    return { ok: false, error: mapError(null, undefined, cause) };
  }
}

export async function testLinearConnection(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ name: string }>> {
  const result = await graphQl<{ viewer?: { name?: string } }>('query { viewer { name } }', token, fetchImpl);
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.value.viewer?.name) return { ok: false, error: 'Linear did not return an account name for that key.' };
  return { ok: true, value: { name: result.value.viewer.name } };
}

export async function syncLinearItems(token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<LinearItem[]>> {
  const query = `query {
    issues(filter: { assignee: { isMe: { eq: true } } }, first: 20, orderBy: updatedAt) {
      nodes { identifier title url state { name } }
    }
  }`;
  const result = await graphQl<{ issues?: { nodes?: Array<{ identifier: string; title: string; url: string; state?: { name?: string } }> } }>(query, token, fetchImpl);
  if (!result.ok) return { ok: false, error: result.error };
  const items: LinearItem[] = (result.value.issues?.nodes ?? []).map((issue) => ({
    key: issue.identifier,
    title: issue.title,
    state: issue.state?.name ?? 'Unknown',
    url: issue.url
  }));
  return { ok: true, value: items };
}
