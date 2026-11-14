# 手を入れるときに

Issue も pull request も歓迎する。登録は要らない。

## この道具が何をするか

`site.json` などの設定を読み、`templates/page.html` に流し込んで静的な頁を出す。
依存パッケージは無い。Node だけで動く。

```
PROFILE_CONFIG=./site.json PROFILE_OUT=./dist/site node build.js
```

## 何を知らせてほしいか

<https://github.com/cpsbvbng26-dotcom/researcher-profile/issues> に立てる。

1. 使った設定（問題が出た部分）
2. 出た出力、または出た頁の該当箇所
3. 期待していた出力

出た頁が壊れている場合は、画面の幅と配色の設定（明暗）も書いてほしい。
頁は五言語ぶん同じ雛形から出るので、一つの直しが五つに効く。それが利点であり、
一つの壊れも五つに効く。

## 直す場所を間違えない

頁は生成物である。出力された `index.html` を直しても、次の生成で消える。
直すのは設定（`*.json`）か雛形（`templates/page.html`）である。

## 変更を出す

```
node build.js        # まず出ること
```

出した頁は、配信先のリポジトリ（`cpsbvbng26-dotcom`）の検査が受け取る。
そちらの検査が通ることまでを確かめてから出す。配色の比、辿りやすさ、
CSP のハッシュ、名乗っている数が、すべて向こうで見られている。

## 通らない変更

- 外部へのリクエストを増やすこと。出力する頁は `default-src 'none'` で動く。
  外部の字体、解析、埋め込みは入れない
- `'unsafe-inline'` を使うこと。`style` は必ずハッシュで許す
- 依存パッケージを足すこと。Node の標準だけで書く方針である

## 支えの範囲と、これからの見込み

- **維持しているのは著者一人である**（根本卓哉）。組織の後ろ盾は無い
- issue への返答は**数日から一週間**を目安とする。約束ではない
- 範囲。設定から静的な頁を出すことに限る。内容管理の画面、投稿機能、
  サーバ側の処理は範囲の外である
- 後方互換。設定の書式は、既にある設定が動かなくなる形では変えない。
  変える必要が出たら版の番号を上げ、README に移行の手順を書く

## ライセンス

[MIT](LICENSE)。手を入れたぶんも同じ条件で扱われる。

## 突き合わせの受付 / Checked intake

2026-12-01 から、誤りの知らせ（`error-report.yml`）は「突き合わせの受付」で確かめる。
人が嘘をつくこと一般は、仕組みでは止められない。受けるのは、申し立てた人がその場で書けない出どころと突き合わせられる申し立てだけで、通らないものと確かめられないものは自動で退ける。
確かめるのは一つだけである。「書いてあること」の語が、「どこか」の欄に書いた所（このリポジトリのファイル、配っている頁、このリポジトリが写しを持つ DOI の PDF か翻刻）に、そのとおりにあること。空白の違いと文字の幅は見ない。頁や節は確かめず、文書の全体を探す。
あればラベル「quote verified」を付ける。それが誤りかどうかは、人が読んで決める。なければ、決まった文のコメントを付けて閉じる。新しい issue で出し直せる。
削除・権利・個人の情報・氏名・人についての記述・同意の撤回を求めると読める issue は、自動では閉じない。ラベル「needs a person」を付け、人が読む。
コメントと実行の記録は、決まった語と issue の番号だけを書き、issue に書かれたことを写さない。
道具は `.github/checked-intake/verify.js`、確かめる先は `.github/checked-intake/config.json` にある。

From 2026-12-01, error reports (`error-report.yml`) are checked by the checked intake.
No system can stop a person from lying in general. Only claims that can be checked against a source that the claimant does not write at the moment of claiming are accepted; a claim that fails, or cannot be checked, is turned away automatically.
One thing is checked: that the words under "What it says" occur, as written, at the location under "Where" (a file of this repository, a page that it serves, or the PDF or transcription of a DOI of which it holds a copy). Differences of white space and character width are ignored. The page or section is not checked; the whole document is searched.
If they occur, the label "quote verified" is added, and whether it is an error is decided by a person. If they do not, the issue is closed with a fixed comment, and a new issue can be opened.
An issue that reads as asking for removal, or concerning rights, personal data, a name, a statement about a person or the withdrawal of a consent, is never closed automatically; it gets the label "needs a person", and a person reads it.
Comments and logs carry only fixed words and the issue number, never what the issue says.
The script is `.github/checked-intake/verify.js`; what it checks against is in `.github/checked-intake/config.json`.
