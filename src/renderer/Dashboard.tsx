import type { ConnectorState, DeskProfile, GoogleState, OutlookState, RoutineItem, AffirmationItem, QuickLaunchItem, WeatherState, RssState } from '../shared/contracts';
import { FocusCard } from './FocusCard';
import { ProjectsCard } from './ProjectsCard';
import { NotesCard } from './NotesCard';
import { RoutinesCard } from './RoutinesCard';
import { AffirmationsCard } from './AffirmationsCard';
import { QuickLaunchCard } from './QuickLaunchCard';

function WeatherCard({ weather, onSync, onDisconnect }: { weather: WeatherState; onSync: () => Promise<void>; onDisconnect: () => Promise<void> }) {
  if (weather.status !== 'connected' && weather.status !== 'error') return null; // configure from Settings, not here
  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">WEATHER</p><h2>{weather.status === 'connected' ? weather.resolvedLocation : 'Weather'}</h2></div>{weather.status === 'connected' && <span>{timeAgo(weather.lastSyncedAt)}</span>}</div>
    {weather.status === 'connected' && <div className="weather-current"><strong>{Math.round(weather.temperatureC ?? 0)}°C</strong><span>{weather.conditions}</span></div>}
    {weather.status === 'connected' && <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={() => void onSync()}>Sync now</button><button onClick={() => void onDisconnect()}>Disconnect</button></div>}
    {weather.status === 'error' && <p className="form-status" style={{ margin: '10px 16px' }}>{weather.lastError}</p>}
  </section>;
}

function RssCard({ rss, onSync, onDisconnect }: { rss: RssState; onSync: () => Promise<void>; onDisconnect: () => Promise<void> }) {
  if (rss.status !== 'connected' && rss.status !== 'error') return null; // configure from Settings, not here
  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">RSS</p><h2>{rss.status === 'connected' ? rss.feedTitle : 'RSS feed'}</h2></div>{rss.status === 'connected' && <span>{timeAgo(rss.lastSyncedAt)}</span>}</div>
    {rss.status === 'connected' && (rss.items.length > 0
      ? <ul className="ticket-list">{rss.items.map((item, i) => <li key={i}><a onClick={() => item.link && void window.frontDesk.openContentLink(item.link)}>{item.title}</a></li>)}</ul>
      : <p className="intro sample-note">No items in this feed.</p>)}
    {rss.status === 'connected' && <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={() => void onSync()}>Sync now</button><button onClick={() => void onDisconnect()}>Disconnect</button></div>}
    {rss.status === 'error' && <p className="form-status" style={{ margin: '10px 16px' }}>{rss.lastError}</p>}
  </section>;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never synced';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

/** Live status only — connected services and their data. Browsing/connecting new services lives in
 * Settings (see S1 feedback: a catalog of mostly-"unavailable" cards doesn't belong on the daily-use surface). */
function ConnectionsCard({ jira, google, outlook, onSyncJira, onDisconnectJira, onSyncGoogle, onDisconnectGoogle, onSyncOutlook, onDisconnectOutlook, onOpenSettings }: {
  jira: ConnectorState; google: GoogleState; outlook: OutlookState;
  onSyncJira: () => Promise<void>; onDisconnectJira: () => Promise<void>;
  onSyncGoogle: () => Promise<void>; onDisconnectGoogle: () => Promise<void>;
  onSyncOutlook: () => Promise<void>; onDisconnectOutlook: () => Promise<void>;
  onOpenSettings: () => void;
}) {
  const anyConnected = jira.status === 'connected' || google.status === 'connected' || outlook.status === 'connected';
  const anyError = jira.status === 'error' || google.status === 'error' || outlook.status === 'error';

  if (!anyConnected && !anyError) {
    return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CONNECTIONS</p><h2>Nothing connected yet</h2></div></div>
      <div className="actions" style={{ padding: '14px 16px' }}><button className="primary" onClick={onOpenSettings}>Add a connection in Settings</button></div>
    </section>;
  }

  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">CONNECTIONS</p><h2>Connected services</h2></div></div>

    {jira.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">JIRA</p><h2>{jira.tickets.length ? `${jira.tickets.length} open ticket(s)` : 'No open tickets'}</h2></div><span>{timeAgo(jira.lastSyncedAt)}</span></div>
      {jira.tickets.length > 0 && <ul className="ticket-list">{jira.tickets.map((t) => <li key={t.key}><a onClick={() => void window.frontDesk.openContentLink(t.url)}>{t.key}</a><span>{t.summary}</span><em>{t.status}</em></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncJira()}>Sync now</button><button onClick={() => void onDisconnectJira()}>Disconnect</button></div>
    </div>}
    {jira.status === 'error' && <p className="form-status">{jira.lastError}</p>}

    {google.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">GOOGLE</p><h2>{google.inboxUnread ?? 0} unread in inbox</h2></div><span>{timeAgo(google.lastSyncedAt)}</span></div>
      {google.driveRecentFiles.length > 0 && <ul className="ticket-list">{google.driveRecentFiles.map((f) => <li key={f.webViewLink}><a onClick={() => void window.frontDesk.openContentLink(f.webViewLink)}>{f.name}</a></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncGoogle()}>Sync now</button><button onClick={() => void onDisconnectGoogle()}>Disconnect</button></div>
    </div>}
    {google.status === 'error' && <p className="form-status">{google.lastError}</p>}

    {outlook.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">OUTLOOK</p><h2>{outlook.inboxUnread ?? 0} unread in inbox</h2></div><span>{timeAgo(outlook.lastSyncedAt)}</span></div>
      {outlook.recentMessages.length > 0 && <ul className="ticket-list">{outlook.recentMessages.map((m, i) => <li key={i}><strong>{m.from}</strong><span>{m.subject}</span></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncOutlook()}>Sync now</button><button onClick={() => void onDisconnectOutlook()}>Disconnect</button></div>
    </div>}
    {outlook.status === 'error' && <p className="form-status">{outlook.lastError}</p>}

    <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={onOpenSettings}>Manage connections</button></div>
  </section>;
}

export function Dashboard({ profile, jira, google, outlook, weather, rss, onSyncJira, onDisconnectJira, onSyncGoogle, onDisconnectGoogle, onSyncOutlook, onDisconnectOutlook, onSyncWeather, onDisconnectWeather, onSyncRss, onDisconnectRss, onOpenSettings, onUpdateFocusText, onUpdateProjectItems, onUpdateNoteItems, onUpdateRoutines, onUpdateAffirmations, onUpdateQuickLaunch }: {
  profile: DeskProfile; jira: ConnectorState; google: GoogleState; outlook: OutlookState; weather: WeatherState; rss: RssState;
  onSyncJira: () => Promise<void>; onDisconnectJira: () => Promise<void>;
  onSyncGoogle: () => Promise<void>; onDisconnectGoogle: () => Promise<void>;
  onSyncOutlook: () => Promise<void>; onDisconnectOutlook: () => Promise<void>;
  onSyncWeather: () => Promise<void>; onDisconnectWeather: () => Promise<void>;
  onSyncRss: () => Promise<void>; onDisconnectRss: () => Promise<void>;
  onOpenSettings: () => void;
  onUpdateFocusText: (focusText: string) => void;
  onUpdateProjectItems: (items: RoutineItem[]) => void;
  onUpdateNoteItems: (items: RoutineItem[]) => void;
  onUpdateRoutines: (routines: RoutineItem[]) => void;
  onUpdateAffirmations: (affirmations: AffirmationItem[]) => void;
  onUpdateQuickLaunch: (links: QuickLaunchItem[]) => void;
}) {
  const cards = profile.design.cardOrder;
  const connectedCount = [jira.status, google.status, outlook.status, weather.status, rss.status].filter((s) => s === 'connected').length;
  const itemsAdded = profile.routines.length + profile.affirmations.length + profile.quickLaunch.length
    + profile.projectItems.length + profile.noteItems.length + (profile.focusText ? 1 : 0);

  function renderCard(id: string) {
    switch (id) {
      case 'focus': return <FocusCard key={id} focusText={profile.focusText} useSampleData={profile.useSampleData} onUpdate={onUpdateFocusText}/>;
      case 'projects': return <ProjectsCard key={id} items={profile.projectItems} useSampleData={profile.useSampleData} onUpdate={onUpdateProjectItems}/>;
      case 'routines': return <RoutinesCard key={id} routines={profile.routines} useSampleData={profile.useSampleData} onUpdateRoutines={onUpdateRoutines}/>;
      case 'notes': return <NotesCard key={id} items={profile.noteItems} useSampleData={profile.useSampleData} onUpdate={onUpdateNoteItems}/>;
      case 'affirmations': return <AffirmationsCard key={id} affirmations={profile.affirmations} useSampleData={profile.useSampleData} onUpdateAffirmations={onUpdateAffirmations}/>;
      case 'weather': return <WeatherCard key={id} weather={weather} onSync={onSyncWeather} onDisconnect={onDisconnectWeather}/>;
      case 'rss': return <RssCard key={id} rss={rss} onSync={onSyncRss} onDisconnect={onDisconnectRss}/>;
      case 'quicklaunch': return <QuickLaunchCard key={id} links={profile.quickLaunch} useSampleData={profile.useSampleData} onUpdateLinks={onUpdateQuickLaunch}/>;
      case 'connections': return <ConnectionsCard key={id} jira={jira} google={google} outlook={outlook}
        onSyncJira={onSyncJira} onDisconnectJira={onDisconnectJira}
        onSyncGoogle={onSyncGoogle} onDisconnectGoogle={onDisconnectGoogle}
        onSyncOutlook={onSyncOutlook} onDisconnectOutlook={onDisconnectOutlook}
        onOpenSettings={onOpenSettings}/>;
      default: return null;
    }
  }

  const column2Ids = new Set(profile.design.column2);
  const column1Cards = cards.filter((id) => !column2Ids.has(id));
  const column2Cards = cards.filter((id) => column2Ids.has(id));

  return <>
    <section className="metrics"><div><strong>{connectedCount}</strong><span>CONNECTED SERVICES</span></div><div><strong>{itemsAdded}</strong><span>ITEMS ADDED</span></div><div><strong>LOCAL</strong><span>DATA LOCATION</span></div></section>
    {profile.design.columns === 1
      ? <section className="workspace workspace-single">{cards.map(renderCard)}</section>
      : <section className="workspace workspace-split"><div className="workspace-col">{column1Cards.map(renderCard)}</div><div className="workspace-col">{column2Cards.map(renderCard)}</div></section>}
    <div className="actions" style={{ maxWidth: 1450, margin: '14px auto 0' }}><button onClick={onOpenSettings}>Settings</button></div>
  </>;
}
