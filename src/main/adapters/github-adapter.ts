import { GitHubConnectInput, GitHubItem } from '../../shared/contracts';

export type FetchLike = typeof fetch;

export interface AdapterResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

/** Maps transport/HTTP failures to one human-readable sentence — never a raw stack or response body. */
function mapError(status: number | null, cause?: unknown): string {
  if (status === 401) return 'That personal access token was not accepted by GitHub. Confirm it is still active and has not expired.';
  if (status === 403) return 'GitHub rejected that request — the token may be missing the Issues/Pull requests read permission, or a rate limit was hit.';
  if (status === 404) return 'That GitHub account or resource could not be found.';
  if (status !== null) return `GitHub responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach GitHub. Check the network connection.';
  }
  return 'Could not complete the request to GitHub.';
}

async function fetchInvolvedItems(login: string, token: string, fetchImpl: FetchLike, perPage: number) {
  const query = encodeURIComponent(`is:open involves:${login} archived:false`);
  return fetchImpl(`https://api.github.com/search/issues?q=${query}&per_page=${perPage}&sort=updated`, { headers: authHeaders(token) });
}

export async function testGitHubConnection(input: GitHubConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ login: string }>> {
  try {
    const response = await fetchImpl('https://api.github.com/user', { headers: authHeaders(input.token) });
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { login?: string };
    if (!body.login) return { ok: false, error: 'GitHub did not return an account login for that token.' };
    return { ok: true, value: { login: body.login } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncGitHubItems(login: string, token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<GitHubItem[]>> {
  try {
    const response = await fetchInvolvedItems(login, token, fetchImpl, 20);
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    const body = (await response.json()) as { items?: Array<{ title: string; html_url: string; state: string; number: number; repository_url: string; pull_request?: unknown }> };
    const items: GitHubItem[] = (body.items ?? []).map((item) => {
      const repoPath = item.repository_url.replace('https://api.github.com/repos/', '');
      return {
        key: `${repoPath}#${item.number}`,
        title: item.title,
        kind: item.pull_request ? 'pull_request' : 'issue',
        state: item.state,
        url: item.html_url
      };
    });
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
