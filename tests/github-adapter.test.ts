import { describe, expect, it, vi } from 'vitest';
import { parseRepoList, syncGitHubItems, testGitHubConnection } from '../src/main/adapters/github-adapter';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('parseRepoList', () => {
  it('splits on commas and newlines, trims whitespace, and drops anything not shaped like owner/repo', () => {
    expect(parseRepoList('octocat/hello-world, another-owner/another-repo\nthird/one\nnot-a-repo\n')).toEqual([
      'octocat/hello-world', 'another-owner/another-repo', 'third/one'
    ]);
  });

  it('de-duplicates repeated entries', () => {
    expect(parseRepoList('a/b, a/b\na/b')).toEqual(['a/b']);
  });

  it('returns an empty list for blank input', () => {
    expect(parseRepoList('')).toEqual([]);
  });
});

describe('github adapter error mapping', () => {
  it('refuses to test a connection with no repos listed, without making a request', async () => {
    const fetchImpl = vi.fn();
    const result = await testGitHubConnection('token', [], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least one repository/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' }));
    const result = await testGitHubConnection('token', ['octocat/hello-world'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('Bad credentials');
    expect(result.error).toMatch(/personal access token/i);
  });

  it('maps a 404 on the repo check to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/user')) return Promise.resolve(jsonResponse(200, { login: 'minervamadams' }));
      return Promise.resolve(jsonResponse(404, {}));
    });
    const result = await testGitHubConnection('token', ['octocat/hello-world'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/owner\/repo spelling/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND api.github.com'));
    const result = await testGitHubConnection('token', ['octocat/hello-world'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach github/i);
  });

  it('confirms the token and the first repo are both reachable before succeeding', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/user')) {
        expect((opts?.headers as Record<string, string>).Authorization).toBe('Bearer token');
        return Promise.resolve(jsonResponse(200, { login: 'minervamadams' }));
      }
      expect(url).toBe('https://api.github.com/repos/octocat/hello-world');
      return Promise.resolve(jsonResponse(200, {}));
    });
    const result = await testGitHubConnection('token', ['octocat/hello-world'], fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ login: 'minervamadams' });
  });

  it('normalizes issues from each listed repo into the display-safe GitHubItem shape, distinguishing pull requests', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes('owner/repo-a')) return Promise.resolve(jsonResponse(200, [
        { title: 'Fix the thing', html_url: 'https://github.com/owner/repo-a/issues/1', state: 'open', number: 1 }
      ]));
      return Promise.resolve(jsonResponse(200, [
        { title: 'Add the feature', html_url: 'https://github.com/owner/repo-b/pull/2', state: 'open', number: 2, pull_request: {} }
      ]));
    });
    const result = await syncGitHubItems(['owner/repo-a', 'owner/repo-b'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      { key: 'owner/repo-a#1', title: 'Fix the thing', kind: 'issue', state: 'open', url: 'https://github.com/owner/repo-a/issues/1' },
      { key: 'owner/repo-b#2', title: 'Add the feature', kind: 'pull_request', state: 'open', url: 'https://github.com/owner/repo-b/pull/2' }
    ]);
  });

  it('renders an empty item list rather than throwing when nothing is open', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const result = await syncGitHubItems(['owner/repo'], 'token', fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
