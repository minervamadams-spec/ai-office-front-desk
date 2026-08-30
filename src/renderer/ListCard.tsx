import { useState } from 'react';
import type { RoutineItem } from '../shared/contracts';
import { AiNudge } from './AiNudge';

function AddItemForm({ titlePlaceholder, detailPlaceholder, addButtonLabel, onAdd }: {
  titlePlaceholder: string; detailPlaceholder: string; addButtonLabel: string; onAdd: (title: string, detail: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  function submit() {
    if (!title.trim()) return;
    onAdd(title.trim(), detail.trim());
    setTitle(''); setDetail(''); setOpen(false);
  }

  if (!open) return <button className="add-link" onClick={() => setOpen(true)}>+ {addButtonLabel}</button>;

  return <div className="routine-add">
    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} aria-label={titlePlaceholder} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={detailPlaceholder} aria-label={detailPlaceholder} onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <button className="primary" disabled={!title.trim()} onClick={submit}>{addButtonLabel}</button>
    <button onClick={() => setOpen(false)}>Cancel</button>
  </div>;
}

/** Click the row itself to edit — no standalone Edit/Delete/reorder buttons cluttering the resting
 * view. Delete lives inside the edit form, next to Save/Cancel. */
function ItemRow({ item, onSave, onDelete, titlePlaceholder, detailPlaceholder }: {
  item: RoutineItem; onSave: (item: RoutineItem) => void; onDelete: () => void;
  titlePlaceholder: string; detailPlaceholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [detail, setDetail] = useState(item.detail);

  if (editing) {
    return <li className="routine-row editing">
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={titlePlaceholder} autoFocus/>
      <input value={detail} onChange={(e) => setDetail(e.target.value)} aria-label={detailPlaceholder}/>
      <span><button className="primary" onClick={() => { if (title.trim()) { onSave({ ...item, title: title.trim(), detail: detail.trim() }); setEditing(false); } }}>Save</button><button onClick={() => { setTitle(item.title); setDetail(item.detail); setEditing(false); }}>Cancel</button><button onClick={onDelete}>Delete</button></span>
    </li>;
  }

  return <li className="routine-row clickable" onClick={() => setEditing(true)}>
    <div><strong>{item.title}</strong><span>{item.detail}</span></div>
  </li>;
}

/** Generic title+detail list card — add/edit/delete, with a per-card sample fallback shown only
 * until the installer adds a real item. Backs Routines, Projects & tasks, and Notes. */
export function ListCard({ eyebrow, heading, items, useSampleData, sampleItems, onUpdate, titlePlaceholder, detailPlaceholder, addButtonLabel, emptyMessage, aiPrompt, collapsed, onToggleCollapse }: {
  eyebrow: string; heading: string; items: RoutineItem[]; useSampleData: boolean; sampleItems: RoutineItem[];
  onUpdate: (items: RoutineItem[]) => void;
  titlePlaceholder: string; detailPlaceholder: string; addButtonLabel: string; emptyMessage: string; aiPrompt: string; collapsed?: boolean; onToggleCollapse?: () => void;
}) {
  function addItem(title: string, detail: string) {
    onUpdate([...items, { id: crypto.randomUUID(), title, detail }]);
  }
  function saveItem(updated: RoutineItem) {
    onUpdate(items.map((i) => (i.id === updated.id ? updated : i)));
  }
  function deleteItem(id: string) {
    onUpdate(items.filter((i) => i.id !== id));
  }

  return <section className="panel">
    <div className="panel-heading collapsible" onClick={onToggleCollapse}><div><p className="eyebrow">{eyebrow}</p><h2>{heading}</h2></div><span className={`chevron${collapsed ? ' collapsed' : ''}`}>⌄</span></div>
    {!collapsed && <>
      {items.length === 0 && useSampleData && <>
        <p className="intro sample-note">Examples</p>
        <ul className="sample-list">{sampleItems.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul>
      </>}
      {items.length === 0 && !useSampleData && <p className="intro sample-note">{emptyMessage}</p>}
      {items.length > 0 && <ul className="routine-list">{items.map((item) => <ItemRow key={item.id} item={item} onSave={saveItem} onDelete={() => deleteItem(item.id)} titlePlaceholder={titlePlaceholder} detailPlaceholder={detailPlaceholder}/>)}</ul>}
      <AddItemForm titlePlaceholder={titlePlaceholder} detailPlaceholder={detailPlaceholder} addButtonLabel={addButtonLabel} onAdd={addItem}/>
      <AiNudge prompt={aiPrompt}/>
    </>}
  </section>;
}
