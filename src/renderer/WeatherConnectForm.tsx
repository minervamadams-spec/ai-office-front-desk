import { useState } from 'react';

export function WeatherConnectForm({ onConnected }: { onConnected: () => void }) {
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true); setStatus(null);
    const state = await window.frontDesk.weather.connect({ location });
    setBusy(false);
    if (state.status === 'connected') onConnected(); else setStatus(state.lastError ?? 'Could not connect.');
  }

  return <div className="jira-form">
    <p className="intro">Enter a city — this uses the free Open-Meteo service and needs no account or API key.</p>
    <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Portland, Oregon" onKeyDown={(e) => e.key === 'Enter' && location.trim() && connect()}/></label>
    {status && <p className="form-status">{status}</p>}
    <div className="actions">
      <button className="primary" disabled={!location.trim() || busy} onClick={() => void connect()}>{busy ? 'Looking up…' : 'Connect'}</button>
    </div>
  </div>;
}
