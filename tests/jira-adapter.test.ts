import { describe, expect, it, vi } from 'vitest';
import { syncJiraTickets, testJiraConnection } from '../src/main/adapters/jira-adapter';
import type { JiraConnectInput } from '../src/shared/contracts';

const input: JiraConnectInput = { siteUrl: 'https://example.atlassian.net/', email: 'a@b.com', apiToken: 'token', jql: 'assignee = currentUser()' };

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('jira adapter error mapping', () => {
  it('maps a 401 to a human-readable credential message, never the raw response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { errorMessages: ['You are not authenticated.'] }));
    const result = await testJiraConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('errorMessages');
    expect(result.error).toMatch(/email and API token/i);
  });

  it('maps a network failure to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fetch failed: ENOTFOUND example.atlassian.net'));
    const result = await testJiraConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/reach that jira site/i);
  });

  it('normalizes a trailing slash on the site URL when building request URLs', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      expect(url).not.toContain('.net//rest');
      return Promise.resolve(jsonResponse(200, { issues: [] }));
    });
    await testJiraConnection(input, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('POSTs the JQL search body to the current /search/jql endpoint, not the retired query-string one', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/myself')) return Promise.resolve(jsonResponse(200, {}));
      expect(url).toBe('https://example.atlassian.net/rest/api/3/search/jql');
      expect(opts?.method).toBe('POST');
      expect(JSON.parse(String(opts?.body)).jql).toBe(input.jql);
      return Promise.resolve(jsonResponse(200, { issues: [{ key: 'X' }] }));
    });
    const result = await testJiraConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ matchedCount: 1 });
  });

  it('maps a 410 (retired endpoint) to a human-readable message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(410, {}));
    const result = await testJiraConnection(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no longer supports/i);
  });

  it('normalizes issue fields into the display-safe JiraTicket shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      issues: [{ key: 'OPS-1', fields: { summary: 'Fix the thing', status: { name: 'In Progress' }, priority: { name: 'High' }, reporter: { displayName: 'Minerva' } } }]
    }));
    const result = await syncJiraTickets(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([{ key: 'OPS-1', summary: 'Fix the thing', status: 'In Progress', priority: 'High', requester: 'Minerva', url: 'https://example.atlassian.net/browse/OPS-1' }]);
  });

  it('renders an empty ticket list rather than throwing when a queue is empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { issues: [] }));
    const result = await syncJiraTickets(input, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });
});
