import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SecretStore } from '../src/main/secret-store';
import { ConnectorStateRepository } from '../src/main/connector-state-repository';

const fakeCipher = {
  encrypt: (plainText: string) => Buffer.from(Buffer.from(plainText, 'utf8').toString('base64'), 'utf8'),
  decrypt: (cipherText: Buffer) => Buffer.from(cipherText.toString('utf8'), 'base64').toString('utf8')
};

function tempPath(name: string) { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'front-desk-test-')), name); }

describe('SecretStore', () => {
  it('round-trips a secret through the injected cipher and never stores plaintext', () => {
    const dbPath = tempPath('secrets.sqlite');
    const store = new SecretStore(dbPath, fakeCipher);
    const id = store.store('super-secret-token');
    expect(store.read(id)).toBe('super-secret-token');
    store.close();

    const raw = fs.readFileSync(dbPath, 'latin1');
    expect(raw.includes('super-secret-token')).toBe(false);
  });

  it('returns null for an unknown or deleted id', () => {
    const store = new SecretStore(tempPath('secrets.sqlite'), fakeCipher);
    const id = store.store('token');
    store.delete(id);
    expect(store.read(id)).toBeNull();
    expect(store.read('does-not-exist')).toBeNull();
    store.close();
  });
});

const fallbackJiraState = { status: 'disconnected', config: null, lastSyncedAt: null, lastError: null, tickets: [] as unknown[] };

describe('ConnectorStateRepository credential boundary', () => {
  it('never exposes the secret reference through read()', () => {
    const repo = new ConnectorStateRepository(tempPath('connectors.sqlite'));
    repo.write('jira', { status: 'connected', config: { siteUrl: 'https://x.atlassian.net', email: 'a@b.com', jql: 'assignee = currentUser()' }, lastSyncedAt: null, lastError: null, tickets: [] }, 'secret-id-123');
    const state = repo.read('jira', fallbackJiraState);
    expect(JSON.stringify(state)).not.toContain('secret-id-123');
    expect(repo.readSecretRef('jira')).toBe('secret-id-123');
    repo.close();
  });

  it('clearAll removes every connector row', () => {
    const repo = new ConnectorStateRepository(tempPath('connectors.sqlite'));
    repo.write('jira', { status: 'connected', config: { siteUrl: 'https://x.atlassian.net', email: 'a@b.com', jql: 'x' }, lastSyncedAt: null, lastError: null, tickets: [] }, 'ref');
    repo.clearAll();
    expect(repo.read('jira', fallbackJiraState).status).toBe('disconnected');
    repo.close();
  });

  it('falls back instead of returning undefined for a row written before the store was generalized', () => {
    const dbPath = tempPath('connectors.sqlite');
    const repo = new ConnectorStateRepository(dbPath);
    // Pre-generalization rows had the state fields flattened directly, with no `{ value, secretRef }` envelope.
    repo['db'].prepare('INSERT OR REPLACE INTO connector_state (id, value) VALUES (?, ?)').run(
      'jira', JSON.stringify({ status: 'connected', config: { siteUrl: 'https://x.atlassian.net', email: 'a@b.com', jql: 'x' }, secretRef: 'old-ref', lastSyncedAt: null, lastError: null, tickets: [] })
    );
    expect(repo.read('jira', fallbackJiraState)).toEqual(fallbackJiraState);
    repo.close();
  });
});
