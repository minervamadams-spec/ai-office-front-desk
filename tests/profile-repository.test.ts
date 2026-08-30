import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProfileRepository, sanitizeDesign } from '../src/main/profile-repository';

function tempPath() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-test-')), 'profile.sqlite'); }

describe('sanitizeDesign (used to validate untrusted layout-import files)', () => {
  it('accepts a well-formed design unchanged', () => {
    const design = sanitizeDesign({ accent: 'teal', density: 'compact', columns: 1, showDescriptions: false, cardOrder: ['notes', 'weather'], column2: [], collapsedCards: [] });
    expect(design).toEqual({ accent: 'teal', density: 'compact', columns: 1, showDescriptions: false, cardOrder: ['notes', 'weather'], column2: [], collapsedCards: [] });
  });

  it('falls back to safe defaults for a completely malformed input, without throwing', () => {
    expect(() => sanitizeDesign('not an object')).not.toThrow();
    expect(() => sanitizeDesign(null)).not.toThrow();
    expect(() => sanitizeDesign(42)).not.toThrow();
    const design = sanitizeDesign({ cardOrder: 'not-an-array', accent: 'malicious-injected-value' });
    expect(design.accent).toBe('blue');
    expect(Array.isArray(design.cardOrder)).toBe(true);
  });

  it('drops fields that are not part of the layout at all, e.g. a smuggled provider token', () => {
    const design = sanitizeDesign({ cardOrder: ['notes'], apiToken: 'sk-should-never-be-here', siteUrl: 'https://evil.example' } as never);
    expect(design).not.toHaveProperty('apiToken');
    expect(design).not.toHaveProperty('siteUrl');
  });
});

describe('ProfileRepository layout persistence', () => {
  it('persists a design patch across repository instances (same file)', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.updateDesign({ columns: 1, cardOrder: ['connections', 'projects'] });
    first.close();

    const second = new ProfileRepository(dbPath);
    const reloaded = second.read();
    expect(reloaded.design.columns).toBe(1);
    expect(reloaded.design.cardOrder).toEqual(['connections', 'projects']);
    second.close();
  });

  it('falls back to defaults instead of throwing on a malformed stored value', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', 'not-json');
    const profile = repo.read();
    expect(profile.deskName).toBe('My Front Desk');
    repo.close();
  });

  it('strips unknown card ids left over from an older layout', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({ design: { cardOrder: ['legacy-widget', 'projects', 'legacy-widget', 'notes'] } }));
    expect(repo.read().design.cardOrder).toEqual(['projects', 'notes']);
    repo.close();
  });

  it('drops column2 entries that are not actually enabled in cardOrder', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      design: { cardOrder: ['projects', 'notes'], column2: ['notes', 'routines', 'not-a-card'] }
    }));
    expect(repo.read().design.column2).toEqual(['notes']);
    repo.close();
  });

  it('persists a column2 assignment across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.updateDesign({ cardOrder: ['projects', 'notes', 'routines'], column2: ['notes'] });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().design.column2).toEqual(['notes']);
    second.close();
  });

  it('allows an empty desk name to persist mid-edit rather than snapping back to the default', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    const saved = repo.save({ ...repo.read(), deskName: '' });
    expect(saved.deskName).toBe('');
    repo.close();
  });

  it('clamps wizardStep to a safe range', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    const saved = repo.save({ ...repo.read(), wizardStep: 999 });
    expect(saved.wizardStep).toBe(0);
    repo.close();
  });

  it('persists a real, user-added routine across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({ ...first.read(), routines: [{ id: 'r1', title: 'Morning triage', detail: 'Weekdays · 15 min' }] });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().routines).toEqual([{ id: 'r1', title: 'Morning triage', detail: 'Weekdays · 15 min' }]);
    second.close();
  });

  it('drops malformed or duplicate-id routine entries rather than throwing', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      routines: [{ id: 'r1', title: 'Real one', detail: 'Daily' }, { id: 'r1', title: 'Duplicate id', detail: 'x' }, { title: 'Missing id' }, 'not-an-object']
    }));
    expect(repo.read().routines).toEqual([{ id: 'r1', title: 'Real one', detail: 'Daily' }]);
    repo.close();
  });

  it('caps the routine list at MAX_ROUTINES rather than growing unbounded', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `r${i}`, title: `Routine ${i}`, detail: '' }));
    const saved = repo.save({ ...repo.read(), routines: many });
    expect(saved.routines).toHaveLength(50);
    repo.close();
  });

  it('persists a real, user-added affirmation across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({ ...first.read(), affirmations: [{ id: 'a1', text: 'Ship it.' }] });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().affirmations).toEqual([{ id: 'a1', text: 'Ship it.' }]);
    second.close();
  });

  it('drops malformed or duplicate-id affirmation entries rather than throwing', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      affirmations: [{ id: 'a1', text: 'Real one' }, { id: 'a1', text: 'Duplicate id' }, { text: 'Missing id' }, 42]
    }));
    expect(repo.read().affirmations).toEqual([{ id: 'a1', text: 'Real one' }]);
    repo.close();
  });

  it('persists a real, user-added quick-launch link across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({ ...first.read(), quickLaunch: [{ id: 'q1', label: 'Claude', kind: 'link', url: 'https://claude.ai', target: '' }] });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().quickLaunch).toEqual([{ id: 'q1', label: 'Claude', kind: 'link', url: 'https://claude.ai', target: '' }]);
    second.close();
  });

  it('drops a quick-launch entry whose URL is not http(s) — e.g. javascript: — rather than storing it', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      quickLaunch: [{ id: 'q1', label: 'Safe', url: 'https://example.com' }, { id: 'q2', label: 'Unsafe', url: 'javascript:alert(1)' }, { id: 'q3', label: 'No URL' }]
    }));
    expect(repo.read().quickLaunch).toEqual([{ id: 'q1', label: 'Safe', kind: 'link', url: 'https://example.com', target: '' }]);
    repo.close();
  });

  it('defaults a stored quick-launch entry with no kind at all to "link" — back-compat with data saved before app/chrome-profile existed', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      quickLaunch: [{ id: 'q1', label: 'Old-style link', url: 'https://example.com' }]
    }));
    expect(repo.read().quickLaunch).toEqual([{ id: 'q1', label: 'Old-style link', kind: 'link', url: 'https://example.com', target: '' }]);
    repo.close();
  });

  it('persists an "app" quick-launch entry (a local app name, no URL) across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({ ...first.read(), quickLaunch: [{ id: 'q1', label: 'Roblox', kind: 'app', url: '', target: 'Roblox' }] });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().quickLaunch).toEqual([{ id: 'q1', label: 'Roblox', kind: 'app', url: '', target: 'Roblox' }]);
    second.close();
  });

  it('drops an "app" quick-launch entry with no app name, and a "chrome-profile" entry missing either half', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      quickLaunch: [
        { id: 'q1', label: 'No app name', kind: 'app', url: '', target: '' },
        { id: 'q2', label: 'No profile chosen', kind: 'chrome-profile', url: 'https://classroom.google.com', target: '' },
        { id: 'q3', label: 'Real one', kind: 'chrome-profile', url: 'https://classroom.google.com', target: 'Profile 3' }
      ]
    }));
    expect(repo.read().quickLaunch).toEqual([{ id: 'q3', label: 'Real one', kind: 'chrome-profile', url: 'https://classroom.google.com', target: 'Profile 3' }]);
    repo.close();
  });

  it('persists a real focus statement across repository instances, capped at 160 characters', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({ ...first.read(), focusText: 'Ship the release notes' });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().focusText).toBe('Ship the release notes');
    second.close();

    const repo = new ProfileRepository(dbPath);
    repo.save({ ...repo.read(), focusText: 'x'.repeat(300) });
    expect(repo.read().focusText).toHaveLength(160);
    repo.close();
  });

  it('falls back to an empty focus statement for a non-string value rather than throwing', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({ focusText: 42 }));
    expect(repo.read().focusText).toBe('');
    repo.close();
  });

  it('persists real, user-added project and note items across repository instances', () => {
    const dbPath = tempPath();
    const first = new ProfileRepository(dbPath);
    first.save({
      ...first.read(),
      projectItems: [{ id: 'p1', title: 'Pilot rollout', detail: 'Due in 6 days' }],
      noteItems: [{ id: 'n1', title: 'Sprint ideas', detail: 'Last edited today' }]
    });
    first.close();

    const second = new ProfileRepository(dbPath);
    expect(second.read().projectItems).toEqual([{ id: 'p1', title: 'Pilot rollout', detail: 'Due in 6 days' }]);
    expect(second.read().noteItems).toEqual([{ id: 'n1', title: 'Sprint ideas', detail: 'Last edited today' }]);
    second.close();
  });

  it('drops malformed or duplicate-id project/note entries rather than throwing', () => {
    const dbPath = tempPath();
    const repo = new ProfileRepository(dbPath);
    repo['db'].prepare('INSERT OR REPLACE INTO profiles (id, value) VALUES (?, ?)').run('primary', JSON.stringify({
      projectItems: [{ id: 'p1', title: 'Real one', detail: 'x' }, { id: 'p1', title: 'Duplicate id', detail: 'y' }, { title: 'Missing id' }],
      noteItems: ['not-an-object', { id: 'n1', title: 'Real note', detail: '' }]
    }));
    expect(repo.read().projectItems).toEqual([{ id: 'p1', title: 'Real one', detail: 'x' }]);
    expect(repo.read().noteItems).toEqual([{ id: 'n1', title: 'Real note', detail: '' }]);
    repo.close();
  });
});
