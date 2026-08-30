import type { RoutineItem } from '../shared/contracts';
import { sampleRoutines } from '../shared/contracts';
import { ListCard } from './ListCard';

export function RoutinesCard({ routines, useSampleData, onUpdateRoutines }: {
  routines: RoutineItem[]; useSampleData: boolean; onUpdateRoutines: (routines: RoutineItem[]) => void;
}) {
  return <ListCard eyebrow="ROUTINES" heading="Routines" items={routines} useSampleData={useSampleData} sampleItems={sampleRoutines} onUpdate={onUpdateRoutines}
    titlePlaceholder="Routine name" detailPlaceholder="e.g. Weekdays · 15 minutes" addButtonLabel="Add routine" emptyMessage="No routines yet."/>;
}
