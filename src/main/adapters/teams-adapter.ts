import type { TeamsConnectInput, TeamsItem } from '../../shared/contracts';
import { generatePkcePair, runLoopbackAuthorization } from '../oauth-pkce';
import type { AdapterResult } from './jira-adapter';

const SCOPE = 'offline_access Chat.Read';

export type FetchLike = typeof fetch;

function authorizeUrl(tenant: string): string { return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`; }
function tokenUrl(tenant: string): string { return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`; }

function mapError(status: number | null, body?: string): string {
  if (status === 400 || status === 401) return 'Microsoft did not accept that client ID, or the sign-in was denied. Check the Azure app registration configuration.';
  if (status === 403) return 'Microsoft rejected this request — an admin may need to approve the Chat.Read permission for this organization.';
  if (status !== null) return `Microsoft responded with an unexpected error (status ${status}).`;
  return body?.match(/network|fetch failed|ENOTFOUND|ECONNREFUSED/i) ? 'Could not reach Microsoft. Check the network connection.' : 'Could not complete the request to Microsoft.';
}

/** Logs Microsoft's actual error/error_description to the console for diagnosis — never surfaced
 * to the user, who would just see AADSTS jargon they can't act on. */
async function logErrorBody(response: Response): Promise<void> {
  try {
    const body = (await response.json()) as { error?: string; error_description?: string };
    if (body?.error || body?.error_description) console.error(`[teams] Microsoft token error (status ${response.status}):`, body.error, '-', body.error_description);
  } catch { /* not JSON, nothing to log */ }
}

/** Strips HTML formatting from a Teams message body for a plain-text preview — this app never
 * renders connector content as HTML, so tags are removed rather than sanitized-and-rendered. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchTeamsData(accessToken: string, fetchImpl: FetchLike): Promise<AdapterResult<TeamsItem[]>> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  const response = await fetchImpl('https://graph.microsoft.com/v1.0/me/chats/getAllMessages?$top=20', { headers });
  if (!response.ok) { await logErrorBody(response); return { ok: false, error: mapError(response.status) }; }
  const body = (await response.json()) as { value?: Array<{ chatId?: string; from?: { user?: { displayName?: string } }; body?: { content?: string }; createdDateTime?: string; webUrl?: string }> };
  const items: TeamsItem[] = (body.value ?? [])
    .filter((message) => message.body?.content)
    .map((message) => ({
      chat: message.chatId ?? 'unknown',
      author: message.from?.user?.displayName ?? 'Unknown',
      preview: stripHtml(message.body?.content ?? '').slice(0, 140),
      timestamp: message.createdDateTime ?? '',
      url: message.webUrl ?? ''
    }));
  return { ok: true, value: items };
}

export async function connectTeams(input: TeamsConnectInput, fetchImpl: FetchLike = fetch): Promise<AdapterResult<{ refreshToken: string; items: TeamsItem[] }>> {
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
    if (!tokenResponse.ok) { await logErrorBody(tokenResponse); return { ok: false, error: mapError(tokenResponse.status) }; }
    const tokenBody = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
    if (!tokenBody.access_token || !tokenBody.refresh_token) return { ok: false, error: 'Microsoft did not return a refresh token. Confirm "offline_access" is permitted for this app registration.' };

    const data = await fetchTeamsData(tokenBody.access_token, fetchImpl);
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true, value: { refreshToken: tokenBody.refresh_token, items: data.value! } };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not connect to Microsoft.' };
  }
}

export async function syncTeams(input: TeamsConnectInput, refreshToken: string, fetchImpl: FetchLike = fetch): Promise<AdapterResult<TeamsItem[]>> {
  try {
    const tokenResponse = await fetchImpl(tokenUrl(input.tenant), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, refresh_token: refreshToken, grant_type: 'refresh_token', scope: SCOPE }).toString()
    });
    if (!tokenResponse.ok) { await logErrorBody(tokenResponse); return { ok: false, error: mapError(tokenResponse.status) }; }
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) return { ok: false, error: 'Microsoft did not return a fresh access token.' };
    return fetchTeamsData(tokenBody.access_token, fetchImpl);
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? mapError(null, cause.message) : 'Could not sync with Microsoft.' };
  }
}
