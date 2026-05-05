// Deployed origin of this utterberg instance.
// Override at build time with UTTERBERG_ORIGIN env var.
export const UTTERBERG_ORIGIN = (typeof __UTTERBERG_ORIGIN__ !== 'undefined')
  ? __UTTERBERG_ORIGIN__
  : 'http://localhost:4000';

// Codeberg OAuth App client_id.
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
