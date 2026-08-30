import { useState } from 'react';
import type { OutlookConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function OutlookConnectForm({ onConnected, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<OutlookConnectInput>({ clientId: '', tenant: 'common' });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canConnect = input.clientId.trim() && input.tenant.trim();

  async function connect() {
    setBusy(true); setStatus('Opening Microsoft sign-in in your browser…');
    const state = await window.frontDesk.outlook.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setStatus(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="outlook-oauth-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Outlook requests made with your sign-in count against your own Microsoft 365 account's own usage limits.
    </Dismissible>
    <p className="intro">Register a "Mobile and desktop applications" app in Microsoft Entra ID with a public-client redirect, then paste its client ID here. Sign-in happens in your system browser — this app never sees your Microsoft password.</p>
    <label>Client ID<input value={input.clientId} onChange={(e) => setInput({ ...input, clientId: e.target.value })} placeholder="Application (client) ID"/></label>
    <label>Tenant<input value={input.tenant} onChange={(e) => setInput({ ...input, tenant: e.target.value })} placeholder="common, organizations, or your tenant ID"/></label>
    {status && <p className="form-status">{status}</p>}
    <div className="actions">
      <button className="primary" disabled={!canConnect || busy} onClick={() => void connect()}>{busy ? 'Waiting for sign-in…' : 'Connect with Microsoft'}</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration')}>Set up an app registration ↗</button>
    </div>
  </div>;
}
