import type { DeskDesign } from '../shared/contracts';

/** Moves `draggedId` to sit next to `targetId` (or to the end, if targetId is null — an empty-column
 * drop) and assigns it to whichever column it was dropped into. Shared by the Settings/Wizard layout
 * editor and the live dashboard's own drag-and-drop, so "move a card" only has one implementation. */
export function reorderCards(design: Pick<DeskDesign, 'cardOrder' | 'column2'>, draggedId: string, targetId: string | null, toColumn2: boolean): Partial<DeskDesign> {
  const order = [...design.cardOrder];
  const from = order.indexOf(draggedId);
  if (from < 0) return design;
  order.splice(from, 1);
  const to = targetId ? order.indexOf(targetId) : order.length;
  order.splice(to < 0 ? order.length : to, 0, draggedId);
  const nextColumn2 = new Set(design.column2);
  if (toColumn2) nextColumn2.add(draggedId); else nextColumn2.delete(draggedId);
  return { cardOrder: order, column2: [...nextColumn2] };
}
