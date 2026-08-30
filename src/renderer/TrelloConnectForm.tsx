import { useState } from 'react';
import type { TrelloConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function TrelloConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<TrelloConnectInput>({ key: '', token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.key.trim().length > 0 && input.token.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.trello.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — signed in as ${result.value?.username}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.trello.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="trello-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Trello API requests made with your key and token count against your own account's usage.
    </Dismissible>
    <p className="intro">Get your API key from trello.com/power-ups/admin, then use it to generate a token authorizing read-only access to your own account. Paste both here — they stay only in this computer's secure storage, and you can revoke the token at Trello any time.</p>
    <label>API key<input type="password" value={input.key} onChange={(e) => setInput({ ...input, key: e.target.value })} placeholder="Paste your Trello API key"/></label>
    <label>Token<input type="password" value={input.token} onChange={(e) => setInput({ ...input, token: e.target.value })} placeholder="Paste your Trello token"/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://trello.com/power-ups/admin')}>Get a key and token ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
