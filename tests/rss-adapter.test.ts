import { describe, expect, it, vi } from 'vitest';
import { connectRss } from '../src/main/adapters/rss-adapter';

function textResponse(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body } as Response;
}

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  <item><title>First post</title><link>https://example.com/1</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item>
  <item><title>Second post</title><link>https://example.com/2</link><pubDate>Tue, 02 Jan 2026 00:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM_XML = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry><title>Atom entry</title><link href="https://example.com/a1"/><updated>2026-01-01T00:00:00Z</updated></entry>
</feed>`;

describe('connectRss', () => {
  it('parses an RSS 2.0 feed into title and items', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(200, RSS_XML));
    const result = await connectRss({ feedUrl: 'https://example.com/feed.xml' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.feedTitle).toBe('Example Blog');
    expect(result.value?.items).toEqual([
      { title: 'First post', link: 'https://example.com/1', publishedAt: 'Mon, 01 Jan 2026 00:00:00 GMT' },
      { title: 'Second post', link: 'https://example.com/2', publishedAt: 'Tue, 02 Jan 2026 00:00:00 GMT' }
    ]);
  });

  it('parses an Atom feed into title and items', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(200, ATOM_XML));
    const result = await connectRss({ feedUrl: 'https://example.com/atom.xml' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.feedTitle).toBe('Example Atom Feed');
    expect(result.value?.items).toEqual([{ title: 'Atom entry', link: 'https://example.com/a1', publishedAt: '2026-01-01T00:00:00Z' }]);
  });

  it('rejects non-feed content with a plain-language error instead of crashing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(200, '<html><body>Not a feed</body></html>'));
    const result = await connectRss({ feedUrl: 'https://example.com/not-a-feed' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/recognizable RSS or Atom feed/i);
  });

  it('rejects unparseable garbage without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(200, '<<<not xml at all'));
    const result = await connectRss({ feedUrl: 'https://example.com/garbage' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
  });

  it('rejects feed XML content pasted in place of a URL, without ever calling fetch', async () => {
    const fetchImpl = vi.fn();
    const result = await connectRss({ feedUrl: RSS_XML }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/doesn't look like a web address/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('caps items at 10 for a feed with many entries', async () => {
    const items = Array.from({ length: 25 }, (_, i) => `<item><title>Post ${i}</title><link>https://example.com/${i}</link></item>`).join('');
    const fetchImpl = vi.fn().mockResolvedValue(textResponse(200, `<rss version="2.0"><channel><title>Big Feed</title>${items}</channel></rss>`));
    const result = await connectRss({ feedUrl: 'https://example.com/big.xml' }, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.value?.items).toHaveLength(10);
  });
});
