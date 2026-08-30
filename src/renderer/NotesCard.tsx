import type { RoutineItem } from '../shared/contracts';
import { sampleNotes } from '../shared/contracts';
import { ListCard } from './ListCard';

export function NotesCard({ items, useSampleData, onUpdate, collapsed, onToggleCollapse }: {
  items: RoutineItem[]; useSampleData: boolean; onUpdate: (items: RoutineItem[]) => void; collapsed?: boolean; onToggleCollapse?: () => void;
}) {
  return <ListCard eyebrow="NOTES" heading="Notes" items={items} useSampleData={useSampleData} sampleItems={sampleNotes} onUpdate={onUpdate} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
    titlePlaceholder="Note" detailPlaceholder="e.g. Last edited 2 days ago" addButtonLabel="Add note" emptyMessage="No notes yet."
    aiPrompt="Help me brainstorm 3-5 quick notes worth capturing right now. For each one give a short title and a one-line detail."/>;
}
