import { CLIENT_ID, UTTERBERG_ORIGIN } from './utterberg-config';

export const token = { value: null as null | string };

const TOKEN_KEY = 'utterberg-token';

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

function encodeState(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeState(s: string): Record<string, string> | null {
  try {
    // base64url → base64
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// ---- Public API ----

// OAuthのstateパラメータにverifier/redirectBack/clientIdを乗せる
// → localStorage不要 → サードパーティiframeのStorageパーティショニング問題を回避
export async function getLoginUrl(redirectBackUrl: string): Promise<string> {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  const state = encodeState({ v: verifier, r: redirectBackUrl, c: CLIENT_ID });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${UTTERBERG_ORIGIN}/utterberg.html`,
    response_type: 'code',
    scope: 'write:issue',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  });
  return `https://codeberg.org/login/oauth/authorize?${params}`;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const urlParams = new URL(location.href).searchParams;
  const stateParam = urlParams.get('state');
  const state = stateParam ? decodeState(stateParam) : null;

  const verifier = state?.v ?? '';
  const redirectBack = state?.r ?? '';
  const clientId = state?.c ?? CLIENT_ID;

  try {
    if (!verifier || !clientId) {
      console.error('[utterberg] OAuth state missing:', { verifier: !!verifier, clientId: !!clientId });
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
    // 元のページへ戻る（失敗時もリダイレクト）
    window.location.href = (redirectBack && redirectBack !== 'null')
      ? redirectBack
      : UTTERBERG_ORIGIN + '/';
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
