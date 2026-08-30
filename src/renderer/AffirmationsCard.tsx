import { useState } from 'react';
import type { AffirmationItem } from '../shared/contracts';
import { sampleAffirmations } from '../shared/contracts';
import { AiNudge } from './AiNudge';

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function AddAffirmationForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText(''); setOpen(false);
  }
  if (!open) return <button className="add-link" onClick={() => setOpen(true)}>+ Add affirmation</button>;
  return <div className="routine-add">
    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an affirmation" aria-label="Affirmation text" autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <button className="primary" disabled={!text.trim()} onClick={submit}>Add</button>
    <button onClick={() => setOpen(false)}>Cancel</button>
  </div>;
}

/** Click the row itself to edit — Delete lives inside the edit form, next to Save/Cancel. */
function AffirmationRow({ item, onSave, onDelete }: { item: AffirmationItem; onSave: (item: AffirmationItem) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  if (editing) {
    return <li className="routine-row editing">
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Affirmation text" autoFocus/>
      <span><button className="primary" onClick={() => { if (text.trim()) { onSave({ ...item, text: text.trim() }); setEditing(false); } }}>Save</button><button onClick={() => { setText(item.text); setEditing(false); }}>Cancel</button><button onClick={onDelete}>Delete</button></span>
    </li>;
  }

  return <li className="routine-row clickable" onClick={() => setEditing(true)}><div><span>{item.text}</span></div></li>;
}

export function AffirmationsCard({ affirmations, useSampleData, onUpdateAffirmations, collapsed, onToggleCollapse }: {
  affirmations: AffirmationItem[]; useSampleData: boolean; onUpdateAffirmations: (affirmations: AffirmationItem[]) => void; collapsed?: boolean; onToggleCollapse?: () => void;
}) {
  const source = affirmations.length > 0 ? affirmations : (useSampleData ? sampleAffirmations : []);
  const featured = source.length > 0 ? source[dayOfYear(new Date()) % source.length] : null;

  function addAffirmation(text: string) {
    onUpdateAffirmations([...affirmations, { id: crypto.randomUUID(), text }]);
  }
  function saveAffirmation(updated: AffirmationItem) {
    onUpdateAffirmations(affirmations.map((a) => (a.id === updated.id ? updated : a)));
  }
  function deleteAffirmation(id: string) {
    onUpdateAffirmations(affirmations.filter((a) => a.id !== id));
  }

  return <section className="panel">
    <div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">AFFIRMATIONS</p><h2>Today</h2></div><span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
    {!collapsed && <>
      {featured && <p className="featured-affirmation">{featured.text}</p>}
      {affirmations.length === 0 && useSampleData && <p className="intro sample-note">Examples</p>}
      {affirmations.length === 0 && !useSampleData && <p className="intro sample-note">No affirmations yet.</p>}
      {affirmations.length > 0 && <ul className="routine-list">{affirmations.map((item) => <AffirmationRow key={item.id} item={item} onSave={saveAffirmation} onDelete={() => deleteAffirmation(item.id)}/>)}</ul>}
      <AddAffirmationForm onAdd={addAffirmation}/>
      <AiNudge prompt="Write 3-5 short, genuine daily affirmations for me — one sentence each, plain and specific rather than generic, no clichés."/>
    </>}
  </section>;
}
