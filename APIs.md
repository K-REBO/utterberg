# 全体アーキテクチャ

登場人物は3つ：

1. **ブログ（あなたのサイト）**
2. **utterancesのiframe**
3. **GitHub**

流れはこう👇

```
[ブログ]
  ↓ iframe埋め込み
[utterances client]
  ↓ REST API + OAuth
[GitHub]
```

👉 ポイントは「全部フロントでやってる」こと

---

# コア設計（超重要）

## 1. ページ = Issue

各ページを1つのIssueに対応させる

### マッピング方法

utterancesは設定で決められる：

* `pathname`（URLパス）
* `url`
* `title`
* `og:title`

例：

```
/posts/hello-world → Issue title: "posts/hello-world"
```

---

## 2. Issueの検索

GitHub APIでIssueを探す

### 使用API

```
GET /search/issues?q=repo:owner/repo+<条件>
```

例：

```
repo:myname/blog-comments is:issue in:title "posts/hello-world"
```

👉 該当Issueがあればそれを使う

---

## 3. 無ければIssue作成

### API

```
POST /repos/{owner}/{repo}/issues
```

body例：

```json
{
  "title": "posts/hello-world",
  "body": "Auto-created by utterances"
}
```

👉 初回アクセス時に自動生成

---

## 4. コメント取得

### API

```
GET /repos/{owner}/{repo}/issues/{issue_number}/comments
```

レスポンス：

```json
[
  {
    "user": { "login": "user1" },
    "body": "コメント内容",
    "created_at": "..."
  }
]
```

👉 これをDOMにレンダリング

---

## 5. コメント投稿

ここが一番大事

### API

```
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
```

body：

```json
{
  "body": "コメント内容"
}
```

👉 ただし認証が必要

---

# 認証（OAuthの流れ）

ここがutterancesのキモ

## 1. GitHub OAuth App登録

* client_id
* redirect_uri

---

## 2. ログインボタン押す

ユーザーをここに飛ばす：

```
https://github.com/login/oauth/authorize
  ?client_id=XXX
  &scope=public_repo
```

---

## 3. コールバックでcode取得

```
https://your-site/callback?code=XXXX
```

---

## 4. access_token取得

```
POST https://github.com/login/oauth/access_token
```

---

## 5. API呼び出しに付与

```
Authorization: token ACCESS_TOKEN
```

---

# iframe構造

utterancesは**直接JS埋め込みじゃなくiframe**使う

理由：

* トークンを親ページに漏らさない
* CSP回避
* スタイル分離

---

## 親ページ側

```html
<script src="https://utteranc.es/client.js"
        repo="user/repo"
        issue-term="pathname"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
```

👉 これがiframe生成

---

## iframe内でやってること

1. URL受け取る（postMessage）
2. Issue検索
3. コメント取得
4. UI描画
5. 投稿処理

---

# postMessage通信

親ページとiframeの通信

```js
window.parent.postMessage(...)
```

用途：

* ページ識別子送る
* テーマ変更

---

# ラベル戦略

utterancesはIssueにラベル付ける：

```
label: utterances
```

👉 他のIssueと区別するため

---

# rate limit問題

GitHub APIは制限あり：

* 未認証：60 req/h
* 認証あり：5000 req/h

👉 だからログイン重要

---

# セキュリティ設計

* トークンはiframe内に閉じる
* 親ページに渡さない
* localStorage保存（短期）

---

# 最小実装（これやれば動く）

## 必要なもの

* GitHub OAuth App
* コメント用repo

---

## 手順

1. ページID決める
2. Issue検索API叩く
3. なければIssue作る
4. コメント一覧取得
5. OAuthログイン実装
6. コメント投稿API叩く
7. UI作る

---

# 技術的な難所

正直ここ👇

### ① OAuth

* フロントだけでやるとCORSで詰む
* 通常はバックエンド必要

---

### ② Issue検索の精度

* title一致だけだとズレる
* utterancesは工夫してる

---

### ③ UX

* 初回Issue生成の待ち
* ローディング管理

---

# 本質まとめ

utterancesの本質はこれ👇

👉 **「GitHub IssueをKey-Valueストアとして使う」**

* Key = ページURL
* Value = Issue + コメント

---

# Codebergで再現するなら

置き換えればOK：

* GitHub API → Forgejo API
* OAuth → Codeberg OAuth

👉 つまりやることは完全に同じ
