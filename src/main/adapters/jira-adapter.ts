import { JiraConnectInput, JiraTicket } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.trim().replace(/\/+$/, '');
}

/** Maps transport/HTTP failures to one human-readable sentence — never a raw stack or response body. */
function mapError(status: number | null, cause?: unknown): string {
  if (status === 401 || status === 403) return 'That email and API token were not accepted by Jira. Confirm the token is still active.';
  if (status === 404) return 'That Jira site address could not be found. Check the site URL.';
  if (status === 410) return 'Jira no longer supports the search endpoint this app used to call. Update the app and try again.';
  if (status === 400) return 'Jira rejected that saved search — check the JQL for a typo.';
  if (status !== null) return `Jira responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach that Jira site. Check the network connection and site URL.';
  }
  return 'Could not complete the request to Jira.';
}

// Atlassian retired GET/POST /rest/api/3/search — /rest/api/3/search/jql is the documented replacement.
// It has no `total` field (paginates by nextPageToken instead), so "matched count" here means issues
// returned for this page, not a true total — accurate enough for a maxResults=1 connectivity check.
async function searchJql(siteUrl: string, input: JiraConnectInput, fetchImpl: FetchLike, maxResults: number, fields: string[]) {
  return fetchImpl(`${siteUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Authorization: authHeader(input.email, input.apiToken), Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql: input.jql, maxResults, fields })
  });
}

export async function testJiraConnection(input: JiraConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ matchedCount: number }>> {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  try {
    const response = await fetchImpl(`${siteUrl}/rest/api/3/myself`, { headers: { Authorization: authHeader(input.email, input.apiToken), Accept: 'application/json' } });
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const search = await searchJql(siteUrl, input, fetchImpl, 1, ['summary']);
    if (!search.ok) return { ok: false, error: mapError(search.status) };
    const body = (await search.json()) as { issues?: unknown[] };
    return { ok: true, value: { matchedCount: body.issues?.length ?? 0 } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncJiraTickets(input: JiraConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<JiraTicket[]>> {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  try {
    const response = await searchJql(siteUrl, input, fetchImpl, 25, ['summary', 'status', 'priority', 'reporter']);
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { issues?: Array<{ key: string; fields: { summary?: string; status?: { name?: string }; priority?: { name?: string }; reporter?: { displayName?: string } } }> };
    const tickets: JiraTicket[] = (body.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary ?? '(no summary)',
      status: issue.fields.status?.name ?? 'Unknown',
      priority: issue.fields.priority?.name ?? 'None',
      requester: issue.fields.reporter?.displayName ?? 'Unknown',
      url: `${siteUrl}/browse/${issue.key}`
    }));
    return { ok: true, value: tickets };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
