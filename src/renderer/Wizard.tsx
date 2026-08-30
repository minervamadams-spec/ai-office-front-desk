import { useState } from 'react';
import type { ConnectorManifest, ConnectorState, DeskProfile, GoogleState, OutlookState, GitHubState } from '../shared/contracts';
import { LayoutEditor } from './LayoutEditor';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';

function ProfileFields({ profile, onUpdateProfile }: { profile: DeskProfile; onUpdateProfile: (patch: Partial<DeskProfile>) => Promise<void> }) {
  const [local, setLocal] = useState({ deskName: profile.deskName, firstName: profile.firstName, timezone: profile.timezone });
  return <>
    <label>Desk name<input value={local.deskName} onChange={(e) => setLocal({ ...local, deskName: e.target.value })} onBlur={() => void onUpdateProfile({ deskName: local.deskName })}/></label>
    <label>Your first name (optional)<input value={local.firstName} onChange={(e) => setLocal({ ...local, firstName: e.target.value })} onBlur={() => void onUpdateProfile({ firstName: local.firstName })}/></label>
    <label>Timezone<input value={local.timezone} onChange={(e) => setLocal({ ...local, timezone: e.target.value })} onBlur={() => void onUpdateProfile({ timezone: local.timezone })}/></label>
  </>;
}

export function Wizard({ profile, catalog, jira, google, outlook, github, onUpdateProfile, onUpdateDesign, onFinish, onDismissNotice }: {
  profile: DeskProfile;
  catalog: ConnectorManifest[];
  jira: ConnectorState;
  google: GoogleState;
  outlook: OutlookState;
  github: GitHubState;
  onUpdateProfile: (patch: Partial<DeskProfile>) => Promise<void>;
  onUpdateDesign: (patch: Partial<DeskProfile['design']>) => Promise<void>;
  onFinish: () => Promise<void>;
  onDismissNotice: (id: string) => void;
}) {
  const [step, setStep] = useState(Math.min(profile.wizardStep, 4));

  async function go(next: number) { setStep(next); await onUpdateProfile({ wizardStep: next }); }
  async function exploreSample() { await onUpdateProfile({ useSampleData: true, onboardingComplete: true, wizardStep: 0 }); await onFinish(); }

  return <main className="wizard">
    <div className="wizard-steps">{['Welcome', 'Profile', 'Connections', 'Layout', 'Finish'].map((label, i) => <span key={label} className={i === step ? 'current' : i < step ? 'done' : ''}>{label}</span>)}</div>
    <section className="wizard-panel">
      {step === 0 && <>
        <p className="eyebrow">WELCOME</p>
        <h2>Your dashboard lives on this computer. You choose what to connect.</h2>
        <p>No account with us is required. Explore with example content, or start setup with your own connections.</p>
        <div className="actions"><button className="primary" onClick={() => void go(1)}>Start setup</button><button onClick={() => void exploreSample()}>Explore with examples</button></div>
      </>}
      {step === 1 && <>
        <p className="eyebrow">PROFILE</p>
        <h2>What should we call your desk?</h2>
        <ProfileFields profile={profile} onUpdateProfile={onUpdateProfile}/>
        <div className="actions"><button onClick={() => void go(0)}>Back</button><button className="primary" onClick={() => void go(2)}>Next</button></div>
      </>}
      {step === 2 && <>
        <p className="eyebrow">CONNECTIONS</p>
        <h2>Connect only what you use.</h2>
        <ServiceCatalogGrid catalog={catalog} jira={jira} google={google} outlook={outlook} github={github} dismissedNotices={profile.dismissedNotices} onDismissNotice={onDismissNotice} showSearch={false}/>
        <div className="actions"><button onClick={() => void go(1)}>Back</button><button className="primary" onClick={() => void go(3)}>Next</button><button onClick={() => void go(3)}>Skip for now</button></div>
      </>}
      {step === 3 && <>
        <p className="eyebrow">ARRANGE YOUR DESK</p>
        <h2>Pick your cards and how they're laid out.</h2>
        <LayoutEditor design={profile.design} onUpdateDesign={onUpdateDesign}/>
        <div className="actions"><button onClick={() => void go(2)}>Back</button><button className="primary" onClick={() => void go(4)}>Next</button></div>
      </>}
      {step === 4 && <>
        <p className="eyebrow">FINISH</p>
        <h2>Your desk is ready.</h2>
        <p>{profile.useSampleData ? 'Example content is on — clear it any time from Settings.' : 'You can add connections any time from Settings.'}</p>
        <div className="actions"><button onClick={() => void go(3)}>Back</button><button className="primary" onClick={() => void onFinish()}>Go to my Front Desk</button></div>
      </>}
    </section>
  </main>;
}
