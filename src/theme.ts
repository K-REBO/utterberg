import { UTTERBERG_ORIGIN } from './utterberg-config';

export function loadTheme(theme: string, origin: string): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.setAttribute('crossorigin', 'anonymous');
  // 絶対パスではなく UTTERBERG_ORIGIN ベースにすることで GitHub Pages サブディレクトリに対応
  link.href = `${UTTERBERG_ORIGIN}/stylesheets/themes/${theme}/utterances.css`;
  document.head.appendChild(link);

  addEventListener('message', event => {
    if (event.origin === origin && event.data.type === 'set-theme') {
      link.href = `${UTTERBERG_ORIGIN}/stylesheets/themes/${event.data.theme}/utterances.css`;
    }
  });
}
