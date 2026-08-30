import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { generatePkcePair } from '../src/main/oauth-pkce';

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('generatePkcePair', () => {
  it('derives the challenge as SHA-256(verifier), base64url-encoded with no padding', () => {
    const { verifier, challenge } = generatePkcePair();
    expect(challenge).toBe(base64url(createHash('sha256').update(verifier).digest()));
    expect(challenge).not.toMatch(/[+/=]/);
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('generates a fresh, unpredictable verifier on every call', () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
  });
});
