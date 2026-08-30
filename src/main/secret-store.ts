import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export interface SecretCipher {
  encrypt(plainText: string): Buffer;
  decrypt(cipherText: Buffer): string;
}

/**
 * Stores only opaque, OS-key-encrypted blobs. Callers get back an id, never the plaintext,
 * so a caller that only holds a ConnectorState (which carries this id) can never leak a token.
 */
export class SecretStore {
  private readonly db: DatabaseSync;

  constructor(path: string, private readonly cipher: SecretCipher) {
    this.db = new DatabaseSync(path);
    this.db.exec('CREATE TABLE IF NOT EXISTS secrets (id TEXT PRIMARY KEY, ciphertext BLOB NOT NULL)');
  }

  store(plainText: string): string {
    const id = randomUUID();
    this.db.prepare('INSERT INTO secrets (id, ciphertext) VALUES (?, ?)').run(id, this.cipher.encrypt(plainText));
    return id;
  }

  read(id: string): string | null {
    const row = this.db.prepare('SELECT ciphertext FROM secrets WHERE id = ?').get(id) as { ciphertext?: Buffer } | undefined;
    if (!row?.ciphertext) return null;
    return this.cipher.decrypt(Buffer.from(row.ciphertext));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM secrets WHERE id = ?').run(id);
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM secrets');
  }

  close(): void {
    this.db.close();
  }
}
