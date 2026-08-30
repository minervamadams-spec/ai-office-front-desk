import { useState } from 'react';
import type { GoogleConnectInput } from '../shared/contracts';
import { Dismissible } from './CatalogHelpers';

export function GoogleConnectForm({ onConnected, dismissedNotices, onDismissNotice }: {
  onConnected: () => void; dismissedNotices: string[]; onDismissNotice: (id: string) => void;
}) {
  const [input, setInput] = useState<GoogleConnectInput>({ clientId: '', clientSecret: '' });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canConnect = input.clientId.trim() && input.clientSecret.trim();

  async function connect() {
    setBusy(true); setStatus('Opening Google sign-in in your browser…');
    const state = await window.frontDesk.google.connect(input);
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setStatus(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <Dismissible id="google-oauth-cost" dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}>
      This app never charges you anything. Gmail and Drive requests made with your sign-in count against your own Google account's own usage limits.
    </Dismissible>
    <p className="intro">Create a Desktop app OAuth client in your Google Cloud project, then paste its client ID and client secret here. Sign-in happens in your system browser — this app never sees your Google password.</p>
    <p className="intro">Two easy-to-miss steps in that same project, since they're separate from creating the OAuth client itself: under <strong>APIs & Services → Library</strong>, enable both <strong>Gmail API</strong> and <strong>Google Drive API</strong>; and under <strong>OAuth consent screen → Audience</strong>, add every Google account that will use this under <strong>Test users</strong> (skip this only if you've published the app past Google's testing stage).</p>
    <label>Client ID<input value={input.clientId} onChange={(e) => setInput({ ...input, clientId: e.target.value })} placeholder="xxxxx.apps.googleusercontent.com"/></label>
    <label>Client secret<input type="password" value={input.clientSecret} onChange={(e) => setInput({ ...input, clientSecret: e.target.value })} placeholder="Paste the client secret"/></label>
    {status && <p className="form-status">{status}</p>}
    <div className="actions">
      <button className="primary" disabled={!canConnect || busy} onClick={() => void connect()}>{busy ? 'Waiting for sign-in…' : 'Connect with Google'}</button>
      <button className="link" onClick={() => void window.frontDesk.openExternal('https://developers.google.com/identity/protocols/oauth2/native-app')}>Set up an OAuth client ↗</button>
    </div>
  </div>;
}
