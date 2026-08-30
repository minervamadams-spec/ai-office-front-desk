import { useState } from 'react';

export function RssConnectForm({ onConnected }: { onConnected: () => void }) {
  const [feedUrl, setFeedUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true); setStatus(null);
    const state = await window.frontDesk.rss.connect({ feedUrl });
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setStatus(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <p className="intro">Paste an RSS or Atom feed URL. This reads the feed directly — no account needed.</p>
    <label>Feed URL<input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://example.com/feed.xml" onKeyDown={(e) => e.key === 'Enter' && feedUrl.trim() && connect()}/></label>
    {status && <p className="form-status">{status}</p>}
    <div className="actions">
      <button className="primary" disabled={!feedUrl.trim() || busy} onClick={() => void connect()}>{busy ? 'Loading…' : 'Connect'}</button>
    </div>
  </div>;
}
