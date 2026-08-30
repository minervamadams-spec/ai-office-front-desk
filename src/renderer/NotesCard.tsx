import type { RoutineItem } from '../shared/contracts';
import { sampleNotes } from '../shared/contracts';
import { ListCard } from './ListCard';

export function NotesCard({ items, useSampleData, onUpdate }: {
  items: RoutineItem[]; useSampleData: boolean; onUpdate: (items: RoutineItem[]) => void;
}) {
  return <ListCard eyebrow="NOTES" heading="Notes" items={items} useSampleData={useSampleData} sampleItems={sampleNotes} onUpdate={onUpdate}
    titlePlaceholder="Note" detailPlaceholder="e.g. Last edited 2 days ago" addButtonLabel="Add note" emptyMessage="No notes yet."/>;
}
