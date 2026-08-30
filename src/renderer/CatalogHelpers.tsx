import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ConnectorManifest } from '../shared/contracts';
import { catalogStatusLabel } from '../shared/contracts';

export function statusLabelFor(service: ConnectorManifest, connectedIds: ReadonlySet<string>): string {
  if (connectedIds.has(service.id)) return 'Connected';
  return catalogStatusLabel[service.status];
}

export function statusClassFor(service: ConnectorManifest, connectedIds: ReadonlySet<string>): string {
  return connectedIds.has(service.id) ? 'available' : service.status;
}

export function Dismissible({ id, dismissedNotices, onDismissNotice, children }: { id: string; dismissedNotices: string[]; onDismissNotice: (id: string) => void; children: ReactNode }) {
  if (dismissedNotices.includes(id)) return null;
  return <div className="notice">{children}<button className="notice-close" aria-label="Dismiss this notice" onClick={() => onDismissNotice(id)}>×</button></div>;
}

export function NotReadyDetails({ service }: { service: ConnectorManifest }) {
  const [open, setOpen] = useState(false);
  if (!service.notReadyReason) return null;
  return <>
    <button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'What would it take?'}</button>
    {open && <p className="form-status">{service.notReadyReason}</p>}
  </>;
}
