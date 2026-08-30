import { useState } from 'react';
import type { LinearConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function LinearConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<LinearConnectInput>({ token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.token.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.linear.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — signed in as ${result.value?.name}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.linear.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="linear-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Linear API requests made with your key count against your own account's usage.
    </Dismissible>
    <p className="intro">Create a personal API key in Linear Settings → Account → API, then paste it here — it stays only in this computer's secure storage, and you can revoke it at Linear any time.</p>
    <label>Personal API key<input type="password" value={input.token} onChange={(e) => setInput({ token: e.target.value })} placeholder="lin_api_…"/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://linear.app/developers/api#personal-api-keys')}>Create an API key ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
