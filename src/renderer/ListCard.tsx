import { useState } from 'react';
import type { RoutineItem } from '../shared/contracts';

function AddItemForm({ titlePlaceholder, detailPlaceholder, addButtonLabel, onAdd }: {
  titlePlaceholder: string; detailPlaceholder: string; addButtonLabel: string; onAdd: (title: string, detail: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  function submit() {
    if (!title.trim()) return;
    onAdd(title.trim(), detail.trim());
    setTitle(''); setDetail('');
  }

  return <div className="routine-add">
    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} aria-label={titlePlaceholder} onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={detailPlaceholder} aria-label={detailPlaceholder} onKeyDown={(e) => e.key === 'Enter' && submit()}/>
    <button className="primary" disabled={!title.trim()} onClick={submit}>{addButtonLabel}</button>
  </div>;
}

function ItemRow({ item, onSave, onDelete, onMove, isFirst, isLast, titlePlaceholder, detailPlaceholder }: {
  item: RoutineItem; onSave: (item: RoutineItem) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void;
  isFirst: boolean; isLast: boolean; titlePlaceholder: string; detailPlaceholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [detail, setDetail] = useState(item.detail);

  if (editing) {
    return <li className="routine-row editing">
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={titlePlaceholder}/>
      <input value={detail} onChange={(e) => setDetail(e.target.value)} aria-label={detailPlaceholder}/>
      <span><button className="primary" onClick={() => { if (title.trim()) { onSave({ ...item, title: title.trim(), detail: detail.trim() }); setEditing(false); } }}>Save</button><button onClick={() => { setTitle(item.title); setDetail(item.detail); setEditing(false); }}>Cancel</button></span>
    </li>;
  }

  return <li className="routine-row">
    <div><strong>{item.title}</strong><span>{item.detail}</span></div>
    <span>
      <button aria-label={`Move ${item.title} up`} disabled={isFirst} onClick={() => onMove(-1)}>↑</button>
      <button aria-label={`Move ${item.title} down`} disabled={isLast} onClick={() => onMove(1)}>↓</button>
      <button onClick={() => setEditing(true)}>Edit</button>
      <button onClick={onDelete}>Delete</button>
    </span>
  </li>;
}

/** Generic title+detail list card — add/edit/delete/reorder, with a per-card sample fallback shown
 * only until the installer adds a real item. Backs Routines, Projects & tasks, and Notes. */
export function ListCard({ eyebrow, heading, items, useSampleData, sampleItems, onUpdate, titlePlaceholder, detailPlaceholder, addButtonLabel, emptyMessage }: {
  eyebrow: string; heading: string; items: RoutineItem[]; useSampleData: boolean; sampleItems: RoutineItem[];
  onUpdate: (items: RoutineItem[]) => void;
  titlePlaceholder: string; detailPlaceholder: string; addButtonLabel: string; emptyMessage: string;
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
  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(next);
  }

  return <section className="panel">
    <div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{heading}</h2></div></div>
    {items.length === 0 && useSampleData && <>
      <p className="intro sample-note">Examples — add your own below and these disappear.</p>
      <ul className="sample-list">{sampleItems.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul>
    </>}
    {items.length === 0 && !useSampleData && <p className="intro sample-note">{emptyMessage}</p>}
    {items.length > 0 && <ul className="routine-list">{items.map((item, index) => <ItemRow key={item.id} item={item} onSave={saveItem} onDelete={() => deleteItem(item.id)} onMove={(direction) => moveItem(index, direction)} isFirst={index === 0} isLast={index === items.length - 1} titlePlaceholder={titlePlaceholder} detailPlaceholder={detailPlaceholder}/>)}</ul>}
    <AddItemForm titlePlaceholder={titlePlaceholder} detailPlaceholder={detailPlaceholder} addButtonLabel={addButtonLabel} onAdd={addItem}/>
  </section>;
}
