import Database from 'better-sqlite3';
import {
  DeskDesign, DeskProfile, RoutineItem, AffirmationItem, QuickLaunchItem, QuickLaunchKind,
  defaultDesign, defaultProfile, knownCardIds, MAX_ROUTINES, MAX_AFFIRMATIONS, MAX_QUICK_LAUNCH, MAX_PROJECT_ITEMS, MAX_NOTE_ITEMS
} from '../shared/contracts';

function isHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

const MAX_DISMISSED_NOTICES = 20;

/** Shared shape for any user-managed id+text(es) list — sanitizes unknown JSON into a capped, deduped array. */
function sanitizeItemList<T extends { id: string }>(candidate: unknown, max: number, build: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(candidate)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of candidate) {
    if (result.length >= max) break;
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(build(item));
  }
  return result;
}

function sanitizeTitleDetailList(candidate: unknown, max: number): RoutineItem[] {
  return sanitizeItemList<RoutineItem>(candidate, max, (item) => ({
    id: item.id as string,
    title: typeof item.title === 'string' ? item.title.slice(0, 120) : '',
    detail: typeof item.detail === 'string' ? item.detail.slice(0, 160) : ''
  }));
}

function sanitizeFocusText(candidate: unknown): string {
  return typeof candidate === 'string' ? candidate.slice(0, 160) : '';
}

function sanitizeAffirmations(candidate: unknown): AffirmationItem[] {
  return sanitizeItemList<AffirmationItem>(candidate, MAX_AFFIRMATIONS, (item) => ({
    id: item.id as string,
    text: typeof item.text === 'string' ? item.text.slice(0, 240) : ''
  }));
}

function sanitizeQuickLaunch(candidate: unknown): QuickLaunchItem[] {
  return sanitizeItemList<QuickLaunchItem>(candidate, MAX_QUICK_LAUNCH, (item) => {
    // Missing/unrecognized kind defaults to 'link' — that's the only shape this field had before
    // 'app' and 'chrome-profile' existed, so old stored data keeps working unchanged.
    const kind: QuickLaunchKind = item.kind === 'app' || item.kind === 'chrome-profile' ? item.kind : 'link';
    const url = typeof item.url === 'string' && isHttpUrl(item.url) ? item.url : '';
    const target = typeof item.target === 'string' ? item.target.slice(0, 120) : '';
    return {
      id: item.id as string,
      label: typeof item.label === 'string' ? item.label.slice(0, 60) : '',
      kind,
      url: kind === 'app' ? '' : url,
      target: kind === 'link' ? '' : target
    };
  }).filter((item) => (item.kind === 'link' ? item.url !== '' : item.kind === 'app' ? item.target !== '' : item.url !== '' && item.target !== ''));
}

/** Exported so the layout-only import feature can validate untrusted file content through the exact
 * same rules a normal save goes through — no separate, potentially-drifting validation path. */
export function sanitizeDesign(candidate: unknown): DeskDesign {
  const design = (candidate && typeof candidate === 'object' ? candidate : {}) as Partial<DeskDesign>;
  const cardOrder = Array.isArray(design.cardOrder)
    ? [...new Set(design.cardOrder.filter((card): card is string => typeof card === 'string' && (knownCardIds as readonly string[]).includes(card)))]
    : defaultDesign.cardOrder;
  const cardOrderSet = new Set(cardOrder);
  return {
    accent: design.accent === 'violet' || design.accent === 'teal' ? design.accent : 'blue',
    density: design.density === 'compact' ? 'compact' : 'comfortable',
    columns: design.columns === 1 ? 1 : 2,
    showDescriptions: design.showDescriptions !== false,
    cardOrder,
    column2: Array.isArray(design.column2)
      ? [...new Set(design.column2.filter((card): card is string => typeof card === 'string' && cardOrderSet.has(card)))]
      : []
  };
}

export class ProfileRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  read(): DeskProfile {
    const row = this.db.prepare('SELECT value FROM profiles WHERE id = ?').get('primary') as { value?: string } | undefined;
    if (!row?.value) return structuredClone(defaultProfile);
    try { return this.validate(JSON.parse(row.value)); } catch { return structuredClone(defaultProfile); }
  }

  save(profile: DeskProfile): DeskProfile {
    const value = this.validate(profile);
    this.db.prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify(value));
    return value;
  }

  updateDesign(patch: Partial<DeskDesign>): DeskProfile {
    const profile = this.read();
    return this.save({ ...profile, design: { ...profile.design, ...patch } });
  }

  close(): void { this.db.close(); }

  private validate(candidate: unknown): DeskProfile {
    const value = (candidate && typeof candidate === 'object' ? candidate : {}) as Partial<DeskProfile>;
    return {
      firstName: typeof value.firstName === 'string' ? value.firstName.slice(0, 60) : '',
      // Empty string is a legitimate mid-edit value — only a missing/non-string field falls back to the default,
      // otherwise every keystroke round-trip snaps a cleared field back to "My Front Desk" before the user can retype it.
      deskName: typeof value.deskName === 'string' ? value.deskName.slice(0, 80) : defaultProfile.deskName,
      timezone: typeof value.timezone === 'string' ? value.timezone.slice(0, 80) : defaultProfile.timezone,
      onboardingComplete: Boolean(value.onboardingComplete),
      wizardStep: typeof value.wizardStep === 'number' && value.wizardStep >= 0 && value.wizardStep <= 4 ? value.wizardStep : 0,
      useSampleData: value.useSampleData !== false,
      dismissedNotices: Array.isArray(value.dismissedNotices) ? [...new Set(value.dismissedNotices.filter((id): id is string => typeof id === 'string'))].slice(0, MAX_DISMISSED_NOTICES) : [],
      routines: sanitizeTitleDetailList(value.routines, MAX_ROUTINES),
      affirmations: sanitizeAffirmations(value.affirmations),
      quickLaunch: sanitizeQuickLaunch(value.quickLaunch),
      focusText: sanitizeFocusText(value.focusText),
      projectItems: sanitizeTitleDetailList(value.projectItems, MAX_PROJECT_ITEMS),
      noteItems: sanitizeTitleDetailList(value.noteItems, MAX_NOTE_ITEMS),
      design: sanitizeDesign(value.design)
    };
  }
}
