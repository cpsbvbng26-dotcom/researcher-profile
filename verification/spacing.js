/* 日本語の文の中の、英字・数字の前後の空白（2026-11-12 に決めた）。
 *
 * **決まりは一つ。**かな・漢字と、英字・数字が隣り合うところには、半角の空白を一つ置く。
 * 全角の括弧・句読点・記号（（）「」、。・：など）の隣には置かない。
 *
 *   よい   2026 年 10 月 13 日、ZEN大学、設定ファイル 1 つ、模型として DeGroot
 *   直す   2026年10月13日、設定ファイル1つ、模型としてDeGroot
 *
 * 例外は三つだけである。
 *   - 固有名。綴りが決まっているもの（EXCEPTIONS の表）。表に足すのは、発行元がそう書いている名だけ。
 *   - <code> の中、タグの中、URL。引用と識別子であって、地の文ではない。
 *   - 構造化データ（jsonld）と、設定の注記（_ で始まる鍵）。頁の地の文ではない。
 *
 * 「模型としてDeGroot」の抜けが見つかったことから決めた（百本ノック五の 438）。
 */
'use strict';

const KANA_KANJI = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々〆';
const GAP = new RegExp(`([${KANA_KANJI}])([A-Za-z0-9])|([A-Za-z0-9])([${KANA_KANJI}])`, 'gu');

/* 綴りが決まっている固有名。空白を入れると別の名になる。 */
const EXCEPTIONS = ['ZEN大学', '30歳魔法使い'];

/* 地の文だけを残す。<code>・URL・固有名は〓一字に置き換え、タグは外す。
 * **タグは消す。**画面では幅を持たないので、「の<b>F」は「のF」と読まれる。空白に置き換えると、
 * タグをまたぐ抜けを見逃す（壊して確かめたときに、実際に見逃した）。 */
function prose(s) {
  let t = String(s)
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, '〓')
    .replace(/https?:\/\/[^\s"<>）)]+/g, '〓')
    /* 塊の要素と改行は、画面でも切れ目になる。一覧の名前と注記（<span> は一覧の中では塊で出る）など。
     * 字の中に入る要素（<b>・<strong>・<a>・<i>）だけを、幅の無いものとして外す。 */
    .replace(/<\/?(?:p|div|li|ul|ol|span|td|th|tr|dd|dt|dl|h[1-6]|br)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;|&#\d+;/g, '〓');
  EXCEPTIONS.forEach((w) => { t = t.split(w).join('〓'); });
  return t;
}

/* 抜けている箇所の一覧。around は、地の文に直したあとの前後の字である。 */
function gaps(s) {
  const t = prose(s);
  return [...t.matchAll(GAP)].map((m) => ({ at: m.index, around: t.slice(Math.max(0, m.index - 8), m.index + 10) }));
}

/* 設定の値のうち、頁の地の文になるものだけを辿る。英語版の欄（…En）と構造化データは見ない。 */
function strings(v, key, out) {
  if (typeof v === 'string') { out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach((x) => strings(x, key, out)); return out; }
  if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => {
      if (k === 'jsonld' || k.startsWith('_') || /(En|Latin)$/.test(k) || k === 'en'
          || /^(url|src|href|doi|id|siteUrl|ogCard|favicon)$/.test(k)) return;
      strings(v[k], k, out);
    });
  }
  return out;
}

module.exports = { gaps, strings, EXCEPTIONS };
