import { useMemo, useState } from 'react';
import type { ConnectorManifest, ConnectorState, GoogleState, OutlookState, GitHubState, SlackState, TeamsState } from '../shared/contracts';
import { JiraConnectForm } from './JiraConnectForm';
import { GoogleConnectForm } from './GoogleConnectForm';
import { OutlookConnectForm } from './OutlookConnectForm';
import { GitHubConnectForm } from './GitHubConnectForm';
import { SlackConnectForm } from './SlackConnectForm';
import { TeamsConnectForm } from './TeamsConnectForm';
import { statusLabelFor, statusClassFor, NotReadyDetails } from './CatalogHelpers';

/** The searchable "browse and connect a service" grid — shared by Settings and the first-run wizard.
 * Purely a configuration surface: it never appears on the live dashboard (see S1 feedback). */
export function ServiceCatalogGrid({ catalog, jira, google, outlook, github, slack, teams, dismissedNotices, onDismissNotice, showSearch = true }: {
  catalog: ConnectorManifest[]; jira: ConnectorState; google: GoogleState; outlook: OutlookState; github: GitHubState; slack: SlackState; teams: TeamsState;
  dismissedNotices: string[]; onDismissNotice: (id: string) => void; showSearch?: boolean;
}) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => (showSearch ? catalog.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())) : catalog), [catalog, query, showSearch]);
  const connectedIds = new Set([
    jira.status === 'connected' ? 'jira' : null,
    google.status === 'connected' ? 'google' : null,
    outlook.status === 'connected' ? 'outlook' : null,
    github.status === 'connected' ? 'github' : null,
    slack.status === 'connected' ? 'slack' : null,
    teams.status === 'connected' ? 'teams' : null
  ].filter((id): id is string => id !== null));

  return <>
    {showSearch && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Teams, GitHub, Miro…" aria-label="Search services" className="catalog-search"/>}
    <div className="service-grid">{visible.map((service) => <article key={service.id} className="service-card">
      <div className="service-top"><h3>{service.name}</h3><span className={`status ${statusClassFor(service, connectedIds)}`}>{statusLabelFor(service, connectedIds)}</span></div>
      <p>{service.summary}</p>
      <dl><div><dt>Reads</dt><dd>{service.reads}</dd></div><div><dt>Setup</dt><dd>{service.setupTime}{service.adminApproval ? ' · admin may approve' : ''}</dd></div></dl>
      <div className="service-actions">
        {service.status === 'available' && !connectedIds.has(service.id) && connecting !== service.id && <button className="primary" onClick={() => setConnecting(service.id)}>Connect</button>}
        {service.status !== 'available' && service.officialSetupUrl && <button onClick={() => void window.frontDesk.openExternal(service.officialSetupUrl!)}>{service.status === 'planned' ? 'View requirements' : 'Show setup guide'}</button>}
        {service.officialSetupUrl && <button className="link" onClick={() => void window.frontDesk.openExternal(service.officialSetupUrl!)}>Official guide ↗</button>}
        <NotReadyDetails service={service}/>
      </div>
      {service.id === 'jira' && connecting === 'jira' && jira.status !== 'connected' && <JiraConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
      {service.id === 'google' && connecting === 'google' && google.status !== 'connected' && <GoogleConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
      {service.id === 'outlook' && connecting === 'outlook' && outlook.status !== 'connected' && <OutlookConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
      {service.id === 'github' && connecting === 'github' && github.status !== 'connected' && <GitHubConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
      {service.id === 'slack' && connecting === 'slack' && slack.status !== 'connected' && <SlackConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
      {service.id === 'teams' && connecting === 'teams' && teams.status !== 'connected' && <TeamsConnectForm onConnected={() => setConnecting(null)} dismissedNotices={dismissedNotices} onDismissNotice={onDismissNotice}/>}
    </article>)}</div>
  </>;
}
