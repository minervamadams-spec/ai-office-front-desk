import { useState } from 'react';
import type { JiraConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

const defaultJql = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';

export function JiraConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<JiraConnectInput>({ siteUrl: '', email: '', apiToken: '', jql: defaultJql });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.siteUrl.trim() && input.email.trim() && input.apiToken.trim();

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.jira.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — matched ${result.value?.matchedCount ?? 0} issue(s).` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.jira.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="jira-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Atlassian API requests made with your token count against your own Jira plan's usage and rate limits.
    </Dismissible>
    <p className="intro">Create an API token in your Atlassian account, then paste it here — it stays only in this computer's secure storage, and you can revoke it at Atlassian any time.</p>
    <label>Jira site URL<input value={input.siteUrl} onChange={(e) => setInput({ ...input, siteUrl: e.target.value })} placeholder="https://yourcompany.atlassian.net"/></label>
    <label>Account email<input value={input.email} onChange={(e) => setInput({ ...input, email: e.target.value })} placeholder="you@yourcompany.com"/></label>
    <label>API token<input type="password" value={input.apiToken} onChange={(e) => setInput({ ...input, apiToken: e.target.value })} placeholder="Paste your Atlassian API token"/></label>
    <label>Saved search (JQL)<input value={input.jql} onChange={(e) => setInput({ ...input, jql: e.target.value })}/></label>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/')}>Create an API token ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
