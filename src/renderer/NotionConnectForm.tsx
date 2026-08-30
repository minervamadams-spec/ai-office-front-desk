import { useState } from 'react';
import type { NotionConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function NotionConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<NotionConnectInput>({ token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.token.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.notion.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — connected to ${result.value?.workspace}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.notion.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="notion-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. This requires creating your own internal integration in your Notion workspace — Notion does not charge for that either.
    </Dismissible>
    <p className="intro">Create an internal integration at notion.so/my-integrations for your own workspace, then paste its secret here. Open each page you want tracked in Notion, click "…" → "Connections", and add your integration — it can only read pages explicitly shared with it.</p>
    <label>Internal integration secret<input type="password" value={input.token} onChange={(e) => setInput({ token: e.target.value })} placeholder="ntn_…"/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://developers.notion.com/docs/authorization')}>Create an integration ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
