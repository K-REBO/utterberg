// Deployed origin of this utterberg instance.
// Override at build time with UTTERBERG_ORIGIN env var.
export const UTTERBERG_ORIGIN = (typeof __UTTERBERG_ORIGIN__ !== 'undefined')
  ? __UTTERBERG_ORIGIN__
  : 'http://localhost:4000';

// Codeberg OAuth App client_id.
// Each deployment needs its own Codeberg OAuth App (no client_secret needed — uses PKCE).
export const CLIENT_ID = (typeof __UTTERBERG_CLIENT_ID__ !== 'undefined')
  ? __UTTERBERG_CLIENT_ID__
  : '';

declare const __UTTERBERG_ORIGIN__: string;
declare const __UTTERBERG_CLIENT_ID__: string;
