import type { DriveFile, GoogleConnectInput } from '../../shared/contracts';
import { generatePkcePair, runLoopbackAuthorization } from '../oauth-pkce';
import type { AdapterResult } from './jira-adapter';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/gmail.metadata https://www.googleapis.com/auth/drive.metadata.readonly';

export type FetchLike = typeof fetch;

function mapError(status: number | null, body?: string): string {
  if (status === 400 || status === 401) return 'Google did not accept that client ID and secret, or the sign-in was denied. Check the Google Cloud OAuth client configuration.';
  if (status !== null) return `Google responded with an unexpected error (status ${status}).`;
  return body?.match(/network|fetch failed|ENOTFOUND|ECONNREFUSED/i) ? 'Could not reach Google. Check the network connection.' : 'Could not complete the request to Google.';
}

interface GoogleReadResult {
  inboxUnread: number;
  driveRecentFiles: DriveFile[];
}

async function fetchGoogleData(accessToken: string, fetchImpl: FetchLike): Promise<AdapterResult<GoogleReadResult>> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const label = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', { headers });
  if (!label.ok) return { ok: false, error: mapError(label.status) };
  const labelBody = (await label.json()) as { messagesUnread?: number };

  const drive = await fetchImpl('https://www.googleapis.com/drive/v3/files?pageSize=5&orderBy=modifiedTime desc&fields=files(name,modifiedTime,webViewLink)', { headers });
  if (!drive.ok) return { ok: false, error: mapError(drive.status) };
  const driveBody = (await drive.json()) as { files?: DriveFile[] };

  return { ok: true, value: { inboxUnread: labelBody.messagesUnread ?? 0, driveRecentFiles: driveBody.files ?? [] } };
}

export async function connectGoogle(input: GoogleConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ refreshToken: string } & GoogleReadResult>> {
  const pkce = generatePkcePair();
  try {
    const { code, redirectUri } = await runLoopbackAuthorization((redirectUri, state) => {
      const params = new URLSearchParams({
        client_id: input.clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
        code_challenge: pkce.challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state
      });
      return `${AUTHORIZE_URL}?${params.toString()}`;
    });

    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: pkce.verifier }).toString()
    });
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenBody.access_token || !tokenBody.refresh_token) return { ok: false, error: 'Google did not return a refresh token. Try disconnecting any prior authorization for this app at myaccount.google.com and connect again.' };

    const data = await fetchGoogleData(tokenBody.access_token, fetchImpl);
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true, value: { refreshToken: tokenBody.refresh_token, ...data.value! } };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not connect to Google.' };
  }
}

export async function syncGoogle(input: GoogleConnectInput, refreshToken: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<GoogleReadResult>> {
  try {
    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString()
    });
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) return { ok: false, error: 'Google did not return a fresh access token.' };
    return fetchGoogleData(tokenBody.access_token, fetchImpl);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not sync with Google.' };
  }
}
