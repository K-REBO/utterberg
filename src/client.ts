import { ResizeMessage } from './measure';
import { preferredThemeId, preferredTheme } from './preferred-theme';

let script = document.currentScript as HTMLScriptElement;
if (script === undefined) {
  script = document.querySelector(
    'script[src*="/client.js"]'
  ) as HTMLScriptElement;
}

// gather script element's attributes
const attrs: Record<string, string> = {};
for (let i = 0; i < script.attributes.length; i++) {
  const attribute = script.attributes.item(i)!;
  attrs[attribute.name.replace(/^data-/, '')] = attribute.value;
}
if (attrs.theme === preferredThemeId) {
  attrs.theme = preferredTheme;
}

// OAuth後: URLハッシュにトークンが含まれていればiframeに渡してURLから除去
const hash = new URLSearchParams(location.hash.slice(1));
const oauthToken = hash.get('utterberg');
if (oauthToken) {
  attrs['utterberg-token'] = oauthToken;
  history.replaceState(null, document.title, location.href.split('#')[0]);
}

// gather page attributes
const url = new URL(location.href);
const canonicalLink = document.querySelector(`link[rel='canonical']`) as HTMLLinkElement;
attrs.url = canonicalLink ? canonicalLink.href : url.origin + url.pathname + url.search;
attrs.origin = url.origin;
attrs.pathname = url.pathname.length < 2 ? 'index' : url.pathname.substr(1).replace(/\.\w+$/, '');
attrs.title = document.title;
const descriptionMeta = document.querySelector(`meta[name='description']`) as HTMLMetaElement;
attrs.description = descriptionMeta ? descriptionMeta.content : '';
const len = encodeURIComponent(attrs.description).length;
if (len > 1000) {
  attrs.description = attrs.description.substr(0, Math.floor(attrs.description.length * 1000 / len));
}
const ogtitleMeta = document.querySelector(`meta[property='og:title'],meta[name='og:title']`) as HTMLMetaElement;
attrs['og:title'] = ogtitleMeta ? ogtitleMeta.content : '';

document.head.insertAdjacentHTML(
  'afterbegin',
  `<style>
    .utterberg {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
    }
    .utterberg-frame {
      color-scheme: light;
      position: absolute;
      left: 0;
      right: 0;
      width: 1px;
      min-width: 100%;
      max-width: 100%;
      height: 100%;
      border: 0;
    }
  </style>`);

// iframeのsrc用ベースURL（パス込み）: https://K-REBO.github.io/utterberg
const utterbergBase = script.src.replace(/\/client\.js.*$/, '');
// postMessage比較用origin（パスなし）: https://K-REBO.github.io
const utterbergOrigin = new URL(script.src).origin;
const frameUrl = `${utterbergBase}/utterberg.html`;
script.insertAdjacentHTML(
  'afterend',
  `<div class="utterberg">
    <iframe class="utterberg-frame" title="Comments" scrolling="no" src="${frameUrl}?${new URLSearchParams(attrs)}" loading="lazy"></iframe>
  </div>`);
const container = script.nextElementSibling as HTMLDivElement;
script.parentElement!.removeChild(script);

addEventListener('message', event => {
  if (event.origin !== utterbergOrigin) return;
  const data = event.data as ResizeMessage;
  if (data && data.type === 'resize' && data.height) {
    container.style.height = `${data.height}px`;
  }
});
