# utterberg

[utterances](https://utteranc.es) のCodeberg移植版。Codebergのissueをコメントストアとして使う軽量コメントウィジェット。

**utterancesとの違い：**
- バックエンド不要（PKCE OAuth でブラウザのみで完結）
- `client_secret` 不要（公開しても安全な `client_id` のみ）
- Codeberg / Forgejo 対応

---

## セットアップ

### 1. Codeberg OAuth App を登録

Codeberg → Settings → Applications → OAuth2 Apps → Create

| 項目 | 値 |
|------|-----|
| Application Name | 任意 |
| Redirect URIs | `https://あなたのutterbergサーバー/utterberg.html` |

発行される **Client ID** をメモします（Client Secret は不要）。

### 2. コメント用リポジトリを用意

Codebergに **public** リポジトリを作成し、Issueを有効にします。

オプション: リポジトリのルートに `utterberg.json` を置いて投稿を許可するオリジンを制限できます。

```json
{
  "origins": ["https://your-blog.com"]
}
```

### 3. ブログに埋め込む

```html
<script src="https://あなたのutterbergサーバー/client.js"
        repo="codeberg-user/comments-repo"
        issue-term="pathname"
        client-id="YOUR_OAUTH_CLIENT_ID"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
```

---

## テーマ

| 値 | 説明 |
|----|------|
| `github-light` | GitHub ライト（デフォルト） |
| `github-dark` | GitHub ダーク |
| `github-dark-orange` | GitHub ダークオレンジ |
| `dark-blue` | ダークブルー |
| `icy-dark` | アイシーダーク |
| `photon-dark` | フォトンダーク |
| `boxy-light` | ボクシーライト |
| `gruvbox-dark` | Gruvbox ダーク |

---

## issue-term マッピング

| 値 | issueタイトルの内容 |
|----|-------------------|
| `pathname` | URLパス |
| `url` | ページURL |
| `title` | ページタイトル |
| `og:title` | OGP タイトル |
| `<任意文字列>` | 指定した文字列そのまま |

`issue-number` で直接issue番号を指定することも可能です。

---

## 開発

```bash
npm install

# 開発サーバー (localhost:4000)
node node_modules/.bin/parcel serve \
  src/utterberg.html src/client.ts src/test.html \
  src/stylesheets/themes/github-light/utterances.scss \
  --port 4000

# ビルド
npm run build
```

テストページ: `http://localhost:4000/test.html`  
デモページ: `http://localhost:4000/demo.html`

---

## アーキテクチャ

```
[ブログ]
  ↓ <script src="client.js"> → iframe生成
[utterberg iframe (utterberg.html)]
  ↓ Codeberg OAuth (PKCE) + Forgejo API v1
[Codeberg]
```

- `client.ts` — 埋め込みスクリプト。scriptタグの属性を読んでiframeを生成。
- `utterberg.html/ts` — iframeの中身。Forgejo APIでissue/コメントを読み書き。
- `oauth.ts` — PKCE実装。`client_secret` 不要。
- `codeberg.ts` — Forgejo API v1 クライアント。

---

## License

MIT
