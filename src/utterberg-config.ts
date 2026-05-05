// utterberg.html のURLからベースURLを動的に計算する
// 例: https://K-REBO.github.io/utterberg/utterberg.html → https://K-REBO.github.io/utterberg
function resolveOrigin(): string {
  if (typeof __UTTERBERG_ORIGIN__ !== 'undefined' && __UTTERBERG_ORIGIN__) {
    return __UTTERBERG_ORIGIN__;
  }
  if (typeof location !== 'undefined') {
    return location.origin + location.pathname.replace(/\/utterberg\.html.*$/, '');
  }
  return 'http://localhost:4000';
}

export const UTTERBERG_ORIGIN = resolveOrigin();

// Codeberg OAuth App client_id
// 優先順位: ビルド時定数 > URLパラメータ (scriptタグのclient-id属性から渡される)
function resolveClientId(): string {
  if (typeof __UTTERBERG_CLIENT_ID__ !== 'undefined' && __UTTERBERG_CLIENT_ID__) {
    return __UTTERBERG_CLIENT_ID__;
  }
  return new URL(location.href).searchParams.get('client-id') || '';
}

export const CLIENT_ID = resolveClientId();

declare const __UTTERBERG_ORIGIN__: string;
declare const __UTTERBERG_CLIENT_ID__: string;
