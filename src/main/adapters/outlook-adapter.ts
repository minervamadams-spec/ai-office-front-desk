import type { OutlookConnectInput, OutlookMessage } from '../../shared/contracts';
import { generatePkcePair, runLoopbackAuthorization } from '../oauth-pkce';
import type { AdapterResult } from './jira-adapter';

const SCOPE = 'offline_access Mail.Read';

export type FetchLike = typeof fetch;

function authorizeUrl(tenant: string): string { return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`; }
function tokenUrl(tenant: string): string { return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`; }

function mapError(status: number | null, body?: string): string {
  if (status === 400 || status === 401) return 'Microsoft did not accept that client ID, or the sign-in was denied. Check the Azure app registration configuration.';
  if (status !== null) return `Microsoft responded with an unexpected error (status ${status}).`;
  return body?.match(/network|fetch failed|ENOTFOUND|ECONNREFUSED/i) ? 'Could not reach Microsoft. Check the network connection.' : 'Could not complete the request to Microsoft.';
}

interface OutlookReadResult {
  inboxUnread: number;
  recentMessages: OutlookMessage[];
}

async function fetchOutlookData(accessToken: string, fetchImpl: FetchLike): Promise<AdapterResult<OutlookReadResult>> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const folder = await fetchImpl("https://graph.microsoft.com/v1.0/me/mailFolders('inbox')?$select=unreadItemCount", { headers });
  if (!folder.ok) return { ok: false, error: mapError(folder.status) };
  const folderBody = (await folder.json()) as { unreadItemCount?: number };

  const messages = await fetchImpl('https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=subject,from,receivedDateTime&$orderby=receivedDateTime desc', { headers });
  if (!messages.ok) return { ok: false, error: mapError(messages.status) };
  const messagesBody = (await messages.json()) as { value?: Array<{ subject?: string; from?: { emailAddress?: { name?: string } }; receivedDateTime?: string }> };
  const recentMessages: OutlookMessage[] = (messagesBody.value ?? []).map((m) => ({
    subject: m.subject ?? '(no subject)', from: m.from?.emailAddress?.name ?? 'Unknown', receivedDateTime: m.receivedDateTime ?? ''
  }));

  return { ok: true, value: { inboxUnread: folderBody.unreadItemCount ?? 0, recentMessages } };
}

export async function connectOutlook(input: OutlookConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ refreshToken: string } & OutlookReadResult>> {
  const pkce = generatePkcePair();
  try {
    const { code, redirectUri } = await runLoopbackAuthorization((redirectUri, state) => {
      const params = new URLSearchParams({
        client_id: input.clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
        code_challenge: pkce.challenge, code_challenge_method: 'S256', state
      });
      return `${authorizeUrl(input.tenant)}?${params.toString()}`;
    });

    const tokenResponse = await fetchImpl(tokenUrl(input.tenant), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, code, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: pkce.verifier, scope: SCOPE }).toString()
    });
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenBody.access_token || !tokenBody.refresh_token) return { ok: false, error: 'Microsoft did not return a refresh token. Confirm "offline_access" is permitted for this app registration.' };

    const data = await fetchOutlookData(tokenBody.access_token, fetchImpl);
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true, value: { refreshToken: tokenBody.refresh_token, ...data.value! } };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not connect to Microsoft.' };
  }
}

export async function syncOutlook(input: OutlookConnectInput, refreshToken: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<OutlookReadResult>> {
  try {
    const tokenResponse = await fetchImpl(tokenUrl(input.tenant), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, refresh_token: refreshToken, grant_type: 'refresh_token', scope: SCOPE }).toString()
    });
    if (!tokenResponse.ok) return { ok: false, error: mapError(tokenResponse.status) };
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) return { ok: false, error: 'Microsoft did not return a fresh access token.' };
    return fetchOutlookData(tokenBody.access_token, fetchImpl);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not sync with Microsoft.' };
  }
}
