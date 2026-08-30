import { useState } from 'react';
import type { AffirmationItem } from '../shared/contracts';
import { sampleAffirmations } from '../shared/contracts';

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function AddAffirmationForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  }
  return <div className="routine-add">
    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an affirmation" aria-label="Affirmation text" onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <button className="primary" disabled={!text.trim()} onClick={submit}>Add</button>
  </div>;
}

function AffirmationRow({ item, onSave, onDelete }: { item: AffirmationItem; onSave: (item: AffirmationItem) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  if (editing) {
    return <li className="routine-row editing">
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Affirmation text"/>
      <span><button className="primary" onClick={() => { if (text.trim()) { onSave({ ...item, text: text.trim() }); setEditing(false); } }}>Save</button><button onClick={() => { setText(item.text); setEditing(false); }}>Cancel</button></span>
    </li>;
  }

  return <li className="routine-row">
    <div><span>{item.text}</span></div>
    <span><button onClick={() => setEditing(true)}>Edit</button><button onClick={onDelete}>Delete</button></span>
  </li>;
}

export function AffirmationsCard({ affirmations, useSampleData, onUpdateAffirmations }: {
  affirmations: AffirmationItem[]; useSampleData: boolean; onUpdateAffirmations: (affirmations: AffirmationItem[]) => void;
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
    <div className="panel-heading"><div><p className="eyebrow">AFFIRMATIONS</p><h2>Today</h2></div></div>
    {featured && <p className="featured-affirmation">{featured.text}</p>}
    {affirmations.length === 0 && useSampleData && <p className="intro sample-note">Examples — add your own below and these disappear.</p>}
    {affirmations.length === 0 && !useSampleData && <p className="intro sample-note">No affirmations yet.</p>}
    {affirmations.length > 0 && <ul className="routine-list">{affirmations.map((item) => <AffirmationRow key={item.id} item={item} onSave={saveAffirmation} onDelete={() => deleteAffirmation(item.id)}/>)}</ul>}
    <AddAffirmationForm onAdd={addAffirmation}/>
  </section>;
}
