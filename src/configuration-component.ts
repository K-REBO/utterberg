import { preferredThemeId, preferredTheme } from './preferred-theme';

export class ConfigurationComponent {
  public readonly element: HTMLFormElement;
  private readonly script: HTMLDivElement;
  private readonly repo: HTMLInputElement;
  private readonly clientId: HTMLInputElement;
  private readonly label: HTMLInputElement;
  private readonly theme: HTMLSelectElement;

  constructor() {
    this.element = document.createElement('form');
    this.element.innerHTML = `
      <h3 id="heading-repository">リポジトリ</h3>
      <p>コメントを保存するCodebergのパブリックリポジトリを指定します。</p>
      <ol>
        <li>リポジトリは <strong>public</strong> である必要があります。</li>
        <li>リポジトリの Settings → Issues が有効になっていることを確認してください。</li>
      </ol>
      <fieldset>
        <div>
          <label for="repo">repo:</label><br/>
          <input id="repo" class="form-control" type="text" placeholder="owner/repo">
          <p class="note">例: <code>yourname/blog-comments</code></p>
        </div>
      </fieldset>

      <h3 id="heading-client-id">OAuth Client ID</h3>
      <p>
        Codeberg → Settings → Applications → OAuth2 Apps でアプリを登録し、
        発行された Client ID を入力してください。<br>
        Redirect URI は <code>https://あなたのサーバー/utterberg.html</code> に設定します。
      </p>
      <fieldset>
        <div>
          <label for="client-id">client-id:</label><br/>
          <input id="client-id" class="form-control" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
          <p class="note">Client Secret は不要です（PKCE OAuth）。</p>
        </div>
      </fieldset>

      <h3 id="heading-mapping">ページ ↔️ Issue マッピング</h3>
      <p>ブログの各ページとCodeberg Issueをどう対応付けるか選びます。</p>
      <fieldset>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="pathname" name="mapping" checked="checked">
            URLパス（pathname）
            <p class="note">ページのURLパスをIssueタイトルとして使います。最もシンプルな設定です。</p>
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="url" name="mapping">
            URL
            <p class="note">ページの完全なURLをIssueタイトルとして使います。</p>
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="title" name="mapping">
            ページタイトル
            <p class="note">ページの <code>&lt;title&gt;</code> をIssueタイトルとして使います。</p>
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="og:title" name="mapping">
            og:title
            <p class="note">OGP の <code>og:title</code> をIssueタイトルとして使います。</p>
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="issue-number" name="mapping">
            Issue番号を直接指定
            <p class="note">特定のIssue番号にコメントを集約します。Issueは自動作成されません。</p>
          </label>
        </div>
        <div class="form-checkbox">
          <label>
            <input type="radio" value="specific-term" name="mapping">
            任意の文字列
            <p class="note">固定の文字列をIssueタイトルとして使います。</p>
          </label>
        </div>
      </fieldset>

      <h3 id="heading-issue-label">Issue ラベル（任意）</h3>
      <fieldset>
        <div>
          <label for="label">label:</label><br/>
          <input id="label" class="form-control" type="text" placeholder="💬 comment">
          <p class="note">ラベルはリポジトリに事前に作成しておく必要があります。</p>
        </div>
      </fieldset>

      <h3 id="heading-theme">テーマ</h3>
      <select id="theme" class="form-select" value="github-light" aria-label="Theme">
        <option value="github-light">GitHub Light</option>
        <option value="github-dark">GitHub Dark</option>
        <option value="preferred-color-scheme">システム設定に合わせる</option>
        <option value="github-dark-orange">GitHub Dark Orange</option>
        <option value="icy-dark">Icy Dark</option>
        <option value="dark-blue">Dark Blue</option>
        <option value="photon-dark">Photon Dark</option>
        <option value="boxy-light">Boxy Light</option>
        <option value="gruvbox-dark">Gruvbox Dark</option>
      </select>

      <h3 id="heading-enable">埋め込みコード</h3>
      <p>以下のscriptタグをブログのテンプレートに貼り付けてください。</p>
      <div class="config-field" id="script"></div>
      <button id="copy-button" type="button" class="btn btn-blue code-action">コピー</button>
      <br/><br/>`;

    this.element.addEventListener('submit', event => event.preventDefault());
    this.element.action = 'javascript:';

    this.script = this.element.querySelector('#script') as HTMLDivElement;
    this.repo = this.element.querySelector('#repo') as HTMLInputElement;
    this.clientId = this.element.querySelector('#client-id') as HTMLInputElement;
    this.label = this.element.querySelector('#label') as HTMLInputElement;
    this.theme = this.element.querySelector('#theme') as HTMLSelectElement;

    const themeStylesheet = document.getElementById('theme-stylesheet') as HTMLLinkElement;
    this.theme.addEventListener('change', () => {
      let theme = this.theme.value;
      if (theme === preferredThemeId) theme = preferredTheme;
      themeStylesheet.href = `/stylesheets/themes/${theme}/index.css`;
      const iframe = document.querySelector('iframe');
      if (iframe) {
        iframe.contentWindow!.postMessage({ type: 'set-theme', theme }, location.origin);
      }
    });

    const copyButton = this.element.querySelector('#copy-button') as HTMLButtonElement;
    copyButton.addEventListener('click', () => this.copyTextToClipboard(this.script.textContent as string));

    this.element.addEventListener('change', () => this.outputConfig());
    this.element.addEventListener('input', () => this.outputConfig());
    this.outputConfig();
  }

  private outputConfig() {
    const mapping = this.element.querySelector('input[name="mapping"]:checked') as HTMLInputElement;
    let mappingAttr: string;
    if (mapping.value === 'issue-number') {
      mappingAttr = this.attr('issue-number', '[Issue番号]');
    } else if (mapping.value === 'specific-term') {
      mappingAttr = this.attr('issue-term', '[任意の文字列]');
    } else {
      mappingAttr = this.attr('issue-term', mapping.value);
    }
    const clientIdVal = this.clientId.value || '[CLIENT_ID]';
    this.script.innerHTML = this.makeScript(
      this.attr('repo', this.repo.value || '[owner/repo]') + '\n' +
      mappingAttr + '\n' +
      this.attr('client-id', clientIdVal) + '\n' +
      (this.label.value ? this.attr('label', this.label.value) + '\n' : '') +
      this.attr('theme', this.theme.value) + '\n' +
      this.attr('crossorigin', 'anonymous'));
  }

  private attr(name: string, value: string) {
    return `<span class="pl-s1">        <span class="pl-e">${name}</span>=<span class="pl-s"><span class="pl-pds">"</span>${value}<span class="pl-pds">"</span></span></span>`;
  }

  private makeScript(attrs: string) {
    return `<pre><span class="pl-s1">&lt;<span class="pl-ent">script</span> <span class="pl-e">src</span>=<span class="pl-s"><span class="pl-pds">"</span>https://utterberg.dev/client.js<span class="pl-pds">"</span></span></span>\n${attrs}\n<span class="pl-s1">        <span class="pl-e">async</span>&gt;</span>\n<span class="pl-s1">&lt;/<span class="pl-ent">script</span>&gt;</span></pre>`;
  }

  private copyTextToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent';
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      // ignore
    }
    document.body.removeChild(textArea);
  }
}
