import { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { updateElectronApp } from 'update-electron-app';
import {
  connectorCatalog, JiraConnectInput, GoogleConnectInput, OutlookConnectInput, WeatherConnectInput, RssConnectInput, GitHubConnectInput, SlackConnectInput, TeamsConnectInput, NotionConnectInput, LinearConnectInput,
  defaultJiraState, defaultGoogleState, defaultOutlookState, defaultWeatherState, defaultRssState, defaultGitHubState, defaultSlackState, defaultTeamsState, defaultNotionState, defaultLinearState, ChromeProfileInfo
} from '../shared/contracts';
import { ProfileRepository, sanitizeDesign } from './profile-repository';
import { ConnectorStateRepository } from './connector-state-repository';
import { SecretStore } from './secret-store';
import { testJiraConnection, syncJiraTickets } from './adapters/jira-adapter';
import { connectGoogle, syncGoogle } from './adapters/google-adapter';
import { connectOutlook, syncOutlook } from './adapters/outlook-adapter';
import { connectWeather, syncWeather } from './adapters/weather-adapter';
import { connectRss, syncRss } from './adapters/rss-adapter';
import { testGitHubConnection, syncGitHubItems, parseRepoList } from './adapters/github-adapter';
import { testSlackConnection, syncSlackItems, parseChannelList } from './adapters/slack-adapter';
import { connectTeams, syncTeams } from './adapters/teams-adapter';
import { testNotionConnection, syncNotionItems } from './adapters/notion-adapter';
import { testLinearConnection, syncLinearItems } from './adapters/linear-adapter';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Must run before app.whenReady() — this is what the packaged macOS menu bar/Dock label and an
// unpackaged `electron-forge start` dev run both pick up (a packaged build also gets it from
// Info.plist via forge.config.ts's packagerConfig.name, but dev mode has no Info.plist).
//
// setName() also changes Electron's *default* userData path to match — from the original
// "ai-office-front-desk" (derived from package.json's name) to "AI Office Front Desk" (the display
// name), silently pointing every installer at a second, empty profile folder alongside their real
// one. Pin userData back to the original folder name explicitly so this rename can never do that.
app.setName('AI Office Front Desk');
app.setPath('userData', path.join(app.getPath('appData'), 'ai-office-front-desk'));

// E2E tests set this to a fresh temp directory so test runs never touch a real installer's data.
if (process.env.FRONT_DESK_TEST_USER_DATA_DIR) {
  app.setPath('userData', process.env.FRONT_DESK_TEST_USER_DATA_DIR);
}

// Safety net: update-electron-app calls Squirrel.Mac's autoUpdater.setFeedURL() from inside its own
// app.on('ready', ...) handler, which throws synchronously ("Could not get code signature for
// running application") for an unsigned build that macOS has translocated — which is the ORDINARY
// case for anyone who opens a downloaded/unzipped app without first dragging it to Applications,
// not an edge case. An uncaught exception in any app.on() handler crashes the whole main process
// with Electron's default JS-error dialog; a background update check failing must never do that.
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main process (app keeps running):', error);
});

// Set this to 'owner/repo' once a real GitHub repo exists with published releases (see README's
// "Auto-updates" section) — until then this stays empty and no update checks ever run, so an
// unconfigured build behaves exactly as it did before this was added.
const UPDATE_REPO = 'minervamadams-spec/ai-office-front-desk';
if (app.isPackaged && UPDATE_REPO) {
  updateElectronApp({ repo: UPDATE_REPO, updateInterval: '1 hour' });
}

let profiles: ProfileRepository;
let connectorStates: ConnectorStateRepository;
let secrets: SecretStore;
let dashboardServer: ChildProcess | undefined;
const allowedExternalUrls = new Set(connectorCatalog.flatMap((connector) => connector.officialSetupUrl ? [connector.officialSetupUrl] : []));

// Test runs override this directly so they never depend on — or race — whatever's actually running
// on a real machine. Real launches instead discover the port dynamically (see resolveDashboardUrl):
// a hardcoded guess is exactly what caused a real installed copy to spawn a redundant, competing
// second instance on 2026-08-30 when the real one happened to be running on a different port.
const dashboardUrlOverride = process.env.FRONT_DESK_DASHBOARD_URL;

function dashboardRoot(): string {
  return process.env.FRONT_DESK_DASHBOARD_ROOT || path.join(app.getPath('home'), 'Projects', 'GitHub', 'portfolio-dashboard');
}

/** Reads the same `data/rebuild.lock` file `portfolio-dashboard`'s own serve.js writes (pid + the
 * port it's actually listening on) so an already-running instance is always found and reused,
 * regardless of which port it happens to be on — no more hardcoded-port guessing. */
function discoverDashboardPort(root: string): number | null {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'data', 'rebuild.lock'), 'utf8')) as { pid?: number; port?: number };
    if (typeof lock.port !== 'number' || typeof lock.pid !== 'number') return null;
    process.kill(lock.pid, 0); // throws if that pid is no longer running — a stale lock, ignore its port
    return lock.port;
  } catch {
    return null;
  }
}

function resolveDashboardUrl(): string {
  if (dashboardUrlOverride) return dashboardUrlOverride;
  const discoveredPort = discoverDashboardPort(dashboardRoot());
  return `http://127.0.0.1:${discoveredPort ?? 4173}`;
}

const execFileAsync = promisify(execFile);

/** Reads Chrome's own profile registry to list its profiles by their real name and signed-in Google
 * account — installers with e.g. a personal profile and a child's school profile shouldn't have to
 * know or guess Chrome's internal "Profile 3"-style directory names. macOS only for now. */
async function listChromeProfiles(): Promise<ChromeProfileInfo[]> {
  if (process.platform !== 'darwin') return [];
  try {
    const localStatePath = path.join(app.getPath('home'), 'Library', 'Application Support', 'Google', 'Chrome', 'Local State');
    const parsed = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as { profile?: { info_cache?: Record<string, { name?: string; user_name?: string }> } };
    const cache = parsed.profile?.info_cache ?? {};
    return Object.entries(cache).map(([directory, meta]) => ({
      directory,
      label: meta.user_name ? `${meta.name || directory} (${meta.user_name})` : (meta.name || directory)
    }));
  } catch {
    return [];
  }
}

async function dashboardIsAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/desk-preferences`);
    return response.ok;
  } catch {
    return false;
  }
}

type DashboardStartResult = { status: 'started' | 'unavailable' | 'not-configured'; url: string };

/** Most installs will never have a Portfolio Dashboard checkout — that's the ordinary, expected
 * case for anyone besides its one developer machine, not an error worth interrupting a first
 * launch over. Only 'unavailable' (found the script, but it failed to come up) is worth a dialog. */
async function ensureDashboardServer(): Promise<DashboardStartResult> {
  const url = resolveDashboardUrl();
  if (await dashboardIsAvailable(url)) return { status: 'started', url };
  const root = dashboardRoot();
  if (!fs.existsSync(path.join(root, 'scripts', 'serve.js'))) return { status: 'not-configured', url };
  dashboardServer = spawn(process.execPath, ['scripts/serve.js'], {
    cwd: root,
    detached: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    // The spawned instance always binds the default port (no PORT env override here), but re-resolve
    // anyway in case a separately-started real instance won the rebuild lock in the meantime.
    const settledUrl = resolveDashboardUrl();
    if (await dashboardIsAvailable(settledUrl)) return { status: 'started', url: settledUrl };
  }
  return { status: 'unavailable', url };
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280, height: 860, minWidth: 920, minHeight: 680,
    // Only meaningful on Windows/Linux (and unpackaged dev runs) — a packaged mac .app's Dock icon
    // comes from Info.plist via forge.config.ts's packagerConfig.icon instead.
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }
  const dashboardResult = await ensureDashboardServer();
  if (dashboardResult.status === 'started') {
    void window.loadURL(dashboardResult.url);
    return;
  }
  if (dashboardResult.status === 'unavailable') {
    await dialog.showMessageBox(window, {
      type: 'warning',
      message: 'Your local Portfolio Dashboard could not be started.',
      detail: `Expected it at ${dashboardRoot()}. The standalone Front Desk will open instead.`
    });
  }
  void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}

function userDataPaths() {
  const root = app.getPath('userData');
  return { profiles: path.join(root, 'front-desk.sqlite'), connectors: path.join(root, 'connectors.sqlite'), secrets: path.join(root, 'secrets.sqlite') };
}

function openStores(): void {
  const paths = userDataPaths();
  profiles = new ProfileRepository(paths.profiles);
  connectorStates = new ConnectorStateRepository(paths.connectors);
  secrets = new SecretStore(paths.secrets, {
    encrypt: (plainText) => safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(plainText) : Buffer.from(plainText, 'utf8'),
    decrypt: (cipherText) => safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(cipherText) : cipherText.toString('utf8')
  });
}

function closeStores(): void {
  profiles?.close();
  connectorStates?.close();
  secrets?.close();
}

function buildApplicationMenu(): void {
  app.setAboutPanelOptions({
    applicationName: 'AI Office Front Desk',
    applicationVersion: app.getVersion(),
    copyright: 'Local-first — your data stays on this computer.'
  });
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' as const }, { type: 'separator' as const }, { role: 'services' as const }, { type: 'separator' as const }, { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const }, { type: 'separator' as const }, { role: 'quit' as const }] }] : []),
    { label: 'Edit', submenu: [{ role: 'undo' as const }, { role: 'redo' as const }, { type: 'separator' as const }, { role: 'cut' as const }, { role: 'copy' as const }, { role: 'paste' as const }, { role: 'selectAll' as const }] },
    { label: 'View', submenu: [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }, { type: 'separator' as const }, { role: 'resetZoom' as const }, { role: 'zoomIn' as const }, { role: 'zoomOut' as const }, { type: 'separator' as const }, { role: 'togglefullscreen' as const }] },
    { label: 'Window', submenu: [{ role: 'minimize' as const }, { role: 'close' as const }] },
    ...(isMac ? [] : [{ label: 'Help', submenu: [{ label: 'About AI Office Front Desk', click: () => app.showAboutPanel() }] }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildApplicationMenu();
  openStores();

  ipcMain.handle('profile:read', () => profiles.read());
  ipcMain.handle('profile:update', (_event, patch) => profiles.save({ ...profiles.read(), ...patch }));
  ipcMain.handle('profile:update-design', (_event, patch) => profiles.updateDesign(patch));
  ipcMain.handle('catalog:list', () => connectorCatalog);
  ipcMain.handle('security:available', () => safeStorage.isEncryptionAvailable());
  ipcMain.handle('settings:get-launch-at-login', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('settings:set-launch-at-login', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return app.getLoginItemSettings().openAtLogin;
  });
  // Strict: only the fixed, curated setup/official-guide links baked into the catalog.
  ipcMain.handle('external:open', (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !allowedExternalUrls.has(url.toString())) throw new Error('This external link is not approved for this installation.');
    return shell.openExternal(url.toString());
  });
  // Looser: a ticket/file/feed-item link that came back from a connector the installer set up themselves.
  // There's no fixed allowlist for these — only the https: protocol is enforced, blocking file:/javascript:/custom schemes.
  ipcMain.handle('external:open-content-link', (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') throw new Error('Only secure (https) links can be opened.');
    return shell.openExternal(url.toString());
  });

  // Quick Launch's 'app' and 'chrome-profile' kinds — installer-configured (typed in via Settings,
  // not attacker-controlled), but still passed as argv array elements (never a shell string) so
  // nothing in a name/URL/profile value is ever interpreted as a shell command.
  ipcMain.handle('quicklaunch:list-chrome-profiles', () => listChromeProfiles());
  ipcMain.handle('quicklaunch:open-app', async (_event, appName: string) => {
    if (process.platform !== 'darwin') throw new Error('Launching a local app is only supported on macOS right now.');
    const trimmed = appName.trim();
    if (!trimmed) throw new Error('No app name given.');
    await execFileAsync('open', ['-a', trimmed]);
  });
  ipcMain.handle('quicklaunch:open-chrome-profile', async (_event, input: { url: string; profileDirectory: string }) => {
    if (process.platform !== 'darwin') throw new Error('Opening a specific Chrome profile is only supported on macOS right now.');
    const url = new URL(input.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http/https links can be opened.');
    const profileDirectory = input.profileDirectory.trim();
    if (!profileDirectory) throw new Error('No Chrome profile given.');
    await execFileAsync('open', ['-a', 'Google Chrome', '--args', `--profile-directory=${profileDirectory}`, url.toString()]);
  });

  ipcMain.handle('connector:jira:state', () => connectorStates.read('jira', defaultJiraState));
  ipcMain.handle('connector:jira:test', async (_event, input: JiraConnectInput) => testJiraConnection(input));
  ipcMain.handle('connector:jira:connect', async (_event, input: JiraConnectInput) => {
    const result = await testJiraConnection(input);
    if (!result.ok) {
      connectorStates.write('jira', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', tickets: [] }, null);
      return connectorStates.read('jira', defaultJiraState);
    }
    const secretRef = secrets.store(input.apiToken);
    connectorStates.write('jira', { status: 'connected', config: { siteUrl: input.siteUrl, email: input.email, jql: input.jql }, lastSyncedAt: null, lastError: null, tickets: [] }, secretRef);
    return syncJiraNow(input);
  });
  ipcMain.handle('connector:jira:sync', async () => {
    const state = connectorStates.read('jira', defaultJiraState);
    const secretRef = connectorStates.readSecretRef('jira');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const apiToken = secrets.read(secretRef);
    if (!apiToken) return state;
    return syncJiraNow({ siteUrl: state.config.siteUrl, email: state.config.email, apiToken, jql: state.config.jql });
  });
  ipcMain.handle('connector:jira:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('jira');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('jira');
    return connectorStates.read('jira', defaultJiraState);
  });

  ipcMain.handle('connector:github:state', () => connectorStates.read('github', defaultGitHubState));
  ipcMain.handle('connector:github:test', async (_event, input: GitHubConnectInput) => testGitHubConnection(input.token, parseRepoList(input.repos)));
  ipcMain.handle('connector:github:connect', async (_event, input: GitHubConnectInput) => {
    const repos = parseRepoList(input.repos);
    const result = await testGitHubConnection(input.token, repos);
    if (!result.ok || !result.value) {
      connectorStates.write('github', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', items: [] }, null);
      return connectorStates.read('github', defaultGitHubState);
    }
    const secretRef = secrets.store(input.token);
    connectorStates.write('github', { status: 'connected', config: { login: result.value.login, repos }, lastSyncedAt: null, lastError: null, items: [] }, secretRef);
    return syncGitHubNow(result.value.login, repos, input.token);
  });
  ipcMain.handle('connector:github:sync', async () => {
    const state = connectorStates.read('github', defaultGitHubState);
    const secretRef = connectorStates.readSecretRef('github');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const token = secrets.read(secretRef);
    if (!token) return state;
    return syncGitHubNow(state.config.login, state.config.repos, token);
  });
  ipcMain.handle('connector:github:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('github');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('github');
    return connectorStates.read('github', defaultGitHubState);
  });

  ipcMain.handle('connector:slack:state', () => connectorStates.read('slack', defaultSlackState));
  ipcMain.handle('connector:slack:test', async (_event, input: SlackConnectInput) => testSlackConnection(input.token, parseChannelList(input.channels)));
  ipcMain.handle('connector:slack:connect', async (_event, input: SlackConnectInput) => {
    const channels = parseChannelList(input.channels);
    const result = await testSlackConnection(input.token, channels);
    if (!result.ok || !result.value) {
      connectorStates.write('slack', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', items: [] }, null);
      return connectorStates.read('slack', defaultSlackState);
    }
    const secretRef = secrets.store(input.token);
    connectorStates.write('slack', { status: 'connected', config: { team: result.value.team, channels }, lastSyncedAt: null, lastError: null, items: [] }, secretRef);
    return syncSlackNow(result.value.team, channels, input.token);
  });
  ipcMain.handle('connector:slack:sync', async () => {
    const state = connectorStates.read('slack', defaultSlackState);
    const secretRef = connectorStates.readSecretRef('slack');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const token = secrets.read(secretRef);
    if (!token) return state;
    return syncSlackNow(state.config.team, state.config.channels, token);
  });
  ipcMain.handle('connector:slack:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('slack');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('slack');
    return connectorStates.read('slack', defaultSlackState);
  });

  ipcMain.handle('connector:teams:state', () => connectorStates.read('teams', defaultTeamsState));
  ipcMain.handle('connector:teams:connect', async (_event, input: TeamsConnectInput) => {
    const result = await connectTeams(input);
    if (!result.ok || !result.value) {
      connectorStates.write('teams', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', items: [] }, null);
      return connectorStates.read('teams', defaultTeamsState);
    }
    const secretRef = secrets.store(result.value.refreshToken);
    connectorStates.write('teams', { status: 'connected', config: { clientId: input.clientId, tenant: input.tenant }, lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value.items }, secretRef);
    return connectorStates.read('teams', defaultTeamsState);
  });
  ipcMain.handle('connector:teams:sync', async () => {
    const state = connectorStates.read('teams', defaultTeamsState);
    const secretRef = connectorStates.readSecretRef('teams');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const refreshToken = secrets.read(secretRef);
    if (!refreshToken) return state;
    const result = await syncTeams({ clientId: state.config.clientId, tenant: state.config.tenant }, refreshToken);
    if (!result.ok || !result.value) {
      connectorStates.write('teams', { ...state, status: 'error', lastError: result.error ?? 'Sync failed.' }, secretRef);
    } else {
      connectorStates.write('teams', { ...state, status: 'connected', lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value }, secretRef);
    }
    return connectorStates.read('teams', defaultTeamsState);
  });
  ipcMain.handle('connector:teams:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('teams');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('teams');
    return connectorStates.read('teams', defaultTeamsState);
  });

  ipcMain.handle('connector:notion:state', () => connectorStates.read('notion', defaultNotionState));
  ipcMain.handle('connector:notion:test', async (_event, input: NotionConnectInput) => testNotionConnection(input.token));
  ipcMain.handle('connector:notion:connect', async (_event, input: NotionConnectInput) => {
    const result = await testNotionConnection(input.token);
    if (!result.ok || !result.value) {
      connectorStates.write('notion', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', items: [] }, null);
      return connectorStates.read('notion', defaultNotionState);
    }
    const secretRef = secrets.store(input.token);
    connectorStates.write('notion', { status: 'connected', config: { workspace: result.value.workspace }, lastSyncedAt: null, lastError: null, items: [] }, secretRef);
    return syncNotionNow(result.value.workspace, input.token);
  });
  ipcMain.handle('connector:notion:sync', async () => {
    const state = connectorStates.read('notion', defaultNotionState);
    const secretRef = connectorStates.readSecretRef('notion');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const token = secrets.read(secretRef);
    if (!token) return state;
    return syncNotionNow(state.config.workspace, token);
  });
  ipcMain.handle('connector:notion:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('notion');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('notion');
    return connectorStates.read('notion', defaultNotionState);
  });

  ipcMain.handle('connector:linear:state', () => connectorStates.read('linear', defaultLinearState));
  ipcMain.handle('connector:linear:test', async (_event, input: LinearConnectInput) => testLinearConnection(input.token));
  ipcMain.handle('connector:linear:connect', async (_event, input: LinearConnectInput) => {
    const result = await testLinearConnection(input.token);
    if (!result.ok || !result.value) {
      connectorStates.write('linear', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', items: [] }, null);
      return connectorStates.read('linear', defaultLinearState);
    }
    const secretRef = secrets.store(input.token);
    connectorStates.write('linear', { status: 'connected', config: { name: result.value.name }, lastSyncedAt: null, lastError: null, items: [] }, secretRef);
    return syncLinearNow(result.value.name, input.token);
  });
  ipcMain.handle('connector:linear:sync', async () => {
    const state = connectorStates.read('linear', defaultLinearState);
    const secretRef = connectorStates.readSecretRef('linear');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const token = secrets.read(secretRef);
    if (!token) return state;
    return syncLinearNow(state.config.name, token);
  });
  ipcMain.handle('connector:linear:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('linear');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('linear');
    return connectorStates.read('linear', defaultLinearState);
  });

  ipcMain.handle('connector:google:state', () => connectorStates.read('google', defaultGoogleState));
  ipcMain.handle('connector:google:connect', async (_event, input: GoogleConnectInput) => {
    const result = await connectGoogle(input);
    if (!result.ok || !result.value) {
      connectorStates.write('google', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', inboxUnread: null, driveRecentFiles: [] }, null);
      return connectorStates.read('google', defaultGoogleState);
    }
    const secretRef = secrets.store(JSON.stringify({ refreshToken: result.value.refreshToken, clientSecret: input.clientSecret }));
    connectorStates.write('google', { status: 'connected', config: { clientId: input.clientId }, lastSyncedAt: new Date().toISOString(), lastError: null, inboxUnread: result.value.inboxUnread, driveRecentFiles: result.value.driveRecentFiles }, secretRef);
    return connectorStates.read('google', defaultGoogleState);
  });
  ipcMain.handle('connector:google:sync', async () => {
    const state = connectorStates.read('google', defaultGoogleState);
    const secretRef = connectorStates.readSecretRef('google');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const stored = secrets.read(secretRef);
    if (!stored) return state;
    const { refreshToken, clientSecret } = JSON.parse(stored) as { refreshToken: string; clientSecret: string };
    const result = await syncGoogle({ clientId: state.config.clientId, clientSecret }, refreshToken);
    if (!result.ok || !result.value) {
      connectorStates.write('google', { ...state, status: 'error', lastError: result.error ?? 'Sync failed.' }, secretRef);
    } else {
      connectorStates.write('google', { ...state, status: 'connected', lastSyncedAt: new Date().toISOString(), lastError: null, inboxUnread: result.value.inboxUnread, driveRecentFiles: result.value.driveRecentFiles }, secretRef);
    }
    return connectorStates.read('google', defaultGoogleState);
  });
  ipcMain.handle('connector:google:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('google');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('google');
    return connectorStates.read('google', defaultGoogleState);
  });

  ipcMain.handle('connector:outlook:state', () => connectorStates.read('outlook', defaultOutlookState));
  ipcMain.handle('connector:outlook:connect', async (_event, input: OutlookConnectInput) => {
    const result = await connectOutlook(input);
    if (!result.ok || !result.value) {
      connectorStates.write('outlook', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', inboxUnread: null, recentMessages: [] }, null);
      return connectorStates.read('outlook', defaultOutlookState);
    }
    const secretRef = secrets.store(result.value.refreshToken);
    connectorStates.write('outlook', { status: 'connected', config: { clientId: input.clientId, tenant: input.tenant }, lastSyncedAt: new Date().toISOString(), lastError: null, inboxUnread: result.value.inboxUnread, recentMessages: result.value.recentMessages }, secretRef);
    return connectorStates.read('outlook', defaultOutlookState);
  });
  ipcMain.handle('connector:outlook:sync', async () => {
    const state = connectorStates.read('outlook', defaultOutlookState);
    const secretRef = connectorStates.readSecretRef('outlook');
    if (state.status !== 'connected' || !state.config || !secretRef) return state;
    const refreshToken = secrets.read(secretRef);
    if (!refreshToken) return state;
    const result = await syncOutlook({ clientId: state.config.clientId, tenant: state.config.tenant }, refreshToken);
    if (!result.ok || !result.value) {
      connectorStates.write('outlook', { ...state, status: 'error', lastError: result.error ?? 'Sync failed.' }, secretRef);
    } else {
      connectorStates.write('outlook', { ...state, status: 'connected', lastSyncedAt: new Date().toISOString(), lastError: null, inboxUnread: result.value.inboxUnread, recentMessages: result.value.recentMessages }, secretRef);
    }
    return connectorStates.read('outlook', defaultOutlookState);
  });
  ipcMain.handle('connector:outlook:disconnect', () => {
    const secretRef = connectorStates.readSecretRef('outlook');
    if (secretRef) secrets.delete(secretRef);
    connectorStates.clear('outlook');
    return connectorStates.read('outlook', defaultOutlookState);
  });

  ipcMain.handle('connector:weather:state', () => connectorStates.read('weather', defaultWeatherState));
  ipcMain.handle('connector:weather:connect', async (_event, input: WeatherConnectInput) => {
    const result = await connectWeather(input);
    if (!result.ok || !result.value) {
      connectorStates.write('weather', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', resolvedLocation: null, temperatureC: null, conditions: null }, null);
      return connectorStates.read('weather', defaultWeatherState);
    }
    connectorStates.write('weather', {
      status: 'connected', config: { location: input.location, latitude: result.value.latitude, longitude: result.value.longitude },
      lastSyncedAt: new Date().toISOString(), lastError: null,
      resolvedLocation: result.value.resolvedLocation, temperatureC: result.value.temperatureC, conditions: result.value.conditions
    }, null);
    return connectorStates.read('weather', defaultWeatherState);
  });
  ipcMain.handle('connector:weather:sync', async () => {
    const state = connectorStates.read('weather', defaultWeatherState);
    if (state.status !== 'connected' || !state.config) return state;
    const result = await syncWeather(state.config.latitude, state.config.longitude);
    if (!result.ok || !result.value) {
      connectorStates.write('weather', { ...state, status: 'error', lastError: result.error ?? 'Sync failed.' }, null);
    } else {
      connectorStates.write('weather', { ...state, status: 'connected', lastSyncedAt: new Date().toISOString(), lastError: null, temperatureC: result.value.temperatureC, conditions: result.value.conditions }, null);
    }
    return connectorStates.read('weather', defaultWeatherState);
  });
  ipcMain.handle('connector:weather:disconnect', () => {
    connectorStates.clear('weather');
    return connectorStates.read('weather', defaultWeatherState);
  });

  ipcMain.handle('connector:rss:state', () => connectorStates.read('rss', defaultRssState));
  ipcMain.handle('connector:rss:connect', async (_event, input: RssConnectInput) => {
    const result = await connectRss(input);
    if (!result.ok || !result.value) {
      connectorStates.write('rss', { status: 'error', config: null, lastSyncedAt: null, lastError: result.error ?? 'Connection failed.', feedTitle: null, items: [] }, null);
      return connectorStates.read('rss', defaultRssState);
    }
    connectorStates.write('rss', { status: 'connected', config: { feedUrl: input.feedUrl }, lastSyncedAt: new Date().toISOString(), lastError: null, feedTitle: result.value.feedTitle, items: result.value.items }, null);
    return connectorStates.read('rss', defaultRssState);
  });
  ipcMain.handle('connector:rss:sync', async () => {
    const state = connectorStates.read('rss', defaultRssState);
    if (state.status !== 'connected' || !state.config) return state;
    const result = await syncRss(state.config.feedUrl);
    if (!result.ok || !result.value) {
      connectorStates.write('rss', { ...state, status: 'error', lastError: result.error ?? 'Sync failed.' }, null);
    } else {
      connectorStates.write('rss', { ...state, status: 'connected', lastSyncedAt: new Date().toISOString(), lastError: null, feedTitle: result.value.feedTitle, items: result.value.items }, null);
    }
    return connectorStates.read('rss', defaultRssState);
  });
  ipcMain.handle('connector:rss:disconnect', () => {
    connectorStates.clear('rss');
    return connectorStates.read('rss', defaultRssState);
  });

  ipcMain.handle('diagnostics:export', async () => {
    const jira = connectorStates.read('jira', defaultJiraState);
    const google = connectorStates.read('google', defaultGoogleState);
    const outlook = connectorStates.read('outlook', defaultOutlookState);
    const weather = connectorStates.read('weather', defaultWeatherState);
    const rss = connectorStates.read('rss', defaultRssState);
    const github = connectorStates.read('github', defaultGitHubState);
    const slack = connectorStates.read('slack', defaultSlackState);
    const teams = connectorStates.read('teams', defaultTeamsState);
    const notion = connectorStates.read('notion', defaultNotionState);
    const linear = connectorStates.read('linear', defaultLinearState);
    const redacted = {
      exportedAt: new Date().toISOString(),
      connectors: [
        { id: 'jira', status: jira.status, lastSyncedAt: jira.lastSyncedAt, lastError: jira.lastError, ticketCount: jira.tickets.length },
        { id: 'google', status: google.status, lastSyncedAt: google.lastSyncedAt, lastError: google.lastError },
        { id: 'outlook', status: outlook.status, lastSyncedAt: outlook.lastSyncedAt, lastError: outlook.lastError },
        { id: 'weather', status: weather.status, lastSyncedAt: weather.lastSyncedAt, lastError: weather.lastError },
        { id: 'rss', status: rss.status, lastSyncedAt: rss.lastSyncedAt, lastError: rss.lastError, itemCount: rss.items.length },
        { id: 'github', status: github.status, lastSyncedAt: github.lastSyncedAt, lastError: github.lastError, itemCount: github.items.length },
        { id: 'slack', status: slack.status, lastSyncedAt: slack.lastSyncedAt, lastError: slack.lastError, itemCount: slack.items.length },
        { id: 'teams', status: teams.status, lastSyncedAt: teams.lastSyncedAt, lastError: teams.lastError, itemCount: teams.items.length },
        { id: 'notion', status: notion.status, lastSyncedAt: notion.lastSyncedAt, lastError: notion.lastError, itemCount: notion.items.length },
        { id: 'linear', status: linear.status, lastSyncedAt: linear.lastSyncedAt, lastError: linear.lastError, itemCount: linear.items.length }
      ]
    };
    const target = await dialog.showSaveDialog({ defaultPath: 'front-desk-diagnostics.json' });
    if (target.canceled || !target.filePath) return { saved: false };
    fs.writeFileSync(target.filePath, JSON.stringify(redacted, null, 2));
    return { saved: true, path: target.filePath };
  });

  // Layout-only export/import: card visibility, order, columns, appearance — never provider
  // account ids, secrets, absolute paths, or any cached display content (tickets, files, notes).
  ipcMain.handle('layout:export', async () => {
    const payload = { version: 1, design: profiles.read().design };
    const target = await dialog.showSaveDialog({ defaultPath: 'front-desk-layout.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (target.canceled || !target.filePath) return { saved: false };
    fs.writeFileSync(target.filePath, JSON.stringify(payload, null, 2));
    return { saved: true, path: target.filePath };
  });
  ipcMain.handle('layout:import', async () => {
    const picked = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (picked.canceled || !picked.filePaths[0]) return { imported: false };
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8'));
      if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
        return { imported: false, error: 'That file is not a recognized Front Desk layout export.' };
      }
      const design = sanitizeDesign((parsed as { design?: unknown }).design);
      const profile = profiles.updateDesign(design);
      return { imported: true, profile };
    } catch {
      return { imported: false, error: 'That file could not be read as a layout export.' };
    }
  });

  ipcMain.handle('profile:delete-all', () => {
    closeStores();
    for (const filePath of Object.values(userDataPaths())) {
      for (const suffix of ['', '-shm', '-wal']) { try { fs.unlinkSync(filePath + suffix); } catch { /* file may not exist */ } }
    }
    openStores();
    return profiles.read();
  });

  void createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});

async function syncJiraNow(input: JiraConnectInput) {
  const result = await syncJiraTickets(input);
  const secretRef = connectorStates.readSecretRef('jira');
  if (!result.ok) {
    connectorStates.write('jira', { status: 'error', config: { siteUrl: input.siteUrl, email: input.email, jql: input.jql }, lastSyncedAt: null, lastError: result.error ?? 'Sync failed.', tickets: [] }, secretRef);
  } else {
    connectorStates.write('jira', { status: 'connected', config: { siteUrl: input.siteUrl, email: input.email, jql: input.jql }, lastSyncedAt: new Date().toISOString(), lastError: null, tickets: result.value ?? [] }, secretRef);
  }
  return connectorStates.read('jira', defaultJiraState);
}

async function syncGitHubNow(login: string, repos: string[], token: string) {
  const result = await syncGitHubItems(repos, token);
  const secretRef = connectorStates.readSecretRef('github');
  if (!result.ok) {
    connectorStates.write('github', { status: 'error', config: { login, repos }, lastSyncedAt: null, lastError: result.error ?? 'Sync failed.', items: [] }, secretRef);
  } else {
    connectorStates.write('github', { status: 'connected', config: { login, repos }, lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value ?? [] }, secretRef);
  }
  return connectorStates.read('github', defaultGitHubState);
}

async function syncSlackNow(team: string, channels: string[], token: string) {
  const result = await syncSlackItems(channels, token);
  const secretRef = connectorStates.readSecretRef('slack');
  if (!result.ok) {
    connectorStates.write('slack', { status: 'error', config: { team, channels }, lastSyncedAt: null, lastError: result.error ?? 'Sync failed.', items: [] }, secretRef);
  } else {
    connectorStates.write('slack', { status: 'connected', config: { team, channels }, lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value ?? [] }, secretRef);
  }
  return connectorStates.read('slack', defaultSlackState);
}

async function syncNotionNow(workspace: string, token: string) {
  const result = await syncNotionItems(token);
  const secretRef = connectorStates.readSecretRef('notion');
  if (!result.ok) {
    connectorStates.write('notion', { status: 'error', config: { workspace }, lastSyncedAt: null, lastError: result.error ?? 'Sync failed.', items: [] }, secretRef);
  } else {
    connectorStates.write('notion', { status: 'connected', config: { workspace }, lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value ?? [] }, secretRef);
  }
  return connectorStates.read('notion', defaultNotionState);
}

async function syncLinearNow(name: string, token: string) {
  const result = await syncLinearItems(token);
  const secretRef = connectorStates.readSecretRef('linear');
  if (!result.ok) {
    connectorStates.write('linear', { status: 'error', config: { name }, lastSyncedAt: null, lastError: result.error ?? 'Sync failed.', items: [] }, secretRef);
  } else {
    connectorStates.write('linear', { status: 'connected', config: { name }, lastSyncedAt: new Date().toISOString(), lastError: null, items: result.value ?? [] }, secretRef);
  }
  return connectorStates.read('linear', defaultLinearState);
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { dashboardServer?.kill(); closeStores(); });
