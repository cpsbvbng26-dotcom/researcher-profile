/**
 * 作者のサイトの意匠（2026-11-14）。
 *
 * **数は全部ここに置く。**帯・節の飾り・年表の棒・ロゴの寸法は、どれもこのファイルの数から描く。
 * build.js はここを呼んで頁に入れる。検査（check_build.js、cpsbvbng26-dotcom の check_ecosystem.js）も
 * ここを呼び、頁に入った SVG が同じ数から描いたものと一字一句同じかを見る。
 *
 * 決まり
 * - 形は長方形と多角形だけで描く。ロゴ（favicon.svg）と同じ作り方である。字形・写真・他所の図案を使わない。
 * - 書体は端末にあるものだけ。字のファイルを置かず、外から読まない。
 * - 色は二組だけ。頁の指し色（--accent）と、ロゴそのものの二色（墨 #16161a・金 #b08d57）である。
 *   ロゴの二色は明暗どちらでも同じにする。ロゴが明暗で色を変えないのと同じである。
 * - 飾りは読み上げない（aria-hidden）。飾りが無くても、CSS が無くても、本文はそのまま読める。
 * - どの学校・機関の標章や色にも似せない。
 *
 * 当てるのは、設定の siteUrl が SITE で始まる頁だけである（作者のサイト）。
 * 予想のサイト（golden-window-conjecture.vercel.app）は重ねる設定で siteUrl が変わるので当たらず、
 * 生成物は一字一句前と同じになる（横断の検査がそこを照らしている）。
 */
'use strict';

const SITE = 'https://cpsbvbng26-dotcom.vercel.app/';

/* ロゴの寸法。cpsbvbng26-dotcom/favicon.svg と同じ数である（横断の検査が突き合わせる）。
 * favicon.svg は手で置いたもので、ここから作り直してはいない。数を写して、飾りの比をここから取る。 */
const LOGO = {
  size: 48, radius: 9, ink: '#16161a', gold: '#b08d57',
  frame: { inset: 7, stroke: 3, radius: 2 },
  bars: [[12.5, 14, 10, 3.6], [15.7, 14, 3.6, 20], [24.5, 14, 3.4, 20], [32.1, 14, 3.4, 20]],
  slant: [[24.5, 14], [27.9, 14], [35.5, 34], [32.1, 34]],
  title: 'Takuya Nemoto',
};

/* 枠の太さと内寸の比。飾りの小さな枠は、ロゴの枠と同じ比で描く。 */
const FRAME_RATIO = LOGO.frame.stroke / (LOGO.size - 2 * LOGO.frame.inset);   // 3 / 34

const r2 = (v) => Math.round(v * 100) / 100;

function logoSvg() {
  const f = LOGO.frame, s = LOGO.size;
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${LOGO.gold}"/>`;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '">'
    + '<title>' + LOGO.title + '</title>'
    + `<rect width="${s}" height="${s}" rx="${LOGO.radius}" fill="${LOGO.ink}"/>`
    + `<rect x="${f.inset}" y="${f.inset}" width="${s - 2 * f.inset}" height="${s - 2 * f.inset}" rx="${f.radius}" fill="none" stroke="${LOGO.gold}" stroke-width="${f.stroke}"/>`
    + LOGO.bars.map((b) => rect(...b)).join('')
    + `<polygon points="${LOGO.slant.map((p) => p.join(',')).join(' ')}" fill="${LOGO.gold}"/>`
    + '</svg>';
}

/* 銘。最初の画面の右肩に、ロゴの枠と字の形を線の色で薄く置く。地の墨は敷かない。
 * 数はロゴと同じ（LOGO）。広い画面だけに出し、狭い画面では消す（CSS）。 */
function sealSvg() {
  const f = LOGO.frame, s = LOGO.size;
  return `<svg class="seal" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-hidden="true" focusable="false">`
    + `<rect x="${f.inset}" y="${f.inset}" width="${s - 2 * f.inset}" height="${s - 2 * f.inset}" rx="${f.radius}" class="seal-frame" stroke-width="${f.stroke}"/>`
    + LOGO.bars.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="seal-fill"/>`).join('')
    + `<polygon points="${LOGO.slant.map((p) => p.join(',')).join(' ')}" class="seal-fill"/>`
    + '</svg>';
}

/* 帯。頁のいちばん上に置く墨の帯で、ロゴの枠を小さくして一列に並べる。
 * 幅は頁に合わせて伸びるので、型（pattern）で繰り返す。 */
const BAND = { height: 8, step: 16, box: 4 };

function bandSvg() {
  const { height: h, step, box } = BAND;
  const sw = r2(Math.max(1, box * FRAME_RATIO * 2.5));
  const x = (step - box) / 2, y = (h - box) / 2;
  return `<svg class="band" width="100%" height="${h}" aria-hidden="true" focusable="false">`
    + `<defs><pattern id="band-frames" width="${step}" height="${h}" patternUnits="userSpaceOnUse">`
    + `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="none" stroke-width="${sw}" class="band-gold-stroke"/>`
    + '</pattern></defs>'
    + `<rect width="100%" height="${h}" class="band-ink"/>`
    + `<rect width="100%" height="${h}" fill="url(#band-frames)"/>`
    + '</svg>';
}

/* 節の飾り。見出しの下に置く。枠を一つ、そこから横へ棒を一本引く。
 * 長いもの（最初の画面の名前の下）と短いもの（節の見出しの下）の二つ。 */
const ORN = { height: 10, box: 9, gap: 4, bar: 1.5, short: 40, long: 96 };

function ornamentSvg(kind) {
  const w = kind === 'long' ? ORN.long : ORN.short;
  const { height: h, box, gap, bar } = ORN;
  const sw = r2(Math.max(1.5, box * FRAME_RATIO * 3));
  const o = sw / 2;
  return `<svg class="orn orn-${kind === 'long' ? 'long' : 'short'}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">`
    + `<rect x="${o}" y="${r2((h - box) / 2 + o)}" width="${r2(box - sw)}" height="${r2(box - sw)}" class="orn-frame" stroke-width="${sw}"/>`
    + `<rect x="${r2(box + gap)}" y="${r2((h - bar) / 2)}" width="${r2(w - box - gap)}" height="${bar}" class="orn-bar"/>`
    + `<polygon points="${r2(box / 2 - 1.5)},${h / 2} ${r2(box / 2)},${r2(h / 2 - 1.5)} ${r2(box / 2 + 1.5)},${h / 2} ${r2(box / 2)},${r2(h / 2 + 1.5)}" class="orn-dot"/>`
    + '</svg>';
}

/* 年表の棒。一行に一本。幅は件数に比例させ、いちばん多い日を BAR.width にする。 */
const BAR = { width: 120, height: 8 };

function barSvg(count, max) {
  const w = max > 0 ? r2(BAR.width * count / max) : 0;
  return `<svg class="tl-bar" viewBox="0 0 ${BAR.width} ${BAR.height}" width="${BAR.width}" height="${BAR.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<rect width="${BAR.width}" height="${BAR.height}" class="tl-track"/>`
    + `<rect width="${w}" height="${BAR.height}" class="tl-fill"/>`
    + '</svg>';
}

/* 色。明暗それぞれの組。ロゴの二色は両方で同じ。
 * 検査（cpsbvbng26-dotcom の check_contrast.js）は、生成した頁からこの値を読んで比を測る。 */
const TOKENS = {
  seal: { '--seal-ink': LOGO.ink, '--seal-gold': LOGO.gold },
  space: { '--sp-1': '.25rem', '--sp-2': '.5rem', '--sp-3': '.75rem', '--sp-4': '1rem', '--sp-5': '1.5rem', '--sp-6': '2rem', '--sp-7': '3rem' },
};

function tokenBlock() {
  const all = Object.assign({}, TOKENS.seal, TOKENS.space);
  return Object.entries(all).map(([k, v]) => `  ${k}: ${v};`).join('\n');
}

/* 意匠の CSS。テンプレートの CSS のあとに足す。字の大きさ・幅・色は、テンプレートと同じ決まりに従う
 * （大きさは --fs-、幅は --measure と --page、色は変数だけ）。check_build.js がここも数える。 */
function css() {
  return [
    '/* ---------- 意匠（design.js、2026-11-14） ---------- */',
    ':root {',
    tokenBlock(),
    '}',
    /* 帯。頁の上の欄の上端に一本。墨の地に金の小さな枠を並べる。 */
    'header { border-bottom: 1px solid var(--line); }',
    '.band { display: block; }',
    '.band-ink { fill: var(--seal-ink); }',
    '.band-gold-stroke { stroke: var(--seal-gold); }',
    /* 最初の画面。名前の下に長い飾りを置き、ローマ字の字間を詰める。 */
    '.hero .orn-long { display: block; margin: 0 0 var(--sp-5); }',
    '.hero { position: relative; }',
    '.seal { display: none; }',
    '.seal-frame { fill: none; stroke: var(--line); }',
    '.seal-fill { fill: var(--line); }',
    '@media (min-width: 62rem) {',
    '  .hero .seal { display: block; position: absolute; top: 4.5rem; right: 1.5rem; width: 7rem; height: 7rem; }',
    '}',
    '.hero .romaji { margin-bottom: var(--sp-4); }',
    '.orn-frame { fill: none; stroke: var(--accent); }',
    '.orn-bar, .orn-dot { fill: var(--accent); }',
    /* 節の見出し。テンプレートの短い棒（::after）を、枠のある飾りに替える。 */
    '.sec-head h2::after, .profile-section .profile-label::after { content: none; }',
    '.sec-head .orn-short, .profile-section .orn-short { display: block; margin-top: var(--sp-3); }',
    '.sec-head h2::before, .profile-section .profile-label::before { color: var(--accent); }',
    /* 入口。上端に指し色の細い線を引き、札に見せる。 */
    '.entries a { border-top: 2px solid var(--accent); border-radius: 0 0 .5rem .5rem; }',
    /* カード。修了証・制作物・論文ノートの札。上端の線で揃える。 */
    '.cert { border-top: 2px solid var(--accent); border-radius: 0 0 .5rem .5rem; }',
    '.cert .code { display: inline-block; align-self: flex-start; padding: 0 var(--sp-2); border: 1px solid var(--line); border-radius: .2rem; }',
    '.cert .doi { padding-top: var(--sp-2); border-top: 1px dashed var(--line); }',
    /* 論文の表を、一篇ずつの札に組み直す。中身と並びは表のまま（題・年・DOI・状態）。
     * 表の見出しは、各欄の前の札（data-label）として出す。狭い画面の組み方を、広い画面にも使う。 */
    '.works-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
    '.works-table, .works-table tbody { display: block; width: 100%; }',
    '.works-table tbody { display: grid; gap: var(--sp-4); }',
    '.works-table tr { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-2) var(--sp-4);'
      + ' padding: var(--sp-4) var(--sp-5); background: var(--card); border: 1px solid var(--line);'
      + ' border-left: 3px solid var(--accent); border-radius: 0 .5rem .5rem 0; }',
    '.works-table td { display: block; padding: 0; border: 0; }',
    '.works-table .t-title { flex: 1 1 100%; width: 100%; }',
    '.works-table td[data-label] { font-size: var(--fs-xs); }',
    '.works-table td[data-label]::before { content: attr(data-label); display: inline-block; margin-right: var(--sp-2);'
      + ' font-family: var(--font-sans); font-size: var(--fs-xs); letter-spacing: .06em; color: var(--faint); }',
    '.works-table .t-state { padding: 0 var(--sp-2); border: 1px solid var(--accent); border-radius: 999px; color: var(--text); }',
    '.works-table .t-state::before { content: none; }',
    /* 年表。記録した日ごとの件数。日・棒・件数を一行に並べる。棒は飾りで、件数は字で出る。 */
    '.timeline { margin: var(--sp-6) 0 0; max-width: var(--measure); }',
    '.timeline-head { margin: 0 0 var(--sp-3); font-size: var(--fs-sm); color: var(--muted); }',
    '.timeline ol { list-style: none; margin: 0; padding: 0 0 0 var(--sp-4); border-left: 1px solid var(--line); }',
    '.timeline li { position: relative; display: grid; grid-template-columns: 6.5rem minmax(0, 1fr) 3.5rem; gap: var(--sp-3); align-items: center;'
      + ' padding: var(--sp-1) 0; font-size: var(--fs-sm); line-height: 1.6; }',
    '.timeline li::before { content: ""; position: absolute; left: calc(-1 * var(--sp-4) - .25rem); top: 50%; width: .5rem; height: .5rem;'
      + ' margin-top: -.25rem; background: var(--bg); border: 1px solid var(--accent); transform: rotate(45deg); }',
    '.timeline time { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--muted); }',
    '.timeline .tl-bar { display: block; width: 100%; height: .5rem; }',
    '.timeline .tl-track { fill: var(--line-soft); }',
    '.timeline .tl-fill { fill: var(--accent); }',
    '.timeline .tl-count { text-align: right; color: var(--text); }',
    '.timeline-total { margin: var(--sp-3) 0 0; padding-left: var(--sp-4); font-size: var(--fs-sm); color: var(--text); border-left: 2px solid var(--accent); }',
    /* 頁の下の欄。帯を細くもう一度置く代わりに、上端を金の線にする。 */
    'footer { border-top: 2px solid var(--seal-gold); }',
    '@media (max-width: 40rem) {',
    '  .works-table tr { padding: var(--sp-3) var(--sp-4); }',
    '  .works-table td { width: auto; }',
    '  .works-table .t-title { width: 100%; }',
    '  .works-table td[data-label]::before { min-width: 0; }',
    '  .timeline li { grid-template-columns: 5.5rem minmax(0, 1fr) 3rem; gap: var(--sp-2); }',
    '}',
    /* 紙。帯は刷らない。飾りと罫は、テンプレートの印刷の色（指し色が黒）で刷る。札は地を塗らず、途中で切らない。 */
    '@media print {',
    '  :root, :root[data-theme="dark"] { --seal-ink: #000; --seal-gold: #000; }',
    '  .band { display: none; }',
    '  .works-table tr, .timeline li { break-inside: avoid; }',
    '  .works-table tr { background: none; }',
    '  footer { border-top-width: 1px; }',
    '}',
  ].join('\n') + '\n';
}

/* 作者のサイトの頁か。重ねる設定のあとの siteUrl で決める。 */
function applies(profile) {
  return typeof (profile && profile.siteUrl) === 'string' && profile.siteUrl.indexOf(SITE) === 0;
}

module.exports = { SITE, LOGO, BAND, ORN, BAR, TOKENS, FRAME_RATIO, logoSvg, sealSvg, bandSvg, ornamentSvg, barSvg, css, applies };
