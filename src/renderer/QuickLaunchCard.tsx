import { useState } from 'react';
import type { QuickLaunchItem } from '../shared/contracts';
import { sampleQuickLaunch } from '../shared/contracts';

function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

function AddLaunchForm({ onAdd }: { onAdd: (label: string, url: string) => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const valid = label.trim() && isHttpUrl(url.trim());

  function submit() {
    if (!valid) return;
    onAdd(label.trim(), url.trim());
    setLabel(''); setUrl('');
  }

  return <div className="routine-add">
    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (e.g. Claude)" aria-label="Link name" onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." aria-label="Link URL" onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <button className="primary" disabled={!valid} onClick={submit}>Add</button>
  </div>;
}

function LaunchRow({ item, onSave, onDelete }: { item: QuickLaunchItem; onSave: (item: QuickLaunchItem) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);

  if (editing) {
    return <li className="routine-row editing">
      <input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link name"/>
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link URL"/>
      <span><button className="primary" onClick={() => { if (label.trim() && isHttpUrl(url.trim())) { onSave({ ...item, label: label.trim(), url: url.trim() }); setEditing(false); } }}>Save</button><button onClick={() => { setLabel(item.label); setUrl(item.url); setEditing(false); }}>Cancel</button></span>
    </li>;
  }

  return <li className="routine-row">
    <div><a className="quick-launch-link" onClick={() => void window.frontDesk.openContentLink(item.url)}>{item.label}</a></div>
    <span><button onClick={() => setEditing(true)}>Edit</button><button onClick={onDelete}>Delete</button></span>
  </li>;
}

export function QuickLaunchCard({ links, useSampleData, onUpdateLinks }: {
  links: QuickLaunchItem[]; useSampleData: boolean; onUpdateLinks: (links: QuickLaunchItem[]) => void;
}) {
  function addLink(label: string, url: string) {
    onUpdateLinks([...links, { id: crypto.randomUUID(), label, url }]);
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
    {links.length > 0 && <ul className="routine-list">{links.map((item) => <LaunchRow key={item.id} item={item} onSave={saveLink} onDelete={() => deleteLink(item.id)}/>)}</ul>}
    <AddLaunchForm onAdd={addLink}/>
  </section>;
}
