import { GitHubItem } from '../../shared/contracts';

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
  if (status === 404) return 'That repository could not be found — check the owner/repo spelling, and that the token has access to it.';
  if (status !== null) return `GitHub responded with an unexpected error (status ${status}). Try again in a moment.`;
  if (cause instanceof Error && /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(cause.message)) {
    return 'Could not reach GitHub. Check the network connection.';
  }
  return 'Could not complete the request to GitHub.';
}

/** Accepts however the installer typed a list of repos — commas, newlines, or both — and normalizes
 * to a clean "owner/repo" list. Kept as one plain-text field (like Jira's saved-search field) rather
 * than a repeatable list of inputs, so adding one more repo is just typing, not a form-management task. */
export function parseRepoList(raw: string): string[] {
  return [...new Set(raw.split(/[\n,]/).map((entry) => entry.trim()).filter((entry) => /^[^/\s]+\/[^/\s]+$/.test(entry)))];
}

export async function testGitHubConnection(token: string, repos: string[], fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ login: string }>> {
  if (repos.length === 0) return { ok: false, error: 'List at least one repository as owner/repo (e.g. octocat/hello-world).' };
  try {
    const userResponse = await fetchImpl('https://api.github.com/user', { headers: authHeaders(token) });
    if (!userResponse.ok) return { ok: false, error: mapError(userResponse.status) };
    const user = (await userResponse.json()) as { login?: string };
    if (!user.login) return { ok: false, error: 'GitHub did not return an account login for that token.' };
    // Confirm the token can actually see the first listed repo — the fastest way to catch a typo'd
    // owner/repo or a token scoped to the wrong repos, before saving the connection.
    const repoResponse = await fetchImpl(`https://api.github.com/repos/${repos[0]}`, { headers: authHeaders(token) });
    if (!repoResponse.ok) return { ok: false, error: mapError(repoResponse.status) };
    return { ok: true, value: { login: user.login } };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}

export async function syncGitHubItems(repos: string[], token: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<GitHubItem[]>> {
  try {
    const items: GitHubItem[] = [];
    for (const repo of repos) {
      const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues?state=open&per_page=20`, { headers: authHeaders(token) });
      if (!response.ok) return { ok: false, error: mapError(response.status) };
      const body = (await response.json()) as Array<{ title: string; html_url: string; state: string; number: number; pull_request?: unknown }>;
      items.push(...body.map((item) => ({
        key: `${repo}#${item.number}`,
        title: item.title,
        kind: (item.pull_request ? 'pull_request' : 'issue') as GitHubItem['kind'],
        state: item.state,
        url: item.html_url
      })));
    }
    return { ok: true, value: items };
  } catch (cause) {
    return { ok: false, error: mapError(null, cause) };
  }
}
