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

/** A small colored glyph per item — generic shapes/symbols, never a real brand logo (trademark risk,
 * and this app's strict CSP only allows same-origin/data: images anyway, not fetched icon assets).
 * Keyword-matched for a few very common cases, falling back to the item's own initial. */
function iconFor(item: QuickLaunchItem): { glyph: string; color: string } {
  const label = item.label.toLowerCase();
  if (/claude|chatgpt|\bgpt\b|gemini|copilot|perplexity/.test(label)) return { glyph: '✨', color: '#6751a5' };
  if (/spotify|music|podcast/.test(label)) return { glyph: '♪', color: '#1db954' };
  if (/roblox|steam|minecraft|\bgame\b/.test(label)) return { glyph: '▶', color: '#5865f2' };
  if (item.kind === 'chrome-profile') return { glyph: '◐', color: '#4285f4' };
  if (item.kind === 'app') return { glyph: '▢', color: '#79828d' };
  return { glyph: item.label.trim().charAt(0).toUpperCase() || '#', color: '#1f5fa8' };
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

function LaunchChip({ item, chromeProfiles, onSave, onDelete }: {
  item: QuickLaunchItem; chromeProfiles: ChromeProfileInfo[]; onSave: (item: QuickLaunchItem) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);
  const [target, setTarget] = useState(item.target);
  const [error, setError] = useState<string | null>(null);
  const icon = iconFor(item);

  if (editing) {
    const valid = isValid(item.kind, label, url, target);
    return <div className="quick-launch-edit">
      <KindFields kind={item.kind} label={label} url={url} target={target} chromeProfiles={chromeProfiles}
        onChange={(patch) => { if (patch.label !== undefined) setLabel(patch.label); if (patch.url !== undefined) setUrl(patch.url); if (patch.target !== undefined) setTarget(patch.target); }}/>
      <span className="actions" style={{ marginTop: 0 }}>
        <button className="primary" disabled={!valid} onClick={() => { onSave({ ...item, label: label.trim(), url: url.trim(), target: target.trim() }); setEditing(false); }}>Save</button>
        <button onClick={() => { setLabel(item.label); setUrl(item.url); setTarget(item.target); setEditing(false); }}>Cancel</button>
      </span>
    </div>;
  }

  return <div className="quick-launch-chip">
    <span className="chip-actions"><button onClick={() => setEditing(true)} aria-label={`Edit ${item.label}`}>✎</button><button onClick={onDelete} aria-label={`Delete ${item.label}`}>×</button></span>
    <a className="quick-launch-link" onClick={() => void launchItem(item, setError)} title={error ?? undefined}>
      <span className="quick-launch-icon" style={{ background: icon.color }}>{icon.glyph}</span>
      {item.label}
    </a>
  </div>;
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
      <div className="quick-launch-list">{sampleQuickLaunch.map((item) => {
        const icon = iconFor(item);
        return <div className="quick-launch-chip" key={item.id}>
          <a className="quick-launch-link" onClick={() => void window.frontDesk.openContentLink(item.url)}>
            <span className="quick-launch-icon" style={{ background: icon.color }}>{icon.glyph}</span>
            {item.label}
          </a>
        </div>;
      })}</div>
    </>}
    {links.length === 0 && !useSampleData && <p className="intro sample-note">No links yet.</p>}
    {links.length > 0 && <div className="quick-launch-list">{links.map((item) => <LaunchChip key={item.id} item={item} chromeProfiles={chromeProfiles} onSave={saveLink} onDelete={() => deleteLink(item.id)}/>)}</div>}
    <AddLaunchForm chromeProfiles={chromeProfiles} onAdd={addLink}/>
  </section>;
}
