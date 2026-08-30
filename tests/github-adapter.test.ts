import { describe, expect, it, vi } from 'vitest';
import { syncGitHubItems, testGitHubConnection } from '../src/main/adapters/github-adapter';
import type { GitHubConnectInput } from '../src/shared/contracts';

const input: GitHubConnectInput = { token: 'github_pat_token' };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('github adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' }));
    const result = await testGitHubConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('Bad credentials');
    expect(result.error).toMatch(/personal access token/i);
  });

  it('maps a 403 to a permission/rate-limit message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, {}));
    const result = await testGitHubConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate limit|permission/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND api.github.com'));
    const result = await testGitHubConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach github/i);
  });

  it('returns the authenticated login on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { login: 'minervamadams' }));
    const result = await testGitHubConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ login: 'minervamadams' });
  });

  it('sends the token as a Bearer authorization header, never in a query string or body', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      expect(url).not.toContain(input.token);
      expect((opts?.headers as Record<string, string>).Authorization).toBe(`Bearer ${input.token}`);
      return Promise.resolve(jsonResponse(200, { login: 'minervamadams' }));
    });
    await testGitHubConnection(input, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('normalizes search results into the display-safe GitHubItem shape, distinguishing issues from pull requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      items: [
        { title: 'Fix the thing', html_url: 'https://github.com/owner/repo/issues/1', state: 'open', number: 1, repository_url: 'https://api.github.com/repos/owner/repo' },
        { title: 'Add the feature', html_url: 'https://github.com/owner/repo/pull/2', state: 'open', number: 2, repository_url: 'https://api.github.com/repos/owner/repo', pull_request: {} }
      ]
    }));
    const result = await syncGitHubItems('minervamadams', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      { key: 'owner/repo#1', title: 'Fix the thing', kind: 'issue', state: 'open', url: 'https://github.com/owner/repo/issues/1' },
      { key: 'owner/repo#2', title: 'Add the feature', kind: 'pull_request', state: 'open', url: 'https://github.com/owner/repo/pull/2' }
    ]);
  });

  it('renders an empty item list rather than throwing when nothing is open', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    const result = await syncGitHubItems('minervamadams', 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
