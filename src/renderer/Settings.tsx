import { useEffect, useState } from 'react';
import type { ConnectorManifest, ConnectorState, DeskProfile, GoogleState, OutlookState, WeatherState, RssState, QuickLaunchItem, GitHubState, SlackState, TeamsState, NotionState, LinearState } from '../shared/contracts';
import { LayoutEditor } from './LayoutEditor';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';
import { QuickLaunchManager } from './QuickLaunchCard';

export function Settings({ profile, catalog, jira, google, outlook, weather, rss, github, slack, teams, notion, linear, onUpdateDesign, onUpdateQuickLaunch, onReopenWizard, onDisconnectJira, onDisconnectGoogle, onDisconnectOutlook, onDisconnectWeather, onDisconnectRss, onDisconnectGitHub, onDisconnectSlack, onDisconnectTeams, onDisconnectNotion, onDisconnectLinear, onImportLayout, onDismissNotice, onSyncAll, onDeleteAll, onClose }: {
  profile: DeskProfile; catalog: ConnectorManifest[]; jira: ConnectorState; google: GoogleState; outlook: OutlookState; weather: WeatherState; rss: RssState; github: GitHubState; slack: SlackState; teams: TeamsState; notion: NotionState; linear: LinearState;
  onUpdateDesign: (patch: Partial<DeskProfile['design']>) => Promise<void>;
  onUpdateQuickLaunch: (links: QuickLaunchItem[]) => void;
  onReopenWizard: () => Promise<void>;
  onDisconnectJira: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onDisconnectOutlook: () => Promise<void>;
  onDisconnectWeather: () => Promise<void>;
  onDisconnectRss: () => Promise<void>;
  onDisconnectGitHub: () => Promise<void>;
  onDisconnectSlack: () => Promise<void>;
  onDisconnectTeams: () => Promise<void>;
  onDisconnectNotion: () => Promise<void>;
  onDisconnectLinear: () => Promise<void>;
  onImportLayout: () => Promise<{ imported: boolean; error?: string }>;
  onDismissNotice: (id: string) => void;
  onSyncAll: () => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean | null>(null);

  useEffect(() => { void window.frontDesk.getLaunchAtLogin().then(setLaunchAtLogin); }, []);

  async function toggleLaunchAtLogin() {
    setLaunchAtLogin(await window.frontDesk.setLaunchAtLogin(!launchAtLogin));
  }

  const connectedCount = [jira.status, google.status, outlook.status, weather.status, rss.status, github.status, slack.status, teams.status, notion.status, linear.status].filter((s) => s === 'connected').length;

  async function exportDiagnostics() {
    const result = await window.frontDesk.exportDiagnostics();
    setExported(result.saved ? `Saved to ${result.path}` : 'Export canceled');
  }

  async function exportLayout() {
    const result = await window.frontDesk.exportLayout();
    setLayoutStatus(result.saved ? `Saved to ${result.path}` : 'Export canceled');
  }

  async function importLayout() {
    const result = await onImportLayout();
    setLayoutStatus(result.imported ? 'Layout imported.' : (result.error ?? 'Import canceled'));
  }

  async function syncAll() {
    setSyncingAll(true);
    await onSyncAll();
    setSyncingAll(false);
    setSyncedAt(new Date().toLocaleTimeString());
  }

  return <div className="settings-overlay"><div className="settings-panel">
    <div className="panel-heading"><div><p className="eyebrow">SETTINGS</p><h2>Desk & connections</h2></div><button onClick={onClose}>Close</button></div>

    <section><h3>Startup</h3><label className="switch"><input type="checkbox" checked={launchAtLogin ?? false} disabled={launchAtLogin === null} onChange={() => void toggleLaunchAtLogin()}/><span>Start automatically when you log in</span></label></section>

    <section><h3>Quick Launch links</h3><p className="intro">Edit or remove entries here — the dashboard card stays a clean, one-click list.</p><QuickLaunchManager links={profile.quickLaunch} onUpdateLinks={onUpdateQuickLaunch}/></section>

    <section><h3>Sync all connections</h3><p className="intro">Refreshes every connected service ({connectedCount} connected) in one click.</p>
      <div className="actions"><button className="primary" disabled={connectedCount === 0 || syncingAll} onClick={() => void syncAll()}>{syncingAll ? 'Syncing…' : 'Sync all now'}</button></div>
      {syncedAt && !syncingAll && <p className="form-status">Last synced at {syncedAt}.</p>}
    </section>

    <section><h3>Appearance</h3><div className="design-grid"><label>Accent<select value={profile.design.accent} onChange={(e) => void onUpdateDesign({ accent: e.target.value as DeskProfile['design']['accent'] })}><option value="blue">Office blue</option><option value="violet">Quiet violet</option><option value="teal">Studio teal</option></select></label><label>Density<select value={profile.design.density} onChange={(e) => void onUpdateDesign({ density: e.target.value as DeskProfile['design']['density'] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div></section>

    <section><h3>Cards & layout</h3><p className="intro">Choose which cards show and how they're arranged — no need to reopen the whole wizard.</p><LayoutEditor design={profile.design} onUpdateDesign={onUpdateDesign}/></section>

    <section><h3>Setup wizard</h3><p className="intro">Reopen the guided setup to revisit your first-run choices from the start.</p><div className="actions"><button onClick={() => void onReopenWizard()}>Reopen setup wizard</button></div></section>

    <section><h3>Connect a service</h3><p className="intro">Every option explains what it can read and what you need before it can connect. Browsing this list never contacts anyone.</p><ServiceCatalogGrid catalog={catalog} jira={jira} google={google} outlook={outlook} github={github} slack={slack} teams={teams} notion={notion} linear={linear} dismissedNotices={profile.dismissedNotices} onDismissNotice={onDismissNotice}/></section>

    <section><h3>Jira connection</h3><p className="intro">Status: {jira.status === 'connected' ? `Connected to ${jira.config?.siteUrl}` : jira.status === 'error' ? `Error — ${jira.lastError}` : 'Not connected'}</p>{jira.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectJira()}>Disconnect & delete cached tickets</button></div>}</section>

    <section><h3>GitHub connection</h3><p className="intro">Status: {github.status === 'connected' ? `Connected as ${github.config?.login} — tracking ${github.config?.repos.join(', ')}` : github.status === 'error' ? `Error — ${github.lastError}` : 'Not connected'}</p>{github.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectGitHub()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Slack connection</h3><p className="intro">Status: {slack.status === 'connected' ? `Connected to ${slack.config?.team} — tracking ${slack.config?.channels.join(', ')}` : slack.status === 'error' ? `Error — ${slack.lastError}` : 'Not connected'}</p>{slack.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectSlack()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Teams connection</h3><p className="intro">Status: {teams.status === 'connected' ? 'Connected' : teams.status === 'error' ? `Error — ${teams.lastError}` : 'Not connected'}</p>{teams.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectTeams()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Notion connection</h3><p className="intro">Status: {notion.status === 'connected' ? `Connected to ${notion.config?.workspace}` : notion.status === 'error' ? `Error — ${notion.lastError}` : 'Not connected'}</p>{notion.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectNotion()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Linear connection</h3><p className="intro">Status: {linear.status === 'connected' ? `Connected as ${linear.config?.name}` : linear.status === 'error' ? `Error — ${linear.lastError}` : 'Not connected'}</p>{linear.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectLinear()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Google connection</h3><p className="intro">Status: {google.status === 'connected' ? 'Connected' : google.status === 'error' ? `Error — ${google.lastError}` : 'Not connected'}</p>{google.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectGoogle()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Outlook connection</h3><p className="intro">Status: {outlook.status === 'connected' ? 'Connected' : outlook.status === 'error' ? `Error — ${outlook.lastError}` : 'Not connected'}</p>{outlook.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectOutlook()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Weather</h3><p className="intro">Status: {weather.status === 'connected' ? `Connected — ${weather.resolvedLocation}` : weather.status === 'error' ? `Error — ${weather.lastError}` : 'Not connected'}</p>{weather.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectWeather()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>RSS feed</h3><p className="intro">Status: {rss.status === 'connected' ? `Connected — ${rss.feedTitle}` : rss.status === 'error' ? `Error — ${rss.lastError}` : 'Not connected'}</p>{rss.status === 'connected' && <div className="actions"><button onClick={() => void onDisconnectRss()}>Disconnect & delete cached data</button></div>}</section>

    <section><h3>Share your layout</h3><p className="intro">Export just your card choices, order, columns, and appearance — never your connections, tokens, or any content you've typed in. Importing this imports the desk layout only; you'll still sign in to your own accounts.</p><div className="actions"><button onClick={() => void exportLayout()}>Export layout</button><button onClick={() => void importLayout()}>Import layout</button></div>{layoutStatus && <p className="form-status">{layoutStatus}</p>}</section>

    <section><h3>Diagnostics export</h3><p className="intro">Includes only connector status, timestamps, and error codes — never message or ticket content.</p><div className="actions"><button onClick={() => void exportDiagnostics()}>Export diagnostics</button></div>{exported && <p className="form-status">{exported}</p>}</section>

    <section><h3>Delete local app data</h3><p className="intro">Removes this app's profile, connection settings, cached data, and stored secrets. Does not affect any other app.</p>
      {!confirmingDelete
        ? <div className="actions"><button onClick={() => setConfirmingDelete(true)}>Delete local app data</button></div>
        : <div className="actions"><span className="form-status">This can't be undone.</span><button className="primary" onClick={() => void onDeleteAll()}>Confirm delete</button><button onClick={() => setConfirmingDelete(false)}>Cancel</button></div>}
    </section>
  </div></div>;
}
