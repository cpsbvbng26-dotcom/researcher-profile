# researcher-profile

設定ファイルを 1 つ書くだけで、研究者プロフィールの静的サイトを生成します。

研究者は researchmap、ORCID、HAL、Google Scholar と登録先が分散しがちですが、
それらをまとめて見せる場所は自分で用意する必要があります。
このツールは、その 1 枚を最小の手間で作るためのものです。

- **依存パッケージなし** — Node.js だけで動きます。`npm install` は不要です
- **外部リクエストゼロ** — 生成されるページは CDN もフォントも読み込みません
- **ライト / ダーク対応** — 端末の設定に従い、切り替えた選択は記憶されます
- **印刷にも対応** — そのまま PDF にして履歴書に添えられます

## 使い方

```bash
git clone https://github.com/cpsbvbng26-dotcom/researcher-profile.git
cd researcher-profile

# profile.json を自分の内容に書き換えて
node build.js

# dist/index.html ができます
```

生成物は `dist/` に出力されます（`index.html` / `favicon.svg` / `.nojekyll`）。

## 公開する

同梱の GitHub Actions が `main` への push で自動的にビルドし、GitHub Pages へ配信します。
リポジトリの **Settings → Pages → Source** を **GitHub Actions** にしてください。

## 設定

`profile.json` の項目です。すべて任意で、書かなかった節はページに出力されません。

| 項目 | 内容 |
| --- | --- |
| `name` | 氏名（必須） |
| `nameLatin` | ラテン表記。氏名の下に小さく表示されます |
| `initials` | ヘッダーとファビコンに使う 1〜3 文字 |
| `lang` | ページの言語。既定は `ja` |
| `title` / `description` | ページタイトルと説明文 |
| `tagline` | 氏名の下に置く紹介文 |
| `siteUrl` | 公開先の URL。canonical と og:url に使われます |
| `ogImage` | SNS 共有用画像の URL |
| `accent` / `accentDark` | 指し色。ライト用とダーク用 |
| `footer` | フッターに出す文字列 |
| `identifiers` | ORCID などの識別子。`{ label, value, url }` の配列 |
| `credentials` | 修了証。`{ name, items: [{ code, title, issuer, url, verify }] }` の配列 |
| `areas` | 領域。`{ name, detail }` の配列 |
| `links` | リンク。`{ name, items: [{ name, note, url }] }` の配列 |
| `labels` | 見出しなどの文言。下記の既定値を個別に上書きできます |

### `labels` の既定値

```json
{
  "eyebrow": "Profile",
  "credentials": "修了証・資格",
  "credentialsNote": "各カードから発行機関の検証ページを開けます。",
  "areas": "領域",
  "links": "リンク",
  "verify": "確認",
  "skip": "本文へスキップ",
  "themeToggle": "テーマを切り替える"
}
```

日本語以外で使う場合は、`lang` と `labels` を差し替えてください。

### 設定の例

```json
{
  "name": "山田花子",
  "nameLatin": "HANAKO YAMADA",
  "initials": "HY",
  "identifiers": [
    { "label": "ORCID", "value": "0000-0000-0000-0000", "url": "https://orcid.org/0000-0000-0000-0000" }
  ],
  "credentials": [
    {
      "name": "edX",
      "items": [
        { "code": "CS50x", "title": "Introduction to Computer Science", "issuer": "HarvardX", "url": "https://..." }
      ]
    }
  ],
  "links": [
    { "name": "研究者プロフィール", "items": [{ "name": "ORCID", "url": "https://orcid.org/..." }] }
  ]
}
```

`profile.json` には作者自身の設定が入っています。動作を確かめてから書き換えてください。

## 別の設定ファイルを使う

```bash
PROFILE_CONFIG=./others/hanako.json PROFILE_OUT=./dist-hanako node build.js
```

## 仕組み

`build.js` が `profile.json` を読み、`templates/page.html` のプレースホルダを置き換えて
`dist/index.html` を書き出すだけです。生成されるのは CSS と JavaScript を内側に持つ
HTML 1 枚で、外部への通信は発生しません。

テンプレートを直接編集すれば、配色や構成も自由に変えられます。

## ライセンス

MIT License

## 制作について

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)

本リポジトリの実装（`build.js` / `templates/page.html`）は、AIコーディング支援ツール
**Claude Code**（Anthropic）を使用して制作しています。設計・内容の確認および最終的な
判断は制作者本人が行っています。

制作過程はリポジトリの履歴から確認できます。

| 確認できること | 方法 |
| --- | --- |
| どのコミットが支援を受けたものか | `git log --author=Claude` |
| 各コミットに紐づく作業セッション | コミットメッセージ末尾の `Claude-Session:` トレーラ |
| 共同作成の記録 | コミットメッセージ末尾の `Co-authored-by:` トレーラ |

なお、**生成されるページ側にはこの表示を入れていません**。生成物は利用者自身の
プロフィールであり、その制作手段を勝手に表明すべきではないためです。
