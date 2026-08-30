import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { shell } from 'electron';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkcePair(): PkcePair {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export interface LoopbackAuthResult {
  code: string;
  redirectUri: string;
}

const CALLBACK_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Opens `authorizeUrl` (with a loopback redirect_uri appended) in the system browser and waits for
 * the single OAuth callback request. Used by every provider's authorization-code+PKCE flow so each
 * adapter only has to build its own authorize URL and token exchange.
 */
export function runLoopbackAuthorization(buildAuthorizeUrl: (redirectUri: string, state: string) => string): Promise<LoopbackAuthResult> {
  const state = base64url(randomBytes(16));
  let redirectUri = '';
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body style="font-family: system-ui; padding: 40px; text-align: center;">You can close this window and return to AI Office Front Desk.</body></html>');
      server.close();
      clearTimeout(timeout);
      if (error) { reject(new Error(`The provider declined the request: ${error}`)); return; }
      if (returnedState !== state || !code) { reject(new Error('The authorization response did not match this request.')); return; }
      resolve({ code, redirectUri });
    });

    const timeout = setTimeout(() => { server.close(); reject(new Error('Timed out waiting for sign-in. Try connecting again.')); }, CALLBACK_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { reject(new Error('Could not start the local sign-in listener.')); return; }
      redirectUri = `http://127.0.0.1:${address.port}/callback`;
      void shell.openExternal(buildAuthorizeUrl(redirectUri, state));
    });

    server.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}
