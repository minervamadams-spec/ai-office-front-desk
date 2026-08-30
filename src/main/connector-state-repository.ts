import Database from 'better-sqlite3';

interface StoredRow<T> {
  value: T;
  secretRef: string | null;
}

/** Generic per-connector JSON blob store, keyed by connector id. Callers own their own state shape. */
export class ConnectorStateRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec('CREATE TABLE IF NOT EXISTS connector_state (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  read<T>(id: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM connector_state WHERE id = ?').get(id) as { value?: string } | undefined;
    if (!row?.value) return structuredClone(fallback);
    try {
      const parsed: unknown = JSON.parse(row.value);
      // A row written before the per-connector store was generalized has no `value` envelope at all —
      // treat that shape (and anything else unrecognized) as absent rather than returning undefined.
      if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return structuredClone(fallback);
      return (parsed as StoredRow<T>).value;
    } catch {
      return structuredClone(fallback);
    }
  }

  /** secretRef is persisted alongside the value but is never returned by read() — only readSecretRef() sees it. */
  write<T>(id: string, value: T, secretRef: string | null): void {
    const stored: StoredRow<T> = { value, secretRef };
    this.db.prepare('INSERT OR REPLACE INTO connector_state (id, value) VALUES (?, ?)').run(id, JSON.stringify(stored));
  }

  readSecretRef(id: string): string | null {
    const row = this.db.prepare('SELECT value FROM connector_state WHERE id = ?').get(id) as { value?: string } | undefined;
    if (!row?.value) return null;
    try { return (JSON.parse(row.value) as StoredRow<unknown>).secretRef ?? null; } catch { return null; }
  }

  clear(id: string): void {
    this.db.prepare('DELETE FROM connector_state WHERE id = ?').run(id);
  }

  clearAll(): void {
    this.db.exec('DELETE FROM connector_state');
  }

  close(): void {
    this.db.close();
  }
}
