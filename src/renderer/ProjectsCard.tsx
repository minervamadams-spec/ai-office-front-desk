import type { RoutineItem } from '../shared/contracts';
import { sampleProjects } from '../shared/contracts';
import { ListCard } from './ListCard';

export function ProjectsCard({ items, useSampleData, onUpdate, collapsed, onToggleCollapse }: {
  items: RoutineItem[]; useSampleData: boolean; onUpdate: (items: RoutineItem[]) => void; collapsed?: boolean; onToggleCollapse?: () => void;
}) {
  return <ListCard eyebrow="PROJECTS & TASKS" heading="Projects & tasks" items={items} useSampleData={useSampleData} sampleItems={sampleProjects} onUpdate={onUpdate} collapsed={collapsed} onToggleCollapse={onToggleCollapse}
    titlePlaceholder="Project or task" detailPlaceholder="e.g. Due in 6 days · 3 open tasks" addButtonLabel="Add" emptyMessage="No projects yet."
    aiPrompt="Help me break my current work down into 3-5 project or task entries. For each one give a short name and a one-line status or due date."/>;
}
