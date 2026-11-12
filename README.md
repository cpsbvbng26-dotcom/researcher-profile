# researcher-profile

種類：ソフトウェア　状態：改訂中

[![検査](https://github.com/cpsbvbng26-dotcom/researcher-profile/actions/workflows/verify.yml/badge.svg)](https://github.com/cpsbvbng26-dotcom/researcher-profile/actions/workflows/verify.yml)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22335692.svg)](https://doi.org/10.5281/zenodo.22335692)

設定ファイルを 1 つ書けば、研究者プロフィールの静的サイトが出ます。

研究者の登録先は researchmap、ORCID、HAL、Google Scholar と分散します。それらを
まとめて見せる場所は、自分で用意するしかありません。その 1 枚を最小の手間で作るための
道具です。

- **依存パッケージなし** — Node.js だけで動きます。`npm install` は不要です
- **外部リクエストゼロ** — 生成されるページは CDN もフォントも読み込みません
- **論文の一覧** — DOI 付きのプレプリントや論文を、修了証と同じ形のカードで並べられます
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
リポジトリの **Settings → Pages → Source** を **GitHub Actions** にします。

## 設定

`profile.json` の項目です。すべて任意で、書かなかった節はページに出力されません。

| 項目 | 内容 |
| --- | --- |
| `name` | 氏名（必須） |
| `nameLatin` | ラテン表記。氏名の下に小さく表示される |
| `initials` | ヘッダーとファビコンに使う 1〜3 文字 |
| `lang` | ページの言語。既定は `ja` |
| `title` / `description` | ページタイトルと説明文 |
| `tagline` | 氏名の下に置く紹介文 |
| `siteUrl` | 公開先の URL。canonical と og:url に使われる |
| `ogImage` | SNS 共有用画像の URL |
| `twitterCard` | 共有したときのカードの型。既定は `summary_large_image`。正方形のロゴを小さく出すなら `summary` |
| `accent` / `accentDark` | 指し色。ライト用とダーク用 |
| `footer` | フッターに出す文字列 |
| `identifiers` | ORCID などの識別子。`{ label, value, url }` の配列 |
| `credentials` | 修了証。`{ name, items: [{ code, title, issuer, url, verify }] }` の配列 |
| `areas` | 領域。`{ name, detail }` の配列 |
| `links` | リンク。`{ name, items: [{ name, note, url }] }` の配列 |
| `labels` | 見出しなどの文言。下記の既定値を個別に上書きできる |
| `sections` | 節をどの順に出すか。書かなかった節は出ない。既定は `["credentials","areas","papers","links"]` |
| `claim` | 主張。`statement` と **`refute`（どうすれば覆るか）** と `rows`。`refute` が無いと生成が止まる |
| `verification` | 検証。`{ note, items: [{ name, detail }] }`。`items` の代わりに `groups: [{ id, name, items }]` と書けば、作品の種類などの群ごとに見出しを置いて並べる |
| `withdrawn` | 撤回。`{ note, items, recordUrl, recordLabel }`。消さずに残すための節である |
| `contact` | 連絡。**`criticism`（批判・誤りの指摘の宛先）が必須**で、他の連絡先より前に出る |
| `works` | 制作物。論文と同じカードの形である |
| `blocks` | 自由記述の節。`{ id, title, html, anchors }` |
| `jsonld` | 構造化データ。そのまま出力に入り、CSP のハッシュも付く |
| `alternates` | 言語ごとの版への `hreflang` |
| `headExtra` | `<head>` にそのまま入れる行 |
| `extraNav` | 手で書いたページへの導線。`{ name, url }` |
| `taglineHtml` | `tagline` の HTML 版 |
| `scripts` | 頁に入れるスクリプトのファイル名の配列。このリポジトリの直下に置いたファイルだけを読み、中身を頁に入れて CSP のハッシュで許す。外へは取りに行かない |
| `asOf` | いつ時点の頁かを示す日付（`YYYY-MM-DD`）。頁の言語に合わせて書き直して出す |
| `profile.aims` | 目標。文字列の配列なら一行ずつ並ぶ。`{ text, when, status }` の配列なら、達成とする時と状態の欄を持つ表になる。表の見出しは `profile.aimsStatusLabel`（三つ） |
| `footerSet` | 頁の下の欄に足す組の名（`footer.json` の `ja`・`en`・`de`・`fr`・`it`）。連絡と免責への道と、中身が変わった日を出す。書かなければ何も足さない |
| `updatedFrom` | 中身が変わった日を取る源のファイル。既定は設定ファイルそのものと `coursesFile` |
| `printCard` | 印刷して一枚に収める体裁（A4、余白 12mm）を足す |
| `lead` / `leadHtml` | 最初の画面に置く一文。その頁が何かを言う文にする。書いた頁では、`tagline` は自己紹介の節の終わりへ移る |
| `entries` | 最初の画面の入口。`{ name, url, note }` の配列で、三つまで。四つ以上書くと生成が止まる |
| `sections` の `profile` | 自己紹介（`profile`）と識別子を、最初の画面から外して一つの節にする。見出しは `profile.label` |
| `sections` の `diagram` と `figure` | 図を一枚置く節。いまは `figure.kind` が `golden-window` のものだけで、`golden-window.js` の計算を生成のときに回して SVG にする |
| `papersLayout` | `table` と書くと、論文を題・年・DOI・状態の表で並べる。各行に `year`（DataCite の発行年）と `catalogId`（`catalog.json` の行）が要り、状態は目録から取る |
| `ogCard` | 共有カードの画像の置き場の URL。正の URL の道筋から画像の名を作り、`og:image` にする。画像はサイトの側で描く |
| `filter` | 頁の中のリンクだけで節を絞り込む。`{ label, all, items: [{ id, name }] }`。絞る節は `blocks` に `filterable: true` を書く |

### 二つの必須

`claim` に `refute` が無いと、`contact` に `criticism` が無いと、生成が止まります。

反証の手順を書けない主張は、主張ではなく宣伝です。批判の宛先を先に書かない連絡先は、
連絡先ではなく飾りです。どちらも、後から足せる注意書きではなく、書かなければ出ない形にしました。

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

日本語以外で使う場合は、`lang` と `labels` を差し替えます。

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

`profile.json` には作者自身の設定が入っています。動作を確かめてから書き換えます。

## 別の設定ファイルを使う

```bash
PROFILE_CONFIG=./others/hanako.json PROFILE_OUT=./dist-hanako node build.js
```

## 雛形として使う

この道具は、ほかの人が自分のサイトを作る雛形として使えます。作者の設定（`profile.json` や `site.json`）を写す必要はありません。
最小の見本は [`examples/minimal.json`](examples/minimal.json) にあります。主張と覆し方、批判の宛先まで入った、そのまま生成できる設定です。

手順は次の五つです。

1. このリポジトリを複製します。GitHub の Fork でも、`git clone` でも同じです。
2. `examples/minimal.json` を写し、名前・識別子・論文・リンクを自分のものに書き換えます。項目は上の「設定」の表にあります。書かなかった節は出ません。
3. `PROFILE_CONFIG=./自分の設定.json PROFILE_OUT=./dist node build.js` で生成します。
4. `node verification/check_build.js` で、設定の形と生成物を確かめます。外へ取りに行く要素が混ざれば、ここで落ちます。
5. `dist/` を GitHub Pages などに置きます。同梱の GitHub Actions は `main` への push で `profile.json` から生成して配信します。自分の設定を `profile.json` に置けば、そのまま使えます。

決まりは二つだけです。主張を書くなら覆し方（`refute`）を、連絡を書くなら批判の宛先（`criticism`）を書きます。どちらも、無ければ生成が止まります。
ライセンスは MIT です。写した先にも、`LICENSE` の権利表示を残します。

```bash
git clone https://github.com/cpsbvbng26-dotcom/researcher-profile.git
cd researcher-profile
cp examples/minimal.json mine.json      # 書き換える
PROFILE_CONFIG=./mine.json PROFILE_OUT=./dist node build.js
node verification/check_build.js
```

## 作者のサイトの決まった手順

### 学期ごとに科目を足す

単位を修得した科目は、`courses.json` に一行ずつ足します。
手順は次の四つです。

1. `courses.json` の該当する学校の `items` に一行足します（科目名・区分・単位・評価）
2. `PROFILE_CONFIG=./site.json PROFILE_OUT=<cpsbvbng26-dotcom> node build.js` で日本語の頁を作り直します（英語・独仏伊も同じ形で）
3. `cpsbvbng26-dotcom` で `node verification/update_readme_courses.js` を回し、README の学歴の欄を作り直します
4. `cpsbvbng26-dotcom` で `node verification/update_csp.js` と `node verification/update_sitemap.js` を回します

README と頁の科目の数は、`cpsbvbng26-dotcom` の検査が突き合わせます。

### 五つの言語を同じ日に直す

トップの頁の設定は、`site.json`・`site.en.json`・`site.de.json`・`site.fr.json`・`site.it.json` の五つです。
一つを直したら、同じ日に残りの四つも直します。
最後に変えた日が一つでも違えば、`verification/check_build.js` が落ちます。
一つの PR の中で、日付をまたいでコミットすることがあります。
そのときは、ずれが一日で、五つを最後に変えたコミットがすべて同じ PR に入っていれば通ります。
別の PR で直したなら、一日のずれでも落ちます。

### 頁の下の欄と、中身が変わった日

頁の下の欄に出す連絡と免責への道は、`footer.json` 一つが持ちます。
連絡は GitHub の issue だけで、個人の連絡先は置きません。
「最終更新」の日は、生成した日ではありません。
頁の源（設定と科目の表）を git が最後に変えた日です。

### 印刷向けの一頁

`card.json` から、名刺の代わりに印刷する一頁（`card.html`）を作ります。
ファイルを配るのではなく、頁をそのまま印刷する体裁です。

### 見た目の決まり

2026-11-12 に決めました。テンプレート（`templates/page.html`）の `<style>` を、`verification/check_build.js` が数えて止めます。

- 字の大きさは `--fs-` の 6 段だけです。12・14・16・20・24 px と、名前の 36 px です。宣言はどれも変数を通します。
- 書体は端末にあるものだけを使います。外から読み込みません。CSP は `default-src 'none'` のままです。
- 頁の幅は `--page`（48rem）、一行の長さは `--measure`（40rem）の二つだけです。40rem は、16 px の字でおよそ 40 字です。例外は目録の表で、列が多いので広げます。
- 指し色は一つです。`--accent` と、それを薄めた二つ（`--accent-soft`・`--accent-wash`）だけを使います。色の値は変数の定義にしか書きません。
- 印刷では頁の上の欄を外し、表の行と塊を途中で切らず、外への URL を後ろに書き出します。
- 顔写真は置きません。頁の上の欄にはロゴだけを置きます。設定に `photo` を書いても、作者のサイトでは検査が落とします。
- 日本語の頁の最初の一文は、その頁が何かを言う文にします。

日本語の文の中の英字と数字の前後には、半角の空白を一つ置きます。かな・漢字と英字・数字が隣り合うところが対象です。全角の括弧・句読点・記号の隣には置きません。
例外は、綴りの決まった固有名（ZEN大学、「30歳魔法使い」）と、`<code>` の中と URL です。
決まりと例外の表は `verification/spacing.js` にあり、`verification/check_text.js` が設定の値を一つずつ見ます。
「模型としてDeGroot」の抜けが見つかったことから決めました。

## 全作品の目録

`catalog.json` から、作品を種類ごとに並べた目録の頁（日英）と、道具の一覧の頁（日英）と、同じ中身の JSON と BibTeX を作ります。
作者のサイトの `catalog.html`・`tools.html`・`catalog.json`・`catalog.bib` は、ここから出ています。

```bash
CATALOG_OUT=../cpsbvbng26-dotcom node build_catalog.js
```

ライセンスの列は手で書きません。置いてあるリポジトリの LICENSE の置き方（`licenceLayout`）から出します。
全体が MIT のリポジトリの中で、中の LICENSE か頁の末尾の表示で CC BY 4.0 にしたディレクトリは、`licenceLayout.exceptions` に書きます。列には「MIT（ただし … は CC BY 4.0）」と出ます。2026-11-12 の法令の点検で足しました（[docs/legal-audit-2026-11-12.md](docs/legal-audit-2026-11-12.md)）。
始めた時期の列も手で書きません。置いてあるリポジトリの最初のコミットの日付（`years.firstCommit`）から出します。
どちらの表も、作者のサイトの横断の検査が、各リポジトリの実物と突き合わせます。

## 仕組み

`build.js` が `profile.json` を読み、`templates/page.html` のプレースホルダを置き換えて
`dist/index.html` を書き出すだけです。生成されるのは CSS と JavaScript を内側に持つ
HTML 1 枚で、外部への通信は発生しません。

テンプレートを直接編集すれば、配色や構成も自由に変えられます。

## 引用

このソフトウェアは Zenodo にアーカイブされ、DOI が付与されています。

> 根本卓哉 (2026). *researcher-profile: 設定ファイル1つから研究者プロフィールの静的サイトを生成するツール* (v1.0.0). Zenodo. https://doi.org/10.5281/zenodo.22335692

```bibtex
@software{nemoto2026researcherprofile,
  author       = {Nemoto, Takuya},
  title        = {researcher-profile: 設定ファイル1つから研究者プロフィールの静的サイトを生成するツール},
  version      = {1.0.0},
  year         = {2026},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.22335692},
  url          = {https://doi.org/10.5281/zenodo.22335692}
}
```

### 保存

ソースコードは [Software Heritage](https://archive.softwareheritage.org/browse/snapshot/83f09cc80821f5cd02bbc89b069753c0c53c110a/releases/?origin_url=https://doi.org/10.5281/zenodo.22335691&snapshot=83f09cc80821f5cd02bbc89b069753c0c53c110a) にも保存されています。

```
swh:1:snp:83f09cc80821f5cd02bbc89b069753c0c53c110a
```

v1.0.0 のソースは、GitHub の側からも [Software Heritage](https://archive.softwareheritage.org/swh:1:dir:93fc4fb09f261ba48f97cd9f6e4ddcc4968dd652;origin=https://github.com/cpsbvbng26-dotcom/researcher-profile;anchor=swh:1:rev:65b3622a15370ce8965a11a721dbf20dcd06cd7e) に保存されています。
識別子は次のとおりです。

```
swh:1:dir:93fc4fb09f261ba48f97cd9f6e4ddcc4968dd652
```

これは v1.0.0 の git の木のハッシュと同じです（`git rev-parse "v1.0.0^{tree}"`）。
保存されたことは、2026-09-29 に errata-check の `.github/workflows/swh-save.yml` で確かめました。

DOI が「この版を指す約束」であるのに対し、SWHID は**中身のハッシュそのもの**です。
この識別子が指すスナップショットの内容は、保存先のサービスに依存せず検証できます。

## 検査

```
node build.js && node verification/check_build.js
```

依存パッケージはありません。push のたびに 70 項目を通します。
秘密情報と個人の連絡先も、`node verification/check_secrets.js` が push のたびに見ます。

この道具の要は「設定ファイル 1 つ」であることで、裏を返すと設定が壊れても、変な HTML が出るまで気づけません。
そこを落とします。

- `profile.json` の必須項目・入れ子の項目・色の書式（`#rrggbb`）・`siteUrl` が https であること・外部 URL に `http://` が混ざっていないこと
- テンプレートの `{{印}}` が生成物に残っていないこと。印を足して `build.js` を直し忘れると、ページに `{{FOO}}` がそのまま出ます。生成は成功したように見えます
- テンプレートの印を `build.js` がすべて扱っていること（生成する前に分かる）
- 修了証・学習領域・リンクの件数が設定と一致すること。**設定に足したのに出ない、を拾います**
- 設定にあるすべての URL が生成物にあること
- 自動で外部を取りに行く要素が無いこと。この道具の売りなので、機械で守ります
- 検証の節を群に分けても、名乗る数を拾う行（`<dt>`）の形が変わらないこと
- `scripts` に書いたファイルが頁に入り、CSP がそのハッシュで許していること。無いファイルや外のディレクトリを書けば生成が止まること
- 見本の設定（`examples/minimal.json`）から頁が生成できること
- 目録の生成で、頁四つと JSON と BibTeX が出て、JSON が設定の作品をすべて挙げること
- 見た目の決まり（字の大きさの段・幅・指し色・印刷・顔写真・最初の一文）を、テンプレートと作者の設定が守っていること
- この検査が名乗る件数が、README と CI の仕事の名前で実際と合うこと

空振りでないことは確認済みです。色名を入れる、欄を消す、`http://` を混ぜる、領域を足したのに出ないようにする、テンプレートに新しい印を足す、外部 script を混ぜる —— 六通り壊して六通りとも落ちました。

## ライセンス

MIT License

このリポジトリが引き、または引用を確かめるために置いている他人の文は、CC BY 4.0 でも MIT でも許諾しておらず、それぞれの権利者のものです。

## 制作について

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)

本リポジトリの実装（`build.js` / `templates/page.html`）は、言語モデルによるコーディング支援ツール
**Claude Code**（Anthropic）を使用して制作しています。設計・内容の確認および最終的な
判断は制作者本人が行っています。

制作過程はリポジトリの履歴から確認できます。

| 確認できること | 方法 |
| --- | --- |
| どのコミットが支援を受けたものか | `git log --author=Claude` |
| 各コミットに紐づく作業セッション | コミットメッセージ末尾の `Claude-Session:` トレーラ |
| 共同作成の記録 | コミットメッセージ末尾の `Co-authored-by:` トレーラ |

言語モデルの使い方を、全リポジトリで同じ形の表にしています。

| 道具 | 使ったところ | 確かめた人 |
| --- | --- | --- |
| Claude Code（Anthropic） | `build.js`・`build_catalog.js`・`build_papers.js`・`templates/page.html`・`verification/` の実装、設定ファイルの文の起こし | 著者 |

なお、**生成されるページ側にはこの表示を入れていません**。生成物は利用者自身の
プロフィールであり、その制作手段を勝手に表明すべきではないためです。

## 安全の問題

[SECURITY.md](SECURITY.md) にあります。
誤りの知らせは、issue の「誤りの知らせ」の様式で受けます。

責任は、法令の定めるとおりです。説明は[免責事項](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/blob/main/DISCLAIMER.md)にあります。
