import { useEffect, useState } from 'react';
import type { ConnectorManifest, ConnectorState, DeskProfile, GoogleState, OutlookState, RoutineItem, AffirmationItem, QuickLaunchItem, WeatherState, RssState } from '../shared/contracts';
import { defaultJiraState, defaultGoogleState, defaultOutlookState, defaultWeatherState, defaultRssState } from '../shared/contracts';
import { Wizard } from './Wizard';
import { Dashboard } from './Dashboard';
import { Settings } from './Settings';

export function App() {
  const [profile, setProfile] = useState<DeskProfile | null>(null);
  const [catalog, setCatalog] = useState<ConnectorManifest[]>([]);
  const [jira, setJira] = useState<ConnectorState>(defaultJiraState);
  const [google, setGoogle] = useState<GoogleState>(defaultGoogleState);
  const [outlook, setOutlook] = useState<OutlookState>(defaultOutlookState);
  const [weather, setWeather] = useState<WeatherState>(defaultWeatherState);
  const [rss, setRss] = useState<RssState>(defaultRssState);
  const [secure, setSecure] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // isSecureStorageAvailable() can be held up by a macOS Keychain permission prompt (especially on an
    // ad-hoc/unsigned build, which gets re-prompted on every relaunch) — it must never gate the first render.
    void Promise.all([
      window.frontDesk.readProfile(), window.frontDesk.listCatalog(),
      window.frontDesk.jira.state(), window.frontDesk.google.state(), window.frontDesk.outlook.state(),
      window.frontDesk.weather.state(), window.frontDesk.rss.state()
    ]).then(([savedProfile, services, jiraState, googleState, outlookState, weatherState, rssState]) => {
      setProfile(savedProfile); setCatalog(services); setJira(jiraState); setGoogle(googleState); setOutlook(outlookState);
      setWeather(weatherState); setRss(rssState);
    });
    window.frontDesk.isSecureStorageAvailable().then(setSecure).catch(() => setSecure(false));
  }, []);

  if (!profile) return <main className="loading">Opening your private desk…</main>;
  const currentProfile = profile;

  async function updateProfile(patch: Partial<DeskProfile>) { setProfile(await window.frontDesk.updateProfile(patch)); }
  async function updateDesign(patch: Partial<DeskProfile['design']>) { setProfile(await window.frontDesk.updateDesign(patch)); }
  async function syncJira() { setJira(await window.frontDesk.jira.sync()); }
  async function disconnectJira() { setJira(await window.frontDesk.jira.disconnect()); }
  async function syncGoogle() { setGoogle(await window.frontDesk.google.sync()); }
  async function disconnectGoogle() { setGoogle(await window.frontDesk.google.disconnect()); }
  async function syncOutlook() { setOutlook(await window.frontDesk.outlook.sync()); }
  async function disconnectOutlook() { setOutlook(await window.frontDesk.outlook.disconnect()); }
  async function syncWeather() { setWeather(await window.frontDesk.weather.sync()); }
  async function disconnectWeather() { setWeather(await window.frontDesk.weather.disconnect()); }
  async function syncRss() { setRss(await window.frontDesk.rss.sync()); }
  async function disconnectRss() { setRss(await window.frontDesk.rss.disconnect()); }
  async function deleteAllData() {
    setProfile(await window.frontDesk.deleteAllData());
    setJira(defaultJiraState); setGoogle(defaultGoogleState); setOutlook(defaultOutlookState);
    setWeather(defaultWeatherState); setRss(defaultRssState);
    setShowSettings(false);
  }
  function dismissNotice(id: string) { void updateProfile({ dismissedNotices: [...currentProfile.dismissedNotices, id] }); }
  function updateFocusText(focusText: string) { void updateProfile({ focusText }); }
  function updateProjectItems(projectItems: RoutineItem[]) { void updateProfile({ projectItems }); }
  function updateNoteItems(noteItems: RoutineItem[]) { void updateProfile({ noteItems }); }
  function updateRoutines(routines: RoutineItem[]) { void updateProfile({ routines }); }
  function updateAffirmations(affirmations: AffirmationItem[]) { void updateProfile({ affirmations }); }
  function updateQuickLaunch(quickLaunch: QuickLaunchItem[]) { void updateProfile({ quickLaunch }); }
  async function importLayout() {
    const result = await window.frontDesk.importLayout();
    if (result.imported && result.profile) setProfile(result.profile);
    return result;
  }
  async function syncAllConnected() {
    await Promise.all([
      jira.status === 'connected' ? syncJira() : Promise.resolve(),
      google.status === 'connected' ? syncGoogle() : Promise.resolve(),
      outlook.status === 'connected' ? syncOutlook() : Promise.resolve(),
      weather.status === 'connected' ? syncWeather() : Promise.resolve(),
      rss.status === 'connected' ? syncRss() : Promise.resolve()
    ]);
  }

  if (!profile.onboardingComplete) {
    return <main className={`desk accent-${profile.design.accent} density-${profile.design.density}`}>
      <Wizard profile={profile} catalog={catalog} jira={jira} google={google} outlook={outlook} onUpdateProfile={updateProfile} onUpdateDesign={updateDesign} onFinish={() => updateProfile({ onboardingComplete: true })} onDismissNotice={dismissNotice}/>
    </main>;
  }

  return <main className={`desk accent-${profile.design.accent} density-${profile.design.density}`}>
    <header className="topbar"><div className="utility"><span>AI OFFICE FRONT DESK</span><span>LOCAL ONLY</span><span>READ-ONLY CONNECTIONS</span></div>
      <div className="headline"><div><p>YOUR PRIVATE WORKSPACE</p><h1>{profile.deskName || 'My Front Desk'}</h1><small>{profile.firstName ? `Welcome back, ${profile.firstName}.` : 'Set up your desk to get started.'}</small></div>
        <div className="security"><i className={secure ? 'good' : 'warning'} />{secure ? 'Secure storage available' : 'Secure storage needs attention'}</div>
      </div>
    </header>
    <Dashboard profile={profile} jira={jira} google={google} outlook={outlook} weather={weather} rss={rss}
      onSyncJira={syncJira} onDisconnectJira={disconnectJira}
      onSyncGoogle={syncGoogle} onDisconnectGoogle={disconnectGoogle}
      onSyncOutlook={syncOutlook} onDisconnectOutlook={disconnectOutlook}
      onSyncWeather={syncWeather} onDisconnectWeather={disconnectWeather}
      onSyncRss={syncRss} onDisconnectRss={disconnectRss}
      onOpenSettings={() => setShowSettings(true)} onUpdateDesign={updateDesign}
      onUpdateFocusText={updateFocusText} onUpdateProjectItems={updateProjectItems} onUpdateNoteItems={updateNoteItems}
      onUpdateRoutines={updateRoutines} onUpdateAffirmations={updateAffirmations} onUpdateQuickLaunch={updateQuickLaunch}/>
    {showSettings && <Settings profile={profile} catalog={catalog} jira={jira} google={google} outlook={outlook} weather={weather} rss={rss} onUpdateDesign={updateDesign}
      onReopenWizard={() => updateProfile({ onboardingComplete: false })}
      onDisconnectJira={disconnectJira} onDisconnectGoogle={disconnectGoogle} onDisconnectOutlook={disconnectOutlook}
      onDisconnectWeather={disconnectWeather} onDisconnectRss={disconnectRss}
      onImportLayout={importLayout} onDismissNotice={dismissNotice} onSyncAll={syncAllConnected}
      onDeleteAll={deleteAllData} onClose={() => setShowSettings(false)}/>}
  </main>;
}
