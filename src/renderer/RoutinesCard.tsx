import type { RoutineItem } from '../shared/contracts';
import { sampleRoutines } from '../shared/contracts';
import { ListCard } from './ListCard';

export function RoutinesCard({ routines, useSampleData, onUpdateRoutines }: {
  routines: RoutineItem[]; useSampleData: boolean; onUpdateRoutines: (routines: RoutineItem[]) => void;
}) {
  return <ListCard eyebrow="ROUTINES" heading="Routines" items={routines} useSampleData={useSampleData} sampleItems={sampleRoutines} onUpdate={onUpdateRoutines}
    titlePlaceholder="Routine name" detailPlaceholder="e.g. Weekdays · 15 minutes" addButtonLabel="Add routine" emptyMessage="No routines yet."
    aiPrompt="Help me design a short list of 3-5 daily or weekly routines to stay organized. For each one give a short name and a schedule (e.g. 'Weekdays · 15 minutes')."/>;
}
