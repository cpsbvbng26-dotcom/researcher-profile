/**
 * 予想のサイト（golden-window-conjecture.vercel.app）の意匠（2026-11-23）。
 *
 * 作者のサイトの意匠（design.js）は、設定の siteUrl が作者のサイトの頁にだけ当たる。
 * こちらは、重ねる設定（golden-window.site.json）で siteUrl が予想のサイトになった頁にだけ当たる。
 * 作者のサイトの頁（cpsbvbng26-dotcom の生成物）は、一字一句前と同じになる。
 *
 * **数は全部ここで式から出す。**手で並べない。
 * - 帯と節の飾り：区間を三つに分けて両端の二つを残す操作を繰り返した列（カントール集合の作り方）。
 *   残す長さの比は 1/φ² = 2 − φ である。予想のサイトのロゴ（trinity-operator/site/favicon.svg）の
 *   「窓の枠と、一段ごとに隙間で二つに割れる三段の帯」と同じ作り方で、ロゴは比を 0.38 に丸めている。
 *   飾りであって、予想の集合 T_δ の図ではない（T_δ の図は golden-window.js が描く）。
 * - 最初の画面の右肩：黄金比の長方形を正方形で切り分け、四分の一の円弧をつないだ渦。
 *
 * 決まり
 * - 形は長方形と道（path：直線と円弧）だけで描く。字形・写真・他所の図案を使わない。
 * - 色は、頁の変数（--accent・--line・--line-soft）と、ロゴの二色（墨 #161a23・金 #c9a13b）だけ。
 *   ロゴの二色は明暗どちらでも同じにする。trinity-operator の check_site.py が favicon.svg の色と突き合わせる。
 * - 飾りは読み上げない（aria-hidden）。飾りが無くても、CSS が無くても、本文はそのまま読める。
 * - 文面は変えない。予想の状態・命題・注の字は、頁の設定のまま出る。
 */
'use strict';

const SITE = 'https://golden-window-conjecture.vercel.app/';
const PHI = (1 + Math.sqrt(5)) / 2;
/* 残す長さの比。1/φ² = 2 − φ。 */
const KEEP = 2 - PHI;

/* ロゴの二色。trinity-operator/site/favicon.svg の塗りと同じ（向こうの検査が突き合わせる）。 */
const LOGO = { ink: '#161a23', gold: '#c9a13b' };

const r2 = (v) => Math.round(v * 100) / 100;

/* 区間 [0, 1] から始めて、両端の比 KEEP の二つを残す操作を n 回当てた区間の列。 */
function cantor(n) {
  let cur = [[0, 1]];
  for (let k = 0; k < n; k++) {
    const next = [];
    cur.forEach(([a, b]) => {
      const s = (b - a) * KEEP;
      next.push([a, a + s], [b - s, b]);
    });
    cur = next;
  }
  return cur;
}

/* 段を重ねた図。levels の各段を一行にし、行の高さ row、行の間 gap で上から積む。 */
function rows(width, levels, row, gap, top, cls) {
  return `<g class="${cls}">` + levels.map((n, i) => cantor(n).map(([a, b]) =>
    `<rect x="${r2(a * width)}" y="${r2(top + i * (row + gap))}" width="${r2((b - a) * width)}" height="${row}"/>`).join('')).join('') + '</g>';
}

/* 帯。頁の上の欄の上端に置く墨の帯。金で、二段目から四段目までの区間を三行に積む。
 * 幅は頁に合わせて横にだけ伸びる（preserveAspectRatio="none"）。 */
const BAND = { width: 1000, height: 12, levels: [3, 4, 5], row: 2, gap: 1.5 };

function bandSvg() {
  const { width: w, height: h, levels, row, gap } = BAND;
  const top = (h - (levels.length * row + (levels.length - 1) * gap)) / 2;
  return `<svg class="gw-band" viewBox="0 0 ${w} ${h}" height="${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<rect width="${w}" height="${h}" class="gw-band-ink"/>`
    + rows(w, levels, row, gap, top, 'gw-band-gold')
    + '</svg>';
}

/* 節の飾り。見出しの下に、一段目から三段目までを三行に積む。長いもの（題の下）は四段目まで。 */
const ORN = { short: { width: 48, levels: [0, 1, 2] }, long: { width: 96, levels: [0, 1, 2, 3] }, row: 2, gap: 1.5 };

function ornamentSvg(kind) {
  const o = kind === 'long' ? ORN.long : ORN.short;
  const h = r2(o.levels.length * ORN.row + (o.levels.length - 1) * ORN.gap);
  return `<svg class="gw-orn gw-orn-${kind === 'long' ? 'long' : 'short'}" viewBox="0 0 ${o.width} ${h}" width="${o.width}" height="${h}" aria-hidden="true" focusable="false">`
    + rows(o.width, o.levels, ORN.row, ORN.gap, 0, 'gw-orn-fill')
    + '</svg>';
}

/* 渦。縦長の黄金比の長方形（幅 W、高さ Wφ）から、上・右・下・左の順に正方形を切り取り、
 * 各正方形の対角を四分の一の円弧でつなぐ。円弧はどれも時計回り（sweep 1）なので、中心は向きで決まる。 */
const SPIRAL = { width: 100, squares: 8, stroke: 1 };

function spiral() {
  let x = 0, y = 0, w = SPIRAL.width, h = SPIRAL.width * PHI;
  const sq = [];
  let d = 'M0 0';
  for (let i = 0; i < SPIRAL.squares; i++) {
    let s, ex, ey;
    switch (i % 4) {
      case 0: s = w; sq.push([x, y, s]); ex = x + s; ey = y + s; y += s; h -= s; break;            // 上
      case 1: s = h; sq.push([x + w - s, y, s]); ex = x + w - s; ey = y + s; w -= s; break;          // 右
      case 2: s = w; sq.push([x, y + h - s, s]); ex = x; ey = y + h - s; h -= s; break;              // 下
      default: s = h; sq.push([x, y, s]); ex = x + s; ey = y; x += s; w -= s; break;                 // 左
    }
    d += `A${r2(s)} ${r2(s)} 0 0 1 ${r2(ex)} ${r2(ey)}`;
  }
  return { squares: sq, d };
}

function sealSvg() {
  const W = SPIRAL.width, H = r2(W * PHI), p = SPIRAL.stroke / 2;
  const { squares, d } = spiral();
  return `<svg class="gw-seal" viewBox="${-p} ${-p} ${W + 2 * p} ${r2(H + 2 * p)}" aria-hidden="true" focusable="false">`
    + squares.map(([x, y, s]) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s)}" class="gw-seal-sq" stroke-width="${SPIRAL.stroke}"/>`).join('')
    + `<path d="${d}" class="gw-seal-arc" stroke-width="${SPIRAL.stroke * 1.5}"/>`
    + '</svg>';
}

/* 色。ロゴの二色だけを足す。余白・角の丸み・高さの段は、テンプレートが持つ。 */
const TOKENS = { '--gw-ink': LOGO.ink, '--gw-gold': LOGO.gold };

/* 意匠の CSS。テンプレートの CSS のあとに足す。字の大きさは --fs-、幅は --measure と --page、
 * 色は変数だけ、影は高さの段の変数だけにする（researcher-profile の check_build.js の 3i・3j が数える）。 */
function css() {
  return [
    '/* ---------- 予想のサイトの意匠（golden-window-design.js、2026-11-23） ---------- */',
    ':root {',
    Object.entries(TOKENS).map(([k, v]) => `  ${k}: ${v};`).join('\n'),
    '}',
    /* 帯。頁の上の欄の上端に一本。墨の地に、金で三段の区間を積む。 */
    '.gw-band { display: block; width: 100%; }',
    '.gw-band-ink { fill: var(--gw-ink); }',
    '.gw-band-gold { fill: var(--gw-gold); }',
    /* 最初の画面。題の下に長い飾り。広い画面では、右肩に渦を置き、その後ろに細かな格子の台座を円くぼかして敷く。
     * 字の行は渦の幅だけ右を空けるので、渦も格子も字の後ろに入らない。 */
    '.hero { position: relative; }',
    '.hero .gw-orn-long { display: block; margin: var(--sp-3) 0 var(--sp-5); }',
    '.gw-seal { display: none; }',
    '.gw-seal-sq { fill: none; stroke: var(--line); }',
    '.gw-seal-arc { fill: none; stroke: var(--accent); stroke-linecap: round; }',
    '@media (min-width: 62rem) {',
    '  .hero { isolation: isolate; }',
    '  .hero .gw-seal { display: block; position: absolute; top: 4.5rem; right: 1.5rem; width: 7rem; height: auto; filter: drop-shadow(1px 1px 0 var(--card)); }',
    "  .hero::after { content: ''; position: absolute; z-index: -1; top: 2.5rem; right: -1rem; width: 12rem; height: 15rem; pointer-events: none;"
      + ' background-image: linear-gradient(var(--line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);'
      + ' background-size: .75rem .75rem; -webkit-mask-image: radial-gradient(closest-side, var(--text), transparent); mask-image: radial-gradient(closest-side, var(--text), transparent); }',
    '  .hero > .eyebrow, .hero > h1, .hero > .romaji { padding-right: 9rem; }',
    '}',
    /* 節の見出し。テンプレートの短い棒（::after）を、三段の区間の飾りに替える。 */
    '.gw-orn-fill { fill: var(--accent); }',
    '.sec-head h2::after { content: none; }',
    '.sec-head .gw-orn-short { display: block; margin-top: var(--sp-3); }',
    '.sec-head h2::before { color: var(--accent); }',
    /* 状態の段（最初の一段）を浮いた札にする。左の縁は指し色のまま。 */
    '#state .notes-list > p.profile-core:first-child { margin: 0 0 var(--sp-5); padding: var(--sp-4) var(--sp-5);'
      + ' background: linear-gradient(180deg, var(--card), var(--card-lo)); border: 1px solid var(--line); border-left: 3px solid var(--accent);'
      + ' border-radius: 0 var(--radius-md) var(--radius-md) 0; box-shadow: var(--shadow-float); }',
    /* δ の範囲ごとの行（命題の欄）を、面の高さの札にして積む。 */
    '#state .notes-list > p:not(.profile-core) { margin: var(--sp-2) 0 0; padding: var(--sp-2) var(--sp-4) var(--sp-3);'
      + ' background: linear-gradient(180deg, var(--card), var(--card-lo)); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-face); }',
    '#state .notes-list > p.profile-core + p:not(.profile-core) { margin-top: var(--sp-5); }',
    '#state .notes-list > p:not(.profile-core) > b { display: block; padding-bottom: var(--sp-1); border-bottom: 1px solid var(--line-soft); }',
    '#state .notes-list > p:not(.profile-core) > span { margin-top: var(--sp-1); }',
    /* 図の札。上端に指し色の線を引き、δ を動かす欄の色を指し色にする。 */
    '#gw-live { border-top: 2px solid var(--accent); border-radius: 0 0 var(--radius-md) var(--radius-md); }',
    '#gw-live input[type="range"] { accent-color: var(--accent); }',
    /* 頁の下の欄。帯をもう一度置く代わりに、上端を金の線にする。 */
    'footer { border-top: 2px solid var(--gw-gold); }',
    '@media (max-width: 30rem) {',
    '  #state .notes-list > p.profile-core:first-child { padding: var(--sp-3) var(--sp-4); }',
    '  #state .notes-list > p:not(.profile-core) { padding: var(--sp-2) var(--sp-3); }',
    '}',
    /* 紙。帯と渦は刷らない。飾りと縁は、テンプレートの印刷の色（指し色が黒）で刷る。札は途中で切らない。 */
    '@media print {',
    '  :root, :root[data-theme="dark"] { --gw-ink: #000; --gw-gold: #000; }',
    '  .gw-band, .hero .gw-seal, .hero::after { display: none; }',
    '  #state .notes-list > p { break-inside: avoid; }',
    '  footer { border-top-width: 1px; }',
    '}',
  ].join('\n') + '\n';
}

/* 予想のサイトの頁か。重ねる設定のあとの siteUrl で決める。 */
function applies(profile) {
  return typeof (profile && profile.siteUrl) === 'string' && profile.siteUrl.indexOf(SITE) === 0;
}

module.exports = { SITE, PHI, KEEP, LOGO, BAND, ORN, SPIRAL, TOKENS, cantor, spiral, bandSvg, ornamentSvg, sealSvg, css, applies };
