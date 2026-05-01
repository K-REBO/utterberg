# utterberg

A lightweight comments widget built on [Codeberg](https://codeberg.org) issues.

utterberg is a port of [utterances](https://utteranc.es) for Codeberg (Forgejo).
OAuth uses PKCE — no backend server required.

## Usage

```html
<script src="https://utterberg.dev/client.js"
        repo="owner/comments-repo"
        issue-term="pathname"
        client-id="YOUR_CODEBERG_OAUTH_CLIENT_ID"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
```

## Setup

1. Create a public Codeberg repository for comments.
2. Register a Codeberg OAuth App (Settings → Applications → OAuth2 Apps).
   - Set redirect URI to `https://utterberg.dev/utterberg.html`
3. Add the script tag to your blog with your `client-id`.
4. Optionally add `utterberg.json` to your repo to restrict origins.

```json
{
  "origins": ["https://your-blog.com"]
}
```

## License

MIT
