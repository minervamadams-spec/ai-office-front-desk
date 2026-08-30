export type ConnectorStatus = 'available' | 'needs_setup' | 'planned';

export interface DeskDesign {
  accent: 'blue' | 'violet' | 'teal';
  density: 'comfortable' | 'compact';
  columns: 1 | 2;
  showDescriptions: boolean;
  cardOrder: string[];
  /** Subset of cardOrder assigned to the second column when columns === 2; the rest render in the first. */
  column2: string[];
  /** Cards currently collapsed to just their header — click the header again to expand. */
  collapsedCards: string[];
}

export interface RoutineItem {
  id: string;
  title: string;
  detail: string;
}

export interface AffirmationItem {
  id: string;
  text: string;
}

/** 'link' opens `url` in the default browser (the original, and still simplest, behavior).
 * 'app' launches a local application by name — `target` — ignoring `url`. macOS only for now.
 * 'chrome-profile' opens `url` specifically inside the Chrome profile named by `target` (its on-disk
 * profile directory, e.g. "Profile 3") — for installers who keep separate Chrome profiles per Google
 * account (e.g. a personal account plus a child's school account) and need a link to always open in
 * the right one rather than whichever profile Chrome happens to have focused. macOS only for now. */
export type QuickLaunchKind = 'link' | 'app' | 'chrome-profile';

export interface QuickLaunchItem {
  id: string;
  label: string;
  kind: QuickLaunchKind;
  url: string;
  target: string;
}

export interface ChromeProfileInfo {
  /** The on-disk profile directory name (e.g. "Default", "Profile 3") — not shown to the user. */
  directory: string;
  /** Display label built from the profile's own name and signed-in account, e.g. "Justin (justin@school.edu)". */
  label: string;
}

export interface DeskProfile {
  firstName: string;
  deskName: string;
  timezone: string;
  onboardingComplete: boolean;
  wizardStep: number;
  useSampleData: boolean;
  design: DeskDesign;
  dismissedNotices: string[];
  routines: RoutineItem[];
  affirmations: AffirmationItem[];
  quickLaunch: QuickLaunchItem[];
  focusText: string;
  projectItems: RoutineItem[];
  noteItems: RoutineItem[];
}

export const MAX_ROUTINES = 50;
export const MAX_AFFIRMATIONS = 50;
export const MAX_QUICK_LAUNCH = 30;
export const MAX_PROJECT_ITEMS = 50;
export const MAX_NOTE_ITEMS = 50;

export const sampleAffirmations: AffirmationItem[] = [
  { id: 'a1', text: 'Progress today counts, even in small steps.' },
  { id: 'a2', text: "You've solved harder problems than this one." }
];

// Suggestions only — encourages installers curious about AI to try one, but this card is a plain link
// launcher for anything (AI tools, internal tools, docs). Nothing here is a real connection.
export const sampleQuickLaunch: QuickLaunchItem[] = [
  { id: 'q1', label: 'Claude', kind: 'link', url: 'https://claude.ai', target: '' },
  { id: 'q2', label: 'ChatGPT', kind: 'link', url: 'https://chatgpt.com', target: '' },
  { id: 'q3', label: 'Gemini', kind: 'link', url: 'https://gemini.google.com', target: '' }
];

export type ConnectionStatus = 'disconnected' | 'connected' | 'error';

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  priority: string;
  requester: string;
  url: string;
}

export interface JiraConnectInput {
  siteUrl: string;
  email: string;
  apiToken: string;
  jql: string;
}

export interface ConnectorState {
  id: 'jira';
  status: ConnectionStatus;
  config: { siteUrl: string; email: string; jql: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  tickets: JiraTicket[];
}

export interface GitHubItem {
  key: string;
  title: string;
  kind: 'issue' | 'pull_request';
  state: string;
  url: string;
}

export interface GitHubConnectInput {
  token: string;
  /** Plain text, comma- or newline-separated "owner/repo" entries — like Jira's saved-search field,
   * typing one more repo is just typing, not a repeatable form-field management task. */
  repos: string;
}

export interface GitHubState {
  id: 'github';
  status: ConnectionStatus;
  config: { login: string; repos: string[] } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: GitHubItem[];
}

export const defaultGitHubState: GitHubState = {
  id: 'github', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface SlackItem {
  channel: string;
  author: string;
  preview: string;
  ts: string;
  url: string;
}

export interface SlackConnectInput {
  token: string;
  /** Plain text, comma- or newline-separated channel names (no leading #) — same pattern as GitHub's repo list. */
  channels: string;
}

export interface SlackState {
  id: 'slack';
  status: ConnectionStatus;
  config: { team: string; channels: string[] } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: SlackItem[];
}

export const defaultSlackState: SlackState = {
  id: 'slack', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface NotionItem {
  id: string;
  title: string;
  lastEditedAt: string;
  url: string;
}

export interface NotionConnectInput {
  token: string;
}

export interface NotionState {
  id: 'notion';
  status: ConnectionStatus;
  config: { workspace: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: NotionItem[];
}

export const defaultNotionState: NotionState = {
  id: 'notion', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface LinearItem {
  key: string;
  title: string;
  state: string;
  url: string;
}

export interface LinearConnectInput {
  token: string;
}

export interface LinearState {
  id: 'linear';
  status: ConnectionStatus;
  config: { name: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: LinearItem[];
}

export const defaultLinearState: LinearState = {
  id: 'linear', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface AsanaItem {
  id: string;
  title: string;
  dueOn: string | null;
  url: string;
}

export interface AsanaConnectInput {
  token: string;
}

export interface AsanaState {
  id: 'asana';
  status: ConnectionStatus;
  config: { name: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: AsanaItem[];
}

export const defaultAsanaState: AsanaState = {
  id: 'asana', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface TrelloItem {
  id: string;
  title: string;
  due: string | null;
  url: string;
}

export interface TrelloConnectInput {
  key: string;
  token: string;
}

export interface TrelloState {
  id: 'trello';
  status: ConnectionStatus;
  config: { username: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: TrelloItem[];
}

export const defaultTrelloState: TrelloState = {
  id: 'trello', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export const defaultJiraState: ConnectorState = {
  id: 'jira', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, tickets: []
};

export interface GoogleConnectInput {
  clientId: string;
  clientSecret: string;
}

export interface DriveFile {
  name: string;
  modifiedTime: string;
  webViewLink: string;
}

export interface GoogleState {
  id: 'google';
  status: ConnectionStatus;
  config: { clientId: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  inboxUnread: number | null;
  driveRecentFiles: DriveFile[];
}

export const defaultGoogleState: GoogleState = {
  id: 'google', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, inboxUnread: null, driveRecentFiles: []
};

export interface OutlookConnectInput {
  clientId: string;
  tenant: string;
}

export interface OutlookMessage {
  subject: string;
  from: string;
  receivedDateTime: string;
}

export interface OutlookState {
  id: 'outlook';
  status: ConnectionStatus;
  config: { clientId: string; tenant: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  inboxUnread: number | null;
  recentMessages: OutlookMessage[];
}

export const defaultOutlookState: OutlookState = {
  id: 'outlook', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, inboxUnread: null, recentMessages: []
};

export interface TeamsConnectInput {
  clientId: string;
  tenant: string;
}

export interface TeamsItem {
  chat: string;
  author: string;
  preview: string;
  timestamp: string;
  url: string;
}

export interface TeamsState {
  id: 'teams';
  status: ConnectionStatus;
  config: { clientId: string; tenant: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  items: TeamsItem[];
}

export const defaultTeamsState: TeamsState = {
  id: 'teams', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, items: []
};

export interface WeatherConnectInput {
  location: string;
}

export interface WeatherState {
  id: 'weather';
  status: ConnectionStatus;
  config: { location: string; latitude: number; longitude: number } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  resolvedLocation: string | null;
  temperatureC: number | null;
  conditions: string | null;
}

export const defaultWeatherState: WeatherState = {
  id: 'weather', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, resolvedLocation: null, temperatureC: null, conditions: null
};

export interface RssConnectInput {
  feedUrl: string;
}

export interface RssItem {
  title: string;
  link: string;
  publishedAt: string | null;
}

export interface RssState {
  id: 'rss';
  status: ConnectionStatus;
  config: { feedUrl: string } | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  feedTitle: string | null;
  items: RssItem[];
}

export const defaultRssState: RssState = {
  id: 'rss', status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, feedTitle: null, items: []
};

export const sampleFocusText = 'Ship the pilot build';

export const sampleProjects: RoutineItem[] = [
  { id: 'p1', title: 'Front Desk pilot rollout', detail: 'Due in 6 days · 3 open tasks' },
  { id: 'p2', title: 'Quarterly planning notes', detail: 'Due in 2 weeks · 1 open task' }
];

export const sampleRoutines: RoutineItem[] = [
  { id: 'r1', title: 'Morning inbox triage', detail: 'Weekdays · 15 minutes' },
  { id: 'r2', title: 'Weekly desk review', detail: 'Fridays · 20 minutes' }
];

export const sampleNotes: RoutineItem[] = [
  { id: 'n1', title: 'Ideas for next sprint', detail: 'Last edited 2 days ago' }
];

export interface ConnectorManifest {
  id: string;
  name: string;
  status: ConnectorStatus;
  summary: string;
  auth: string;
  reads: string;
  permissions: string[];
  adminApproval: boolean;
  apiToken: boolean;
  setupTime: string;
  officialSetupUrl?: string;
  retention: string;
  /** Shown when the installer asks "what would it take" — omitted for status 'available'. */
  notReadyReason?: string;
}

export const knownCardIds = ['focus', 'projects', 'connections', 'routines', 'notes', 'affirmations', 'weather', 'rss', 'quicklaunch'] as const;

export const defaultDesign: DeskDesign = {
  accent: 'blue', density: 'comfortable', columns: 2, showDescriptions: true,
  cardOrder: ['focus', 'projects', 'connections', 'routines', 'notes'],
  column2: ['connections', 'notes'],
  collapsedCards: []
};

export const defaultProfile: DeskProfile = {
  firstName: '', deskName: 'My Front Desk', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  onboardingComplete: false, wizardStep: 0, useSampleData: true, design: defaultDesign, dismissedNotices: [], routines: [], affirmations: [], quickLaunch: [],
  focusText: '', projectItems: [], noteItems: []
};

const secretBrokerReason = "This provider's desktop OAuth needs a client secret, which can't be embedded safely in a distributed app. It stays unavailable until a secure token-broker design is built and reviewed.";

export const connectorCatalog: ConnectorManifest[] = [
  { id: 'google', name: 'Google', status: 'available', summary: 'Inbox counts, message metadata, and recent Drive files.', auth: 'Installer-owned desktop OAuth with PKCE', reads: 'Gmail metadata and Drive file metadata', permissions: ['gmail.metadata', 'drive.metadata.readonly'], adminApproval: false, apiToken: false, setupTime: '10–20 minutes', officialSetupUrl: 'https://developers.google.com/identity/protocols/oauth2/native-app', retention: 'Only selected card fields; disconnect clears the cache.' },
  { id: 'outlook', name: 'Microsoft Outlook', status: 'available', summary: 'Unread count and selected message metadata.', auth: 'Microsoft public-client OAuth with PKCE', reads: 'Inbox count and selected message metadata', permissions: ['Mail.Read'], adminApproval: true, apiToken: false, setupTime: '10–20 minutes', officialSetupUrl: 'https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration', retention: 'Only selected card fields; disconnect clears the cache.' },
  { id: 'jira', name: 'Jira Service Management', status: 'available', summary: 'A selected queue or saved read-only JQL query.', auth: 'Installer-supplied Atlassian API token', reads: 'Ticket key, summary, status, priority, requester', permissions: ['Read-only adapter'], adminApproval: false, apiToken: true, setupTime: '5–10 minutes', officialSetupUrl: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/', retention: 'Selected ticket fields only; disconnect clears the cache.' },
  { id: 'teams', name: 'Microsoft Teams', status: 'available', summary: 'Recent chat message previews from your Microsoft Teams chats.', auth: 'Microsoft Graph public-client OAuth with PKCE — same mechanism as Outlook, a separate app registration or scope', reads: 'Chat message author, a short text preview, and a link', permissions: ['Chat.Read'], adminApproval: true, apiToken: false, setupTime: '10–20 minutes', officialSetupUrl: 'https://learn.microsoft.com/en-us/graph/auth-v2-user', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'github', name: 'GitHub', status: 'available', summary: 'Open issues and pull requests from the repositories you list.', auth: 'Installer-supplied fine-grained personal access token', reads: 'Issue and pull request title, state, and URL from the repos you specify', permissions: ['Issues: Read-only', 'Pull requests: Read-only'], adminApproval: false, apiToken: true, setupTime: '5 minutes', officialSetupUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'miro', name: 'Miro', status: 'planned', summary: 'Potential Miro board activity card.', auth: 'Installer-owned OAuth app', reads: 'No data is read', permissions: [], adminApproval: false, apiToken: false, setupTime: 'Not available yet', officialSetupUrl: 'https://developers.miro.com/docs/getting-started-with-oauth', retention: 'No data is collected until an adapter is approved.', notReadyReason: secretBrokerReason },
  { id: 'slack', name: 'Slack', status: 'available', summary: 'Recent message previews from the public channels you list.', auth: 'Installer-supplied Bot User OAuth Token from a Slack app you create in your own workspace', reads: 'Channel name, message author, a short text preview, and a link — from the channels you specify', permissions: ['channels:history', 'channels:read'], adminApproval: false, apiToken: true, setupTime: '10–15 minutes', officialSetupUrl: 'https://api.slack.com/authentication/basics', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'notion', name: 'Notion', status: 'available', summary: 'Recently edited pages you\'ve shared with your own Notion integration.', auth: 'Installer-supplied internal integration secret from your own Notion workspace — no OAuth handshake needed', reads: 'Page title, last-edited time, and URL — only for pages you share with the integration', permissions: ['Read content'], adminApproval: false, apiToken: true, setupTime: '5 minutes', officialSetupUrl: 'https://developers.notion.com/docs/authorization', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'linear', name: 'Linear', status: 'available', summary: 'Issues currently assigned to you.', auth: 'Installer-supplied Linear personal API key', reads: 'Issue identifier, title, state, and URL', permissions: ['Read-only adapter'], adminApproval: false, apiToken: true, setupTime: '5 minutes', officialSetupUrl: 'https://linear.app/developers/api#personal-api-keys', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'asana', name: 'Asana', status: 'available', summary: 'Incomplete tasks assigned to you, across every workspace you belong to.', auth: 'Installer-supplied Asana personal access token', reads: 'Task title, due date, and URL', permissions: ['Read-only adapter'], adminApproval: false, apiToken: true, setupTime: '5 minutes', officialSetupUrl: 'https://developers.asana.com/docs/personal-access-token', retention: 'Only selected fields; disconnect clears the cache.' },
  { id: 'trello', name: 'Trello', status: 'available', summary: 'Open cards assigned to you across your Trello boards.', auth: 'Installer-supplied Trello API key and token from their own account', reads: 'Card title, due date, and URL', permissions: ['Read-only adapter'], adminApproval: false, apiToken: true, setupTime: '5 minutes', officialSetupUrl: 'https://trello.com/power-ups/admin', retention: 'Only selected fields; disconnect clears the cache.' }
];

export const catalogStatusLabel: Record<ConnectorStatus, string> = {
  available: 'Ready to connect',
  needs_setup: 'Needs provider setup',
  planned: 'Unavailable in this installation'
};
