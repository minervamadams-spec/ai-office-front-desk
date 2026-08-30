import { useState } from 'react';
import type { SlackConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function SlackConnectForm({ onConnected, onSkip, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; onSkip?: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<SlackConnectInput>({ token: '', channels: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canTest = input.token.trim().length > 0 && input.channels.trim().length > 0;

  async function runTest() {
    setBusy(true); setTestResult(null);
    const result = await window.frontDesk.slack.test(input);
    setBusy(false);
    setTestResult(result.ok ? `Looks good — connected to ${result.value?.team}.` : (result.error ?? 'Could not verify this connection.'));
  }

  async function connect() {
    setBusy(true);
    const state = await window.frontDesk.slack.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setTestResult(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="slack-token-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. This requires creating your own Slack app in your workspace — Slack does not charge for that either.
    </Dismissible>
    <p className="intro">Create a Slack app "from scratch" at api.slack.com/apps for your own workspace, add the <code>channels:history</code> and <code>channels:read</code> Bot Token Scopes, install it, then paste the Bot User OAuth Token (starts with <code>xoxb-</code>) here. Invite the bot to each channel below with <code>/invite</code> first — it can only read channels it's a member of.</p>
    <label>Bot User OAuth token<input type="password" value={input.token} onChange={(e) => setInput({ ...input, token: e.target.value })} placeholder="xoxb-…"/></label>
    <label>Channels to track<textarea value={input.channels} onChange={(e) => setInput({ ...input, channels: e.target.value })} placeholder={'general\nengineering'} rows={3}/></label>
    <p className="intro" style={{ marginTop: -4 }}>One per line (or comma-separated), public channel names without the <code>#</code> — e.g. <code>general</code>.</p>
    {testResult && <p className="form-status">{testResult}</p>}
    <div className="actions">
      <button disabled={!canTest || busy} onClick={() => void runTest()}>{busy ? 'Checking…' : 'Test connection'}</button>
      <button className="primary" disabled={!canTest || busy} onClick={() => void connect()}>Save connection</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://api.slack.com/authentication/basics')}>Create a Slack app ↗</button>
      {onSkip && <button onClick={onSkip}>Skip for now</button>}
    </div>
  </div>;
}
