import { useState } from 'react';
import type { GitHubConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function GitHubConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<GitHubConnectInput>({ token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.token.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.github.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — signed in as ${result.value?.login}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.github.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="github-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. GitHub API requests made with your token count against your own account's rate limits.
    </Dismissible>
    <p className="intro">Create a fine-grained personal access token with read-only Issues and Pull requests permissions, then paste it here — it stays only in this computer's secure storage, and you can revoke it at GitHub any time.</p>
    <label>Personal access token<input type="password" value={input.token} onChange={(e) => setInput({ token: e.target.value })} placeholder="github_pat_…"/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens')}>Create a token ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
