// utterberg token exchange proxy
// Codeberg の /login/oauth/access_token は CORS ヘッダーを返さないため
// ブラウザから直接呼べない。このWorkerがCORSプロキシとして仲介する。
// client_secret は不要（PKCE）なので Workerに秘密情報なし。

const CODEBERG_TOKEN_URL = 'https://codeberg.org/login/oauth/access_token';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    const body = await request.json();
    const response = await fetch(CODEBERG_TOKEN_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  },
};
