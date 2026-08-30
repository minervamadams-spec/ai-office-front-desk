import { useEffect, useState } from 'react';
import type { ChromeProfileInfo, QuickLaunchItem, QuickLaunchKind } from '../shared/contracts';
import { sampleQuickLaunch } from '../shared/contracts';

function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

async function launchItem(item: QuickLaunchItem, onError: (message: string) => void) {
  try {
    if (item.kind === 'link') await window.frontDesk.openContentLink(item.url);
    else if (item.kind === 'app') await window.frontDesk.launchApp(item.target);
    else await window.frontDesk.openInChromeProfile(item.url, item.target);
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Could not open that.');
  }
}

/** Fields for whichever kind is selected — shared by the add form and inline editing. */
function KindFields({ kind, label, url, target, onChange, chromeProfiles }: {
  kind: QuickLaunchKind; label: string; url: string; target: string;
  onChange: (patch: Partial<{ label: string; url: string; target: string }>) => void;
  chromeProfiles: ChromeProfileInfo[];
}) {
  return <>
    <input value={label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Name (e.g. Claude)" aria-label="Link name"/>
    {kind === 'link' && <input value={url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://..." aria-label="Link URL"/>}
    {kind === 'app' && <input value={target} onChange={(e) => onChange({ target: e.target.value })} placeholder="App name (e.g. Roblox)" aria-label="App name"/>}
    {kind === 'chrome-profile' && <>
      <input value={url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://..." aria-label="Link URL"/>
      <select value={target} onChange={(e) => onChange({ target: e.target.value })} aria-label="Chrome profile">
        <option value="">Choose a Chrome profile…</option>
        {chromeProfiles.map((p) => <option key={p.directory} value={p.directory}>{p.label}</option>)}
      </select>
    </>}
  </>;
}

function isValid(kind: QuickLaunchKind, label: string, url: string, target: string): boolean {
  if (!label.trim()) return false;
  if (kind === 'link') return isHttpUrl(url.trim());
  if (kind === 'app') return target.trim() !== '';
  return isHttpUrl(url.trim()) && target.trim() !== '';
}

function AddLaunchForm({ chromeProfiles, onAdd }: { chromeProfiles: ChromeProfileInfo[]; onAdd: (item: Omit<QuickLaunchItem, 'id'>) => void }) {
  const [kind, setKind] = useState<QuickLaunchKind>('link');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [target, setTarget] = useState('');
  const valid = isValid(kind, label, url, target);

  function submit() {
    if (!valid) return;
    onAdd({ kind, label: label.trim(), url: url.trim(), target: target.trim() });
    setLabel(''); setUrl(''); setTarget('');
  }

  return <div className="routine-add">
    <select value={kind} onChange={(e) => setKind(e.target.value as QuickLaunchKind)} aria-label="Quick launch type">
      <option value="link">Web link</option>
      <option value="app">Local app</option>
      <option value="chrome-profile">Link in a specific Chrome profile</option>
    </select>
    <KindFields kind={kind} label={label} url={url} target={target} chromeProfiles={chromeProfiles}
      onChange={(patch) => { if (patch.label !== undefined) setLabel(patch.label); if (patch.url !== undefined) setUrl(patch.url); if (patch.target !== undefined) setTarget(patch.target); }}/>
    <button className="primary" disabled={!valid} onClick={submit} onKeyDown={(e) => e.key === 'Enter' && submit()}>Add</button>
  </div>;
}

function LaunchRow({ item, chromeProfiles, onSave, onDelete }: {
  item: QuickLaunchItem; chromeProfiles: ChromeProfileInfo[]; onSave: (item: QuickLaunchItem) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);
  const [target, setTarget] = useState(item.target);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    const valid = isValid(item.kind, label, url, target);
    return <li className="routine-row editing">
      <KindFields kind={item.kind} label={label} url={url} target={target} chromeProfiles={chromeProfiles}
        onChange={(patch) => { if (patch.label !== undefined) setLabel(patch.label); if (patch.url !== undefined) setUrl(patch.url); if (patch.target !== undefined) setTarget(patch.target); }}/>
      <span>
        <button className="primary" disabled={!valid} onClick={() => { onSave({ ...item, label: label.trim(), url: url.trim(), target: target.trim() }); setEditing(false); }}>Save</button>
        <button onClick={() => { setLabel(item.label); setUrl(item.url); setTarget(item.target); setEditing(false); }}>Cancel</button>
      </span>
    </li>;
  }

  return <li className="routine-row">
    <div>
      <a className="quick-launch-link" onClick={() => void launchItem(item, setError)}>{item.label}</a>
      {error && <span className="form-status">{error}</span>}
    </div>
    <span><button onClick={() => setEditing(true)}>Edit</button><button onClick={onDelete}>Delete</button></span>
  </li>;
}

export function QuickLaunchCard({ links, useSampleData, onUpdateLinks }: {
  links: QuickLaunchItem[]; useSampleData: boolean; onUpdateLinks: (links: QuickLaunchItem[]) => void;
}) {
  const [chromeProfiles, setChromeProfiles] = useState<ChromeProfileInfo[]>([]);

  useEffect(() => { void window.frontDesk.listChromeProfiles().then(setChromeProfiles); }, []);

  function addLink(item: Omit<QuickLaunchItem, 'id'>) {
    onUpdateLinks([...links, { ...item, id: crypto.randomUUID() }]);
  }
  function saveLink(updated: QuickLaunchItem) {
    onUpdateLinks(links.map((l) => (l.id === updated.id ? updated : l)));
  }
  function deleteLink(id: string) {
    onUpdateLinks(links.filter((l) => l.id !== id));
  }

  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">QUICK LAUNCH</p><h2>Quick launch</h2></div></div>
    {links.length === 0 && useSampleData && <>
      <p className="intro sample-note">Suggestions — add your own below and these disappear.</p>
      <ul className="sample-list">{sampleQuickLaunch.map((item) => <li key={item.id}><a className="quick-launch-link" onClick={() => void window.frontDesk.openContentLink(item.url)}>{item.label}</a></li>)}</ul>
    </>}
    {links.length === 0 && !useSampleData && <p className="intro sample-note">No links yet.</p>}
    {links.length > 0 && <ul className="routine-list">{links.map((item) => <LaunchRow key={item.id} item={item} chromeProfiles={chromeProfiles} onSave={saveLink} onDelete={() => deleteLink(item.id)}/>)}</ul>}
    <AddLaunchForm chromeProfiles={chromeProfiles} onAdd={addLink}/>
  </section>;
}
