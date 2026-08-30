import { contextBridge, ipcRenderer } from 'electron';
import type {
  ConnectorState, ConnectorManifest, DeskDesign, DeskProfile, JiraConnectInput,
  GoogleState, GoogleConnectInput, OutlookState, OutlookConnectInput,
  WeatherState, WeatherConnectInput, RssState, RssConnectInput, ChromeProfileInfo
} from '../shared/contracts';
import type { AdapterResult } from '../main/adapters/jira-adapter';

const api = {
  readProfile: (): Promise<DeskProfile> => ipcRenderer.invoke('profile:read'),
  updateProfile: (patch: Partial<DeskProfile>): Promise<DeskProfile> => ipcRenderer.invoke('profile:update', patch),
  updateDesign: (patch: Partial<DeskDesign>): Promise<DeskProfile> => ipcRenderer.invoke('profile:update-design', patch),
  deleteAllData: (): Promise<DeskProfile> => ipcRenderer.invoke('profile:delete-all'),
  listCatalog: (): Promise<ConnectorManifest[]> => ipcRenderer.invoke('catalog:list'),
  isSecureStorageAvailable: (): Promise<boolean> => ipcRenderer.invoke('security:available'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('external:open', url),
  openContentLink: (url: string): Promise<void> => ipcRenderer.invoke('external:open-content-link', url),
  listChromeProfiles: (): Promise<ChromeProfileInfo[]> => ipcRenderer.invoke('quicklaunch:list-chrome-profiles'),
  launchApp: (appName: string): Promise<void> => ipcRenderer.invoke('quicklaunch:open-app', appName),
  openInChromeProfile: (url: string, profileDirectory: string): Promise<void> => ipcRenderer.invoke('quicklaunch:open-chrome-profile', { url, profileDirectory }),
  exportDiagnostics: (): Promise<{ saved: boolean; path?: string }> => ipcRenderer.invoke('diagnostics:export'),
  exportLayout: (): Promise<{ saved: boolean; path?: string }> => ipcRenderer.invoke('layout:export'),
  importLayout: (): Promise<{ imported: boolean; error?: string; profile?: DeskProfile }> => ipcRenderer.invoke('layout:import'),
  jira: {
    state: (): Promise<ConnectorState> => ipcRenderer.invoke('connector:jira:state'),
    test: (input: JiraConnectInput): Promise<AdapterResult<{ matchedCount: number }>> => ipcRenderer.invoke('connector:jira:test', input),
    connect: (input: JiraConnectInput): Promise<ConnectorState> => ipcRenderer.invoke('connector:jira:connect', input),
    sync: (): Promise<ConnectorState> => ipcRenderer.invoke('connector:jira:sync'),
    disconnect: (): Promise<ConnectorState> => ipcRenderer.invoke('connector:jira:disconnect')
  },
  google: {
    state: (): Promise<GoogleState> => ipcRenderer.invoke('connector:google:state'),
    connect: (input: GoogleConnectInput): Promise<GoogleState> => ipcRenderer.invoke('connector:google:connect', input),
    sync: (): Promise<GoogleState> => ipcRenderer.invoke('connector:google:sync'),
    disconnect: (): Promise<GoogleState> => ipcRenderer.invoke('connector:google:disconnect')
  },
  outlook: {
    state: (): Promise<OutlookState> => ipcRenderer.invoke('connector:outlook:state'),
    connect: (input: OutlookConnectInput): Promise<OutlookState> => ipcRenderer.invoke('connector:outlook:connect', input),
    sync: (): Promise<OutlookState> => ipcRenderer.invoke('connector:outlook:sync'),
    disconnect: (): Promise<OutlookState> => ipcRenderer.invoke('connector:outlook:disconnect')
  },
  weather: {
    state: (): Promise<WeatherState> => ipcRenderer.invoke('connector:weather:state'),
    connect: (input: WeatherConnectInput): Promise<WeatherState> => ipcRenderer.invoke('connector:weather:connect', input),
    sync: (): Promise<WeatherState> => ipcRenderer.invoke('connector:weather:sync'),
    disconnect: (): Promise<WeatherState> => ipcRenderer.invoke('connector:weather:disconnect')
  },
  rss: {
    state: (): Promise<RssState> => ipcRenderer.invoke('connector:rss:state'),
    connect: (input: RssConnectInput): Promise<RssState> => ipcRenderer.invoke('connector:rss:connect', input),
    sync: (): Promise<RssState> => ipcRenderer.invoke('connector:rss:sync'),
    disconnect: (): Promise<RssState> => ipcRenderer.invoke('connector:rss:disconnect')
  }
};

contextBridge.exposeInMainWorld('frontDesk', api);

declare global { interface Window { frontDesk: typeof api; } }
