import type { DriveFile, GoogleConnectInput } from '../../shared/contracts';
import { generatePkcePair, runLoopbackAuthorization } from '../oauth-pkce';
import type { AdapterResult } from './jira-adapter';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/gmail.metadata https://www.googleapis.com/auth/drive.metadata.readonly';

export type FetchLike = typeof fetch;

/** Google's OAuth error codes (RFC 6749 §5.2 plus Google's own) are a fixed, documented vocabulary —
 * safe to surface directly, unlike the rest of a response body which can contain request echoes. */
function mapOAuthErrorCode(code: string): string | null {
  switch (code) {
    case 'access_denied': return 'Google denied this request. If the app is still in "Testing" mode in Google Cloud Console, add this Google account under OAuth consent screen → Audience → Test users.';
    case 'invalid_client': return 'Google did not accept that client ID and secret. Check the Google Cloud OAuth client configuration.';
    case 'invalid_grant': return 'That sign-in has expired or was already used. Try connecting again from the start.';
    case 'unauthorized_client':
    case 'permission_denied':
      return 'Google rejected this request, most likely because the Gmail API and/or Google Drive API are not enabled for this Google Cloud project — enable both under APIs & Services → Library, then try again.';
    default: return null;
  }
}

/** Maps a non-ok HTTP response from Google (status + body) to a human-readable message. */
function mapError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string };
    const mapped = typeof parsed.error === 'string' ? mapOAuthErrorCode(parsed.error) : null;
    if (mapped) return mapped;
  } catch { /* not JSON, or not shaped like an OAuth error — fall through to status-based mapping */ }
  if (status === 400 || status === 401) return 'Google did not accept that client ID and secret, or the sign-in was denied. Check the Google Cloud OAuth client configuration.';
  if (status === 403) return 'Google refused this request (403) — most likely the Gmail API and/or Google Drive API are not enabled for this Google Cloud project. Enable both under APIs & Services → Library, then try again.';
  return `Google responded with an unexpected error (status ${status}).`;
}

/** Maps a *thrown* error (network failure, or one of oauth-pkce's own — already user-facing, like
 * "Timed out waiting for sign-in" or a stale-tab state mismatch) — these aren't an HTTP response, so
 * mapError's status/body-shaped logic doesn't apply. Show our own messages verbatim rather than
 * flattening them into one generic, useless "could not complete the request" for every cause. */
function mapThrownError(error: Error): string {
  return /network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(error.message) ? 'Could not reach Google. Check the network connection.' : error.message;
}

interface GoogleReadResult {
  inboxUnread: number;
  driveRecentFiles: DriveFile[];
}

async function fetchGoogleData(accessToken: string, fetchImpl: FetchLike): Promise<AdapterResult<GoogleReadResult>> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const label = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', { headers });
  if (!label.ok) return { ok: false, error: mapError(label.status, await label.text()) };
  const labelBody = (await label.json()) as { messagesUnread?: number };

  const drive = await fetchImpl('https://www.googleapis.com/drive/v3/files?pageSize=5&orderBy=modifiedTime desc&fields=files(name,modifiedTime,webViewLink)', { headers });
  if (!drive.ok) return { ok: false, error: mapError(drive.status, await drive.text()) };
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
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status, await tokenResponse.text()) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenBody.access_token || !tokenBody.refresh_token) return { ok: false, error: 'Google did not return a refresh token. Try disconnecting any prior authorization for this app at myaccount.google.com and connect again.' };

    const data = await fetchGoogleData(tokenBody.access_token, fetchImpl);
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true, value: { refreshToken: tokenBody.refresh_token, ...data.value! } };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapThrownError(cause) : 'Could not connect to Google.' };
  }
}

export async function syncGoogle(input: GoogleConnectInput, refreshToken: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<GoogleReadResult>> {
  try {
    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString()
    });
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status, await tokenResponse.text()) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) return { ok: false, error: 'Google did not return a fresh access token.' };
    return fetchGoogleData(tokenBody.access_token, fetchImpl);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapThrownError(cause) : 'Could not sync with Google.' };
  }
}
