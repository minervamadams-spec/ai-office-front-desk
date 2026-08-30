import { XMLParser } from 'fast-xml-parser';
import type { RssConnectInput, RssItem } from '../../shared/contracts';
import type { AdapterResult } from './jira-adapter';

export type FetchLike = typeof fetch;

const MAX_ITEMS = 10;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function mapError(status: number | null): string {
  if (status !== null) return `That feed responded with an unexpected error (status ${status}).`;
  return 'Could not reach that feed. Check the network connection and the feed URL.';
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>)['#text']);
  return '';
}

interface ParsedFeed {
  feedTitle: string;
  items: RssItem[];
}

function parseFeed(xml: string): AdapterResult<ParsedFeed> {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return { ok: false, error: 'That address did not return a readable RSS or Atom feed.' };
  }
  const root = doc as Record<string, unknown>;

  const rss = root.rss as { channel?: Record<string, unknown> } | undefined;
  if (rss?.channel) {
    const channel = rss.channel;
    const rawItems = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
    const items: RssItem[] = rawItems.slice(0, MAX_ITEMS).map((item: Record<string, unknown>) => ({
      title: textOf(item.title) || '(no title)',
      link: textOf(item.link),
      publishedAt: textOf(item.pubDate) || null
    }));
    return { ok: true, value: { feedTitle: textOf(channel.title) || 'Untitled feed', items } };
  }

  const feed = root.feed as Record<string, unknown> | undefined;
  if (feed) {
    const rawEntries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
    const items: RssItem[] = rawEntries.slice(0, MAX_ITEMS).map((entry: Record<string, unknown>) => {
      const link = entry.link as { '@_href'?: string } | Array<{ '@_href'?: string }> | undefined;
      const href = Array.isArray(link) ? link[0]?.['@_href'] : link?.['@_href'];
      return { title: textOf(entry.title) || '(no title)', link: href ?? '', publishedAt: textOf(entry.updated) || textOf(entry.published) || null };
    });
    return { ok: true, value: { feedTitle: textOf(feed.title) || 'Untitled feed', items } };
  }

  return { ok: false, error: 'That address did not return a recognizable RSS or Atom feed.' };
}

export async function connectRss(input: RssConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<ParsedFeed>> {
  let url: URL;
  try {
    url = new URL(input.feedUrl.trim());
  } catch {
    return { ok: false, error: "That doesn't look like a web address. Enter the feed's URL, starting with https://, not its contents." };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'The feed address must start with https:// or http://.' };
  }
  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) return { ok: false, error: mapError(response.status) };
    return parseFeed(await response.text());
  } catch {
    return { ok: false, error: mapError(null) };
  }
}

export async function syncRss(feedUrl: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<ParsedFeed>> {
  return connectRss({ feedUrl }, fetchImpl);
}
