import { useState } from 'react';
import type { AsanaConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function AsanaConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<AsanaConnectInput>({ token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.token.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.asana.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — signed in as ${result.value?.name}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.asana.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="asana-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Asana API requests made with your token count against your own account's usage.
    </Dismissible>
    <p className="intro">Create a personal access token in Asana at My Settings → Apps → Manage Developer Apps, then paste it here — it stays only in this computer's secure storage, and you can revoke it at Asana any time.</p>
    <label>Personal access token<input type="password" value={input.token} onChange={(e) => setInput({ token: e.target.value })} placeholder="Paste your Asana token"/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://developers.asana.com/docs/personal-access-token')}>Create a token ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
