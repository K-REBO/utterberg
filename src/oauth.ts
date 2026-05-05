import { CLIENT_ID, UTTERBERG_ORIGIN } from './utterberg-config';

export const token = { value: null as null | string };

const TOKEN_KEY = 'utterberg-token';
const VERIFIER_KEY = 'utterberg-pkce-verifier';
const REDIRECT_KEY = 'utterberg-redirect-after-auth';
const CLIENT_ID_KEY = 'utterberg-client-id';

// ---- PKCE helpers ----

function generateVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---- Public API ----

export async function getLoginUrl(redirectBackUrl: string): Promise<string> {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  // コールバック時に URL パラメータから読めなくなる値を localStorage に退避
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(REDIRECT_KEY, redirectBackUrl);
  localStorage.setItem(CLIENT_ID_KEY, CLIENT_ID);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${UTTERBERG_ORIGIN}/utterberg.html`,
    response_type: 'code',
    scope: 'write:issue',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://codeberg.org/login/oauth/authorize?${params}`;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const redirectBack = localStorage.getItem(REDIRECT_KEY);
  // コールバック時は URL に client-id がないため localStorage から復元
  const clientId = localStorage.getItem(CLIENT_ID_KEY) || CLIENT_ID;

  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(REDIRECT_KEY);
  localStorage.removeItem(CLIENT_ID_KEY);

  try {
    if (!verifier) {
      console.error('[utterberg] PKCE verifier not found in localStorage');
    } else if (!clientId) {
      console.error('[utterberg] client_id not found');
    } else {
      const response = await fetch('https://codeberg.org/login/oauth/access_token', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          code,
          redirect_uri: `${UTTERBERG_ORIGIN}/utterberg.html`,
          code_verifier: verifier,
          grant_type: 'authorization_code'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          localStorage.setItem(TOKEN_KEY, data.access_token);
          token.value = data.access_token;
          console.log('[utterberg] token acquired');
        } else {
          console.error('[utterberg] token response:', data);
        }
      } else {
        const text = await response.text().catch(() => '');
        console.error('[utterberg] token exchange failed:', response.status, text);
      }
    }
  } catch (e) {
    console.error('[utterberg] token exchange error:', e);
  } finally {
    // トークン取得成否に関わらず元のページへ戻る
    if (redirectBack && redirectBack !== 'null') {
      window.location.href = redirectBack;
    } else {
      // フォールバック: utterberg のルートに戻る
      window.location.href = UTTERBERG_ORIGIN + '/';
    }
  }
}

export function loadToken(): Promise<string | null> {
  if (token.value) return Promise.resolve(token.value);
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    token.value = stored;
    return Promise.resolve(stored);
  }
  return Promise.resolve(null);
}

export function clearToken(): void {
  token.value = null;
  localStorage.removeItem(TOKEN_KEY);
}
