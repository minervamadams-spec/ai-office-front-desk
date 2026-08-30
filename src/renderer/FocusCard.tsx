import { useState } from 'react';
import { sampleFocusText } from '../shared/contracts';

/** A single highlighted line for whatever the installer wants front and center today — not a list,
 * just one statement, editable in place. */
export function FocusCard({ focusText, useSampleData, onUpdate }: {
  focusText: string; useSampleData: boolean; onUpdate: (focusText: string) => void;
}) {
  const showingExample = focusText === '' && useSampleData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(showingExample ? sampleFocusText : focusText);

  function startEditing() {
    setDraft(showingExample ? '' : focusText);
    setEditing(true);
  }
  function save() {
    onUpdate(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">FOCUS</p><h2>Today</h2></div></div>
      <div className="routine-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's front and center today?" aria-label="Focus" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()}/>
        <button className="primary" onClick={save}>Save</button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </section>;
  }

  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">FOCUS</p><h2>Today</h2></div></div>
    {showingExample
      ? <p className="intro sample-note">Example — <a className="quick-launch-link" onClick={startEditing}>click to set your own</a>: “{sampleFocusText}”.</p>
      : focusText
        ? <p className="intro" style={{ padding: '0 16px 14px' }}>{focusText}</p>
        : <p className="intro sample-note">No focus set yet.</p>}
    <div className="actions" style={{ padding: '0 16px 14px' }}>
      <button onClick={startEditing}>{focusText ? 'Edit' : 'Set focus'}</button>
      {focusText && <button onClick={() => onUpdate('')}>Clear</button>}
    </div>
  </section>;
}
