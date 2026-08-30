import { useState } from 'react';
import type { DeskDesign } from '../shared/contracts';
import { defaultDesign } from '../shared/contracts';
import { reorderCards } from './cardOrdering';

export const ALL_CARDS = [
  { id: 'focus', label: 'Focus', description: 'A single highlighted line for whatever you want front and center today.' },
  { id: 'projects', label: 'Projects & tasks', description: 'A manual list of projects and their due dates.' },
  { id: 'connections', label: 'Connections', description: 'Where you connect Jira, Google, Outlook, and browse other services.' },
  { id: 'routines', label: 'Routines', description: 'A list you manage yourself — recurring habits or reminders, no auto-sync.' },
  { id: 'notes', label: 'Notes', description: 'A manual list for anything you want to jot down.' },
  { id: 'affirmations', label: 'Affirmations', description: 'A list you keep yourself, with one featured each day on rotation.' },
  { id: 'weather', label: 'Weather', description: 'Current temperature and conditions for one location you choose — no account needed.' },
  { id: 'rss', label: 'RSS feed', description: 'Recent items from one RSS or Atom feed URL you paste in.' },
  { id: 'quicklaunch', label: 'Quick launch', description: 'One-click links, local apps, or a link that opens in one specific Chrome profile — you maintain the list.' }
];

/** Shared card-visibility + column-arrangement editor — used by both the first-run wizard and Settings,
 * so rearranging the desk later never requires stepping back through the whole wizard. */
export function LayoutEditor({ design, onUpdateDesign }: { design: DeskDesign; onUpdateDesign: (patch: Partial<DeskDesign>) => Promise<void> }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const column2Set = new Set(design.column2);
  const column1Cards = design.cardOrder.filter((id) => !column2Set.has(id));
  const column2Cards = design.cardOrder.filter((id) => column2Set.has(id));

  function toggleCard(id: string) {
    const enabled = design.cardOrder.includes(id);
    const cardOrder = enabled ? design.cardOrder.filter((c) => c !== id) : [...design.cardOrder, id];
    void onUpdateDesign({ cardOrder });
  }

  /** Reorders within whichever column `id` currently belongs to — column membership is untouched. */
  function moveCard(id: string, direction: -1 | 1) {
    const sameColumn = column2Set.has(id) ? column2Cards : column1Cards;
    const neighborId = sameColumn[sameColumn.indexOf(id) + direction];
    if (!neighborId) return;
    const order = [...design.cardOrder];
    const i = order.indexOf(id);
    const j = order.indexOf(neighborId);
    [order[i], order[j]] = [order[j], order[i]];
    void onUpdateDesign({ cardOrder: order });
  }

  /** Drag-and-drop move: repositions `draggedId` next to `targetId` (or at the end, if targetId is null —
   * an empty-column drop) and assigns it to whichever column it was dropped into. */
  function moveToColumn(draggedId: string, targetId: string | null, toColumn2: boolean) {
    void onUpdateDesign(reorderCards(design, draggedId, targetId, toColumn2));
  }

  function resetLayout() {
    void onUpdateDesign({ columns: defaultDesign.columns, cardOrder: defaultDesign.cardOrder, column2: defaultDesign.column2 });
  }

  function reorderRow(id: string, toColumn2: boolean, isFirst: boolean, isLast: boolean) {
    const label = ALL_CARDS.find((c) => c.id === id)?.label ?? id;
    return <li key={id} draggable
      onDragStart={() => setDragId(id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); if (dragId) moveToColumn(dragId, id, toColumn2); setDragId(null); }}
      onDragEnd={() => setDragId(null)}>
      <span className="grip" aria-hidden="true">⠿⠿</span>{label}
      <span><button aria-label={`Move ${label} up`} disabled={isFirst} onClick={() => moveCard(id, -1)}>↑</button><button aria-label={`Move ${label} down`} disabled={isLast} onClick={() => moveCard(id, 1)}>↓</button></span>
    </li>;
  }

  return <>
    <div className="toggle-list">{ALL_CARDS.map((card) => <label key={card.id} className="switch card-toggle"><input type="checkbox" checked={design.cardOrder.includes(card.id)} onChange={() => toggleCard(card.id)}/><span><strong>{card.label}</strong><small>{card.description}</small></span></label>)}</div>
    <label>Columns<select value={design.columns} onChange={(e) => void onUpdateDesign({ columns: Number(e.target.value) as 1 | 2 })}><option value={2}>Two columns</option><option value={1}>One column</option></select></label>
    {design.columns === 1
      ? <ul className="reorder-list">{design.cardOrder.map((id, i, arr) => reorderRow(id, false, i === 0, i === arr.length - 1))}</ul>
      : <div className="reorder-columns">
          <div className="reorder-column" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveToColumn(dragId, null, false); setDragId(null); }}>
            <p className="reorder-column-label">Column A</p>
            <ul className="reorder-list">{column1Cards.map((id, i, arr) => reorderRow(id, false, i === 0, i === arr.length - 1))}</ul>
          </div>
          <div className="reorder-column" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveToColumn(dragId, null, true); setDragId(null); }}>
            <p className="reorder-column-label">Column B</p>
            <ul className="reorder-list">{column2Cards.map((id, i, arr) => reorderRow(id, true, i === 0, i === arr.length - 1))}</ul>
          </div>
        </div>}
    <div className="actions"><button onClick={resetLayout}>Reset layout</button></div>
  </>;
}
