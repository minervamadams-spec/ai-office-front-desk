import { useState } from 'react';
import type { ConnectorState, DeskDesign, DeskProfile, GoogleState, OutlookState, RoutineItem, AffirmationItem, QuickLaunchItem, WeatherState, RssState, GitHubState, SlackState, TeamsState } from '../shared/contracts';
import { FocusCard } from './FocusCard';
import { ProjectsCard } from './ProjectsCard';
import { NotesCard } from './NotesCard';
import { RoutinesCard } from './RoutinesCard';
import { AffirmationsCard } from './AffirmationsCard';
import { QuickLaunchCard } from './QuickLaunchCard';
import { reorderCards } from './cardOrdering';

function WeatherCard({ weather, onSync, onDisconnect, collapsed, onToggleCollapse }: { weather: WeatherState; onSync: () => Promise<void>; onDisconnect: () => Promise<void>; collapsed?: boolean; onToggleCollapse?: () => void }) {
  if (weather.status !== 'connected' && weather.status !== 'error') return null; // configure from Settings, not here
  return <section className="panel">
    <div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">WEATHER</p><h2>{weather.status === 'connected' ? weather.resolvedLocation : 'Weather'}</h2></div>{weather.status === 'connected' && <span>{timeAgo(weather.lastSyncedAt)}</span>}<span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
    {!collapsed && <>
      {weather.status === 'connected' && <div className="weather-current"><strong>{Math.round(weather.temperatureC ?? 0)}°C</strong><span>{weather.conditions}</span></div>}
      {weather.status === 'connected' && <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={() => void onSync()}>Sync now</button><button onClick={() => void onDisconnect()}>Disconnect</button></div>}
      {weather.status === 'error' && <p className="form-status" style={{ margin: '10px 16px' }}>{weather.lastError}</p>}
    </>}
  </section>;
}

function RssCard({ rss, onSync, onDisconnect, collapsed, onToggleCollapse }: { rss: RssState; onSync: () => Promise<void>; onDisconnect: () => Promise<void>; collapsed?: boolean; onToggleCollapse?: () => void }) {
  if (rss.status !== 'connected' && rss.status !== 'error') return null; // configure from Settings, not here
  return <section className="panel">
    <div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">RSS</p><h2>{rss.status === 'connected' ? rss.feedTitle : 'RSS feed'}</h2></div>{rss.status === 'connected' && <span>{timeAgo(rss.lastSyncedAt)}</span>}<span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
    {!collapsed && <>
      {rss.status === 'connected' && (rss.items.length > 0
        ? <ul className="ticket-list">{rss.items.map((item, i) => <li key={i}><a onClick={() => item.link && void window.frontDesk.openContentLink(item.link)}>{item.title}</a></li>)}</ul>
        : <p className="intro sample-note">No items in this feed.</p>)}
      {rss.status === 'connected' && <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={() => void onSync()}>Sync now</button><button onClick={() => void onDisconnect()}>Disconnect</button></div>}
      {rss.status === 'error' && <p className="form-status" style={{ margin: '10px 16px' }}>{rss.lastError}</p>}
    </>}
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
function ConnectionsCard({ jira, google, outlook, github, slack, teams, onSyncJira, onDisconnectJira, onSyncGoogle, onDisconnectGoogle, onSyncOutlook, onDisconnectOutlook, onSyncGitHub, onDisconnectGitHub, onSyncSlack, onDisconnectSlack, onSyncTeams, onDisconnectTeams, onOpenSettings, collapsed, onToggleCollapse }: {
  jira: ConnectorState; google: GoogleState; outlook: OutlookState; github: GitHubState; slack: SlackState; teams: TeamsState;
  onSyncJira: () => Promise<void>; onDisconnectJira: () => Promise<void>;
  onSyncGoogle: () => Promise<void>; onDisconnectGoogle: () => Promise<void>;
  onSyncOutlook: () => Promise<void>; onDisconnectOutlook: () => Promise<void>;
  onSyncGitHub: () => Promise<void>; onDisconnectGitHub: () => Promise<void>;
  onSyncSlack: () => Promise<void>; onDisconnectSlack: () => Promise<void>;
  onSyncTeams: () => Promise<void>; onDisconnectTeams: () => Promise<void>;
  onOpenSettings: () => void; collapsed?: boolean; onToggleCollapse?: () => void;
}) {
  const anyConnected = jira.status === 'connected' || google.status === 'connected' || outlook.status === 'connected' || github.status === 'connected' || slack.status === 'connected' || teams.status === 'connected';
  const anyError = jira.status === 'error' || google.status === 'error' || outlook.status === 'error' || github.status === 'error' || slack.status === 'error' || teams.status === 'error';

  if (!anyConnected && !anyError) {
    return <section className="panel"><div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">CONNECTIONS</p><h2>Nothing connected yet</h2></div><span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
      {!collapsed && <div className="actions" style={{ padding: '14px 16px' }}><button className="primary" onClick={onOpenSettings}>Add a connection in Settings</button></div>}
    </section>;
  }

  return <section className="panel">
    <div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">CONNECTIONS</p><h2>Connected services</h2></div><span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
    {!collapsed && <>
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

    {github.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">GITHUB</p><h2>{github.items.length ? `${github.items.length} open issue/PR(s)` : 'Nothing open'}</h2></div><span>{timeAgo(github.lastSyncedAt)}</span></div>
      {github.items.length > 0 && <ul className="ticket-list">{github.items.map((item) => <li key={item.key}><a onClick={() => void window.frontDesk.openContentLink(item.url)}>{item.key}</a><span>{item.title}</span><em>{item.kind === 'pull_request' ? 'PR' : 'Issue'}</em></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncGitHub()}>Sync now</button><button onClick={() => void onDisconnectGitHub()}>Disconnect</button></div>
    </div>}
    {github.status === 'error' && <p className="form-status">{github.lastError}</p>}

    {slack.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">SLACK</p><h2>{slack.items.length ? `${slack.items.length} recent message(s)` : 'Nothing recent'}</h2></div><span>{timeAgo(slack.lastSyncedAt)}</span></div>
      {slack.items.length > 0 && <ul className="ticket-list">{slack.items.map((item, i) => <li key={i}><a onClick={() => void window.frontDesk.openContentLink(item.url)}>#{item.channel}</a><span>{item.preview}</span></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncSlack()}>Sync now</button><button onClick={() => void onDisconnectSlack()}>Disconnect</button></div>
    </div>}
    {slack.status === 'error' && <p className="form-status">{slack.lastError}</p>}

    {teams.status === 'connected' && <div className="jira-summary">
      <div className="panel-heading"><div><p className="eyebrow">TEAMS</p><h2>{teams.items.length ? `${teams.items.length} recent message(s)` : 'Nothing recent'}</h2></div><span>{timeAgo(teams.lastSyncedAt)}</span></div>
      {teams.items.length > 0 && <ul className="ticket-list">{teams.items.map((item, i) => <li key={i}><a onClick={() => item.url && void window.frontDesk.openContentLink(item.url)}>{item.author}</a><span>{item.preview}</span></li>)}</ul>}
      <div className="actions"><button onClick={() => void onSyncTeams()}>Sync now</button><button onClick={() => void onDisconnectTeams()}>Disconnect</button></div>
    </div>}
    {teams.status === 'error' && <p className="form-status">{teams.lastError}</p>}

    <div className="actions" style={{ padding: '0 16px 14px' }}><button onClick={onOpenSettings}>Manage connections</button></div>
    </>}
  </section>;
}

export function Dashboard({ profile, jira, google, outlook, weather, rss, github, slack, teams, onSyncJira, onDisconnectJira, onSyncGoogle, onDisconnectGoogle, onSyncOutlook, onDisconnectOutlook, onSyncWeather, onDisconnectWeather, onSyncRss, onDisconnectRss, onSyncGitHub, onDisconnectGitHub, onSyncSlack, onDisconnectSlack, onSyncTeams, onDisconnectTeams, onOpenSettings, onUpdateDesign, onUpdateFocusText, onUpdateProjectItems, onUpdateNoteItems, onUpdateRoutines, onUpdateAffirmations, onUpdateQuickLaunch }: {
  profile: DeskProfile; jira: ConnectorState; google: GoogleState; outlook: OutlookState; weather: WeatherState; rss: RssState; github: GitHubState; slack: SlackState; teams: TeamsState;
  onSyncJira: () => Promise<void>; onDisconnectJira: () => Promise<void>;
  onSyncGoogle: () => Promise<void>; onDisconnectGoogle: () => Promise<void>;
  onSyncOutlook: () => Promise<void>; onDisconnectOutlook: () => Promise<void>;
  onSyncWeather: () => Promise<void>; onDisconnectWeather: () => Promise<void>;
  onSyncRss: () => Promise<void>; onDisconnectRss: () => Promise<void>;
  onSyncGitHub: () => Promise<void>; onDisconnectGitHub: () => Promise<void>;
  onSyncSlack: () => Promise<void>; onDisconnectSlack: () => Promise<void>;
  onSyncTeams: () => Promise<void>; onDisconnectTeams: () => Promise<void>;
  onOpenSettings: () => void;
  onUpdateDesign: (patch: Partial<DeskDesign>) => Promise<void>;
  onUpdateFocusText: (focusText: string) => void;
  onUpdateProjectItems: (items: RoutineItem[]) => void;
  onUpdateNoteItems: (items: RoutineItem[]) => void;
  onUpdateRoutines: (routines: RoutineItem[]) => void;
  onUpdateAffirmations: (affirmations: AffirmationItem[]) => void;
  onUpdateQuickLaunch: (links: QuickLaunchItem[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const cards = profile.design.cardOrder;
  const connectedCount = [jira.status, google.status, outlook.status, weather.status, rss.status, github.status, slack.status, teams.status].filter((s) => s === 'connected').length;
  const itemsAdded = profile.routines.length + profile.affirmations.length + profile.quickLaunch.length
    + profile.projectItems.length + profile.noteItems.length + (profile.focusText ? 1 : 0);
  const collapsedSet = new Set(profile.design.collapsedCards);

  function toggleCollapse(id: string) {
    const collapsedCards = collapsedSet.has(id) ? profile.design.collapsedCards.filter((c) => c !== id) : [...profile.design.collapsedCards, id];
    void onUpdateDesign({ collapsedCards });
  }

  function renderCard(id: string) {
    const collapsed = collapsedSet.has(id);
    const onToggleCollapse = () => toggleCollapse(id);
    switch (id) {
      case 'focus': return <FocusCard key={id} focusText={profile.focusText} useSampleData={profile.useSampleData} onUpdate={onUpdateFocusText} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'projects': return <ProjectsCard key={id} items={profile.projectItems} useSampleData={profile.useSampleData} onUpdate={onUpdateProjectItems} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'routines': return <RoutinesCard key={id} routines={profile.routines} useSampleData={profile.useSampleData} onUpdateRoutines={onUpdateRoutines} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'notes': return <NotesCard key={id} items={profile.noteItems} useSampleData={profile.useSampleData} onUpdate={onUpdateNoteItems} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'affirmations': return <AffirmationsCard key={id} affirmations={profile.affirmations} useSampleData={profile.useSampleData} onUpdateAffirmations={onUpdateAffirmations} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'weather': return <WeatherCard key={id} weather={weather} onSync={onSyncWeather} onDisconnect={onDisconnectWeather} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'rss': return <RssCard key={id} rss={rss} onSync={onSyncRss} onDisconnect={onDisconnectRss} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'quicklaunch': return <QuickLaunchCard key={id} links={profile.quickLaunch} useSampleData={profile.useSampleData} onUpdateLinks={onUpdateQuickLaunch} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      case 'connections': return <ConnectionsCard key={id} jira={jira} google={google} outlook={outlook} github={github} slack={slack} teams={teams}
        onSyncJira={onSyncJira} onDisconnectJira={onDisconnectJira}
        onSyncGoogle={onSyncGoogle} onDisconnectGoogle={onDisconnectGoogle}
        onSyncOutlook={onSyncOutlook} onDisconnectOutlook={onDisconnectOutlook}
        onSyncGitHub={onSyncGitHub} onDisconnectGitHub={onDisconnectGitHub}
        onSyncSlack={onSyncSlack} onDisconnectSlack={onDisconnectSlack}
        onSyncTeams={onSyncTeams} onDisconnectTeams={onDisconnectTeams}
        onOpenSettings={onOpenSettings} collapsed={collapsed} onToggleCollapse={onToggleCollapse}/>;
      default: return null;
    }
  }

  const column2Ids = new Set(profile.design.column2);
  const column1Cards = cards.filter((id) => !column2Ids.has(id));
  const column2Cards = cards.filter((id) => column2Ids.has(id));

  function drop(targetId: string | null, toColumn2: boolean) {
    if (dragId) void onUpdateDesign(reorderCards(profile.design, dragId, targetId, toColumn2));
    setDragId(null);
  }

  /** Cards are directly draggable right on the dashboard — no trip to Settings needed to rearrange.
   * Dragging one onto another reorders it there (and switches columns, if dropped in the other one);
   * dragging into empty space at the bottom of a column moves it to the end of that column. */
  function renderDraggable(id: string, toColumn2: boolean) {
    const content = renderCard(id);
    if (!content) return null;
    return <div key={id} className={`draggable-card${dragId === id ? ' dragging' : ''}`} draggable
      onDragStart={() => setDragId(id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); drop(id, toColumn2); }}
      onDragEnd={() => setDragId(null)}>{content}</div>;
  }

  return <div className="desk-body">
    <section className="metrics"><div><strong>{connectedCount}</strong><span>CONNECTED SERVICES</span></div><div><strong>{itemsAdded}</strong><span>ITEMS ADDED</span></div><div><strong>LOCAL</strong><span>DATA LOCATION</span></div></section>
    {profile.design.columns === 1
      ? <section className="workspace workspace-single" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null, false)}>{cards.map((id) => renderDraggable(id, false))}</section>
      : <section className="workspace workspace-split">
          <div className="workspace-col" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null, false)}>{column1Cards.map((id) => renderDraggable(id, false))}</div>
          <div className="workspace-col" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null, true)}>{column2Cards.map((id) => renderDraggable(id, true))}</div>
        </section>}
    <div className="actions desk-footer"><button onClick={onOpenSettings}>Settings</button></div>
  </div>;
}
