/* 黄金比の窓の図。δ を動かすと、保てる t の集合 T_δ を描き直す。
 *
 * 頁の設定（golden-window*.json）の scripts から、build.js が頁に埋め込む。
 * 外へは何も取りに行かない。CSP はこの中身のハッシュで許す。
 *
 * 計算は trinity-operator の games のノートの命題 5 と 6 の変数変換による。
 *   x = (3 − w)/(1 − δ),   X = (2δ − 1)/(δ(1 − δ)),
 *   生き残る x の集合 S は S = δS ∪ ((1 + δS) ∩ [0, X]) を満たす。
 *   [0, X] から始めて、この写像を n 回当てた区間の和が、n 期を生き残る x である。
 *   t は二つの枝から出る：t = δ − δ(1 − δ)x（u = 2）、t = 1 − δ(1 − δ)x（u = 3）。
 * 有限の深さの計算であって、証明ではない。頁にもそう出す。
 */
(function () {
  'use strict';

  var PHI_INV = (Math.sqrt(5) - 1) / 2;
  var LO = 0.45, HI = 0.75;
  var MAX_INTERVALS = 3000, MAX_DEPTH = 24;

  var en = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'en';
  var TXT = en ? {
    below: 'δ < 1/2: no t can be kept. Proved (Proposition 4).',
    two: '1/2 ≤ δ < 1/φ: only t = δ and t = 1 can be kept. Proved (Proposition 5).',
    at: 'δ = 1/φ: a countably infinite set. Proved (Proposition 5).',
    window: 'Inside the window 1/φ < δ < 2/3: the set has positive dimension, which is proved (Proposition 6). That its length is zero is conjecture (a), and is not proved.',
    full: 'δ ≥ 2/3: every t from 1 − δ to 1 can be kept. Proved (Proposition 5).',
    depth: function (k, n, len) {
      return 'Drawn: the values of t that survive ' + n + ' periods, ' + k + ' interval' + (k === 1 ? '' : 's')
        + ', total length ' + len + '. A finite-depth computation, not a proof.';
    },
    deltaAxis: 'discount factor δ', tAxis: 't (the payoff is (2+t, 4−t, 2+t))', window_: 'window',
  } : {
    below: 'δ < 1/2：保てる t は無い。証明してある（命題 4）。',
    two: '1/2 ≤ δ < 1/φ：保てる t は δ と 1 の二点だけ。証明してある（命題 5）。',
    at: 'δ = 1/φ：可算無限の集合。証明してある（命題 5）。',
    window: '窓の中 1/φ < δ < 2/3：集合の次元が正であることは証明してある（命題 6）。長さが 0 になることは予想 (a) で、証明していない。',
    full: 'δ ≥ 2/3：1 − δ から 1 までのすべての t を保てる。証明してある（命題 5）。',
    depth: function (k, n, len) {
      return '描いているのは、' + n + ' 期を生き残る t の区間 ' + k + ' 個、総長 ' + len + '。有限の深さの計算であって、証明ではない。';
    },
    deltaAxis: '割引因子 δ', tAxis: 't（利得は (2+t, 4−t, 2+t)）', window_: '窓',
  };

  /* ---------- 計算 ---------- */

  function merge(list) {
    list.sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var iv = list[i];
      var last = out[out.length - 1];
      if (last && iv[0] <= last[1] + 1e-12) { if (iv[1] > last[1]) last[1] = iv[1]; }
      else out.push([iv[0], iv[1]]);
    }
    return out;
  }

  /* n 期を生き残る x の区間。区間が増えすぎる手前で止め、何期まで回したかを返す。 */
  function survivors(d) {
    if (d < 0.5) return { list: [], depth: 0 };
    var X = (2 * d - 1) / (d * (1 - d));
    var cur = [[0, X]];
    var n = 0;
    for (; n < MAX_DEPTH; n++) {
      var next = [];
      for (var i = 0; i < cur.length; i++) {
        for (var a = 0; a <= 1; a++) {
          var lo = a + d * cur[i][0], hi = a + d * cur[i][1];
          if (hi > X) hi = X;
          if (lo <= hi) next.push([lo, hi]);
        }
      }
      next = merge(next);
      if (next.length > MAX_INTERVALS) break;
      cur = next;
    }
    return { list: cur, depth: n };
  }

  /* x の区間を t の区間に移し、(0, 1] に収める。 */
  function tSet(d) {
    var s = survivors(d);
    var k = d * (1 - d);
    var out = [];
    s.list.forEach(function (iv) {
      [d, 1].forEach(function (top) {
        var lo = top - k * iv[1], hi = top - k * iv[0];
        if (lo < 0) lo = 0;
        if (hi > 1) hi = 1;
        if (hi > 0 && lo <= hi) out.push([lo, hi]);
      });
    });
    return { list: merge(out), depth: s.depth };
  }

  /* ---------- 描画 ---------- */

  var NS = 'http://www.w3.org/2000/svg';
  var W = 600, PAD = 24;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function paint(e, prop, value) { e.style.setProperty(prop, value); return e; }
  function text(parent, x, y, s, anchor) {
    var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'middle' }, parent);
    paint(t, 'fill', 'var(--muted)');
    paint(t, 'font-size', '11px');
    t.textContent = s;
    return t;
  }
  var dx = function (d) { return PAD + (W - 2 * PAD) * (d - LO) / (HI - LO); };
  var tx = function (t) { return PAD + (W - 2 * PAD) * t; };

  function draw(svg, d) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    /* 上の帯：δ の軸と、窓 */
    paint(el('rect', { x: dx(LO), y: 18, width: dx(HI) - dx(LO), height: 10 }, svg), 'fill', 'var(--line-soft)');
    paint(el('rect', { x: dx(PHI_INV), y: 18, width: dx(2 / 3) - dx(PHI_INV), height: 10 }, svg), 'fill', 'var(--accent-soft)');
    text(svg, (dx(PHI_INV) + dx(2 / 3)) / 2, 12, TXT.window_);
    [[0.5, '1/2'], [PHI_INV, '1/φ'], [2 / 3, '2/3']].forEach(function (m) {
      paint(el('line', { x1: dx(m[0]), x2: dx(m[0]), y1: 16, y2: 30 }, svg), 'stroke', 'var(--faint)');
      text(svg, dx(m[0]), 42, m[1]);
    });
    paint(el('line', { x1: dx(d), x2: dx(d), y1: 14, y2: 32 }, svg), 'stroke', 'var(--accent)');
    paint(el('circle', { cx: dx(d), cy: 23, r: 4 }, svg), 'fill', 'var(--accent)');
    text(svg, W - PAD, 56, TXT.deltaAxis, 'end');

    /* 下の帯：t の軸と、T_δ */
    paint(el('rect', { x: tx(0), y: 82, width: tx(1) - tx(0), height: 18 }, svg), 'fill', 'var(--line-soft)');
    var res = tSet(d);
    var total = 0;
    res.list.forEach(function (iv) {
      total += iv[1] - iv[0];
      var w = Math.max(tx(iv[1]) - tx(iv[0]), 1);
      paint(el('rect', { x: tx(iv[0]), y: 82, width: w, height: 18 }, svg), 'fill', 'var(--accent)');
    });
    [0, 0.5, 1].forEach(function (v) { text(svg, tx(v), 116, String(v)); });
    text(svg, W - PAD, 134, TXT.tAxis, 'end');
    return { count: res.list.length, depth: res.depth, total: total };
  }

  function stateText(d) {
    if (d < 0.5) return TXT.below;
    if (Math.abs(d - PHI_INV) < 1e-9) return TXT.at;
    if (d < PHI_INV) return TXT.two;
    if (d < 2 / 3) return TXT.window;
    return TXT.full;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var live = document.getElementById('gw-live');
    var input = document.getElementById('gw-delta');
    var out = document.getElementById('gw-value');
    var svg = document.getElementById('gw-svg');
    var state = document.getElementById('gw-state');
    var depth = document.getElementById('gw-depth');
    if (!live || !input || !out || !svg || !state || !depth) return;
    live.hidden = false;
    paint(input, 'accent-color', 'var(--accent)');
    paint(input, 'width', '100%');
    paint(svg, 'width', '100%');
    paint(svg, 'height', 'auto');
    paint(svg, 'max-width', '40rem');
    function update() {
      var d = Number(input.value);
      out.textContent = d.toFixed(3);
      var r = draw(svg, d);
      var s = stateText(d);
      state.textContent = s;
      depth.textContent = r.count ? TXT.depth(r.count, r.depth, r.total.toPrecision(3)) : '';
      svg.setAttribute('aria-label', 'δ = ' + d.toFixed(3) + '. ' + s);
    }
    input.addEventListener('input', update);
    update();
  });
})();
