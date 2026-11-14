#!/usr/bin/env node
/**
 * researcher-profile
 *
 * profile.json を読み、静的な HTML を dist/ に書き出す。
 * 依存パッケージはなく、Node.js だけで動く。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const design = require('./design.js');

const ROOT = __dirname;
const CONFIG = process.env.PROFILE_CONFIG || path.join(ROOT, 'profile.json');
const OUT_DIR = process.env.PROFILE_OUT || path.join(ROOT, 'dist');

/* ------------------------------------------------------------------ *
 * 補助
 * ------------------------------------------------------------------ */

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 外部リンクには target と rel を付ける */
const linkAttrs = (url) =>
  /^https?:\/\//.test(url) ? ' target="_blank" rel="noopener"' : '';

const arr = (v) => (Array.isArray(v) ? v : []);

/** 中身が変わった日。**生成した日ではない。**
 * 頁の中身の源（設定・重ねる設定・科目の表）を、git が最後に変えた日を取る。
 * 源に未コミットの変更があれば、その日（UTC）を取る。git が無ければ null。 */
function contentDate(files) {
  const { execFileSync } = require('child_process');
  const list = files.filter(Boolean).map((f) => path.resolve(f));
  if (!list.length) return null;
  const opt = { cwd: path.dirname(list[0]), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', ...list], opt).trim();
    if (dirty) return new Date().toISOString().slice(0, 10);
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...list], opt).trim();
    return d || null;
  } catch (e) {
    return null;
  }
}

/** 既定のラベル。profile.labels で個別に上書きできる */
const DEFAULT_LABELS = {
  eyebrow: 'Profile',
  credentials: '修了証・資格',
  credentialsNote: '各カードから発行機関の検証ページを開けます。',
  areas: '領域',
  papers: '論文',
  papersNote: '',
  works: '制作物',
  worksNote: '',
  claim: '主張',
  claimNote: '',
  refute: 'どうすれば覆るか',
  verification: '検証',
  withdrawn: '撤回',
  contact: '連絡',
  contactNote: '批判と誤りの指摘を先に置きます。',
  links: 'リンク',
  verify: '確認',
  skip: '本文へスキップ',
  themeToggle: 'テーマを切り替える',
};

/* ------------------------------------------------------------------ *
 * 各部品の組み立て
 * ------------------------------------------------------------------ */

/* ---------------------------------------------------------------- *
 * Content-Security-Policy
 *
 * このサイトは外部から何も読み込まない。それを「そう書いてある」ではなく
 * ブラウザが強制する制約にする。default-src 'none' から始めて、実際に
 * 使っているものだけを名指しで許す。
 *
 * インラインの <style> <script> は中身の SHA-256 で許す。'unsafe-inline'
 * は使わない —— 使えば注入されたスクリプトも通り、置く意味が無くなる。
 * 生成のたびに計算し直すので、中身を変えても入れ直す手間はない。
 * ---------------------------------------------------------------- */
function withCSP(html) {
  const sha = (t) =>
    "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";
  const blocks = (tag) => {
    const re = new RegExp('<' + tag + '(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</' + tag + '>', 'g');
    const out = [];
    let m;
    while ((m = re.exec(html)) !== null) out.push(sha(m[1]));
    return out;
  };
  const csp = [
    "default-src 'none'",
    "script-src 'self' " + blocks('script').join(' '),
    'style-src ' + blocks('style').join(' '),
    "img-src 'self' data:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'"
  ].join('; ').replace(/\s+/g, ' ').replace(/ ;/g, ';');

  const tag = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n';
  return html.replace(/(<meta name="viewport"[^>]*>\n?)/, '$1' + tag);
}

/* 自己紹介の板。**石垣に嵌めた銘板のつもりで組む。**
 *
 * いま何をしているか、来た道、これからの二つ。三つとも別の見え方にする。
 * 来た道は縦の道筋で、いまいる位置だけ指し色を差す。
 * 色は既にある指し色（--accent）だけを使う。**新しい本文色を作らない** ——
 * 作れば check_contrast.js の対象が増え、そこを通らない色が混じる余地ができる。
 */
/* 修得した単位の合計。**手で書かない。行から数える。**
 * 区分が一つしか無いときは内訳を出さない。同じ数を二度書くことになる。 */
/* 「何年何月何日現在」。**逐次更新の目安である。**
 * courses.json の asOf を、その頁の言語で書き直すだけ。日付を二箇所で持たない。 */
function asOfLabel(iso, en) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (en) {
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                 'August', 'September', 'October', 'November', 'December'];
    return `as of ${d} ${MON[mo - 1]} ${y}`;
  }
  return `${y} 年 ${mo} 月 ${d} 日現在`;
}


function courseTotal(items, en) {
  const credits = items.reduce((n, c) => n + (Number(c.credits) || 0), 0);
  const byCat = [];
  items.forEach((c) => {
    const k = c.category || '';
    const hit = byCat.find((x) => x[0] === k);
    if (hit) hit[1] += Number(c.credits) || 0;
    else byCat.push([k, Number(c.credits) || 0]);
  });
  const head = en
    ? `${items.length} course${items.length === 1 ? '' : 's'}, ${credits} credits`
    : `${items.length} 科目 ${credits} 単位`;
  if (byCat.length < 2) return head;
  return head + (en
    ? ' — ' + byCat.map(([k, v]) => `${v} ${k}`).join(', ')
    : ' —— ' + byCat.map(([k, v]) => `${k} ${v}`).join('・'));
}


function renderProfile(p, idsHtml) {
  if (!p) return '';
  const rows = arr(p.history).map((h, i, all) => {
    const now = i === all.length - 1;
    /* 単位を取った科目は、この行に入れる。**合計は行から数える。**
     * note を手で書いた場合はそれを使うが、courses があるほうを優先する。 */
    const cs = arr(h.courses);
    let note = h.note || '';
    let list = '';
    if (cs.length) {
      note = courseTotal(cs, !!h.en)
        + (h.asOf ? (h.en ? ` (${h.asOf})` : `（${h.asOf}）`) : '');
      list = '<ul class="path-courses">'
        + cs.map((c) => `<li data-category="${esc(c.category || '')}" `
            + `data-credits="${Number(c.credits) || 0}" `
            + `data-grade="${esc(c.grade || '')}">${esc(c.name)}`
            + (c.category ? `<i>${esc(c.category)}</i>` : '')
            + (c.grade ? `<b>${esc(c.grade)}</b>` : '') + '</li>').join('')
        + '</ul>';
    }
    return `      <li${now ? ' class="path-now"' : ''}>`
      + `<span class="path-name">${esc(h.name)}</span>`
      + `<span class="path-state">${esc(h.state)}</span>`
      + (note ? `<span class="path-note">${esc(note)}</span>` : '')
      + list
      + '</li>';
  }).join('\n');
  /* 目標。**文字列なら一行ずつ、{ text, when, status } なら表にする。**
   * 表にするのは、達成したかどうかの欄を置くためである（2026-11-11）。
   * 何をもって達成とするかを同じ行に書く。書かなければ、欄はいつまでも埋まらない。 */
  const aimList = arr(p.aims);
  const aimRows = aimList.every((a) => a && typeof a === 'object');
  const cols = arr(p.aimsStatusLabel);
  const aims = !aimList.length ? ''
    : aimRows
      ? [
          '      <table class="aims-table">',
          `        <thead><tr><th scope="col">${esc(cols[0] || '')}</th><th scope="col">${esc(cols[1] || '')}</th><th scope="col">${esc(cols[2] || '')}</th></tr></thead>`,
          '        <tbody>',
          ...aimList.map((a) => `          <tr><td>${esc(a.text)}</td><td>${esc(a.when || '')}</td><td class="aim-status">${esc(a.status || '')}</td></tr>`),
          '        </tbody>',
          '      </table>'
        ].join('\n')
      : aimList.map((a) => `      <li>${esc(a)}</li>`).join('\n');
  return [
    /* section にしない。ヒーローの検査は最初の </section> で切るので、
     * 入れ子にすると査読前の断りがヒーローの外に出る。実際に一度そうなった。 */
    '    <div class="profile reveal">',
    `      <h2 class="profile-label">${esc(p.label || '')}</h2>`,
    /* 識別子（ORCID）は、自己紹介の節では見出しのすぐ下に置く。 */
    idsHtml ? idsHtml.replace(/^ {4}/gm, '      ') : '',
    /* 写真。**無ければ何も出さない。**この道具を使う側が必ず顔を出すとは限らない。
     * **一枚でも並べてでも取れる。**object を渡せば一枚、配列を渡せば横に並ぶ。
     * 一枚のときの markup は前と同じで、既存の設定は何も変わらない。
     * **寸法を属性で書く。**書かないと読み込みのたびに本文が跳ねる。 */
    renderPhotos(p.photo, p.photoNote),
    /* 修了証を技術の目安として、自己紹介の先頭に置く。**無ければ何も出さない。** */
    p.credHtml ? `      <p class="profile-now profile-cred">${p.credHtml}</p>` : '',
    `      <p class="profile-now">${p.nowHtml || esc(p.now || '')}</p>`,
    p.studyHtml ? `      <p class="profile-now profile-study">${p.studyHtml}</p>` : '',
    /* 根幹の一段。**自己紹介の中に置く。**下のほうに置けば、読み手は辿り着かない。 */
    p.coreHtml ? `      <p class="profile-core">${p.coreHtml}</p>` : '',
    rows ? '      <ol class="path">' : '',
    rows,
    rows ? '      </ol>' : '',
    /* 科目名についての断り。**訳を公式名のように出さない。**
       公式の英語名を確かめられない言語版だけが持つ。 */
    p.coursesNoteHtml ? `      <p class="path-caveat">${p.coursesNoteHtml}</p>` : '',
    aims ? `      <p class="aims-label">${esc(p.aimsLabel || '')}</p>` : '',
    aims && !aimRows ? '      <ul class="aims">' : '',
    aims,
    aims && !aimRows ? '      </ul>' : '',
    '    </div>'
  ].filter((x) => x !== '').join('\n') + '\n';
}


/* 頁の下の欄に足す道。{ label, url } の並び。updatedLabel があれば、中身が変わった日も出す。 */
function footerSet(profile) {
  if (!profile.footerSet) return { links: [], updated: '' };
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'footer.json'), 'utf8'));
  if (!all[profile.footerSet]) throw new Error('footer.json に無い言語です: ' + profile.footerSet);
  return all[profile.footerSet];
}

function renderFooterExtra(profile) {
  const set = footerSet(profile);
  const links = arr(set.links).map((l) =>
    `<a href="${esc(l.url)}"${linkAttrs(l.url)}>${esc(l.label)}</a>`);
  if (set.updated) {
    /* 源を設定が名指すときは、それを使う（論文の頁と目録は、設定を一時ファイルに書いて渡すため）。 */
    const d = contentDate(profile.updatedFrom
      ? arr(profile.updatedFrom).map((f) => path.join(ROOT, f))
      : [CONFIG, process.env.PROFILE_OVERLAY, profile.coursesFile ? path.join(ROOT, profile.coursesFile) : null,
         timelineOf(profile) ? path.join(ROOT, timelineOf(profile).file) : null]);
    if (d) links.push(`<span class="updated">${esc(set.updated)} <time datetime="${d}">${d}</time></span>`);
  }
  return links.length ? '\n    <span class="foot-links">' + links.join(' · ') + '</span>' : '';
}

/* 使っている部品の分だけ、スタイルを足す。**使わない頁のスタイルは一字一句前と同じ。**
 * 予想のサイトは生成物を写して一字一句で照らしているので、ここで黙って変えない。 */
function extraCss(profile) {
  const out = [];
  const aims = arr(profile.profile && profile.profile.aims);
  if (aims.length && aims.every((a) => a && typeof a === 'object')) {
    out.push('.aims-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); line-height: 1.7; }',
      '.aims-table th { text-align: left; font-weight: 600; color: var(--text); padding: .35rem .5rem .35rem 0; border-bottom: 1px solid var(--line); }',
      '.aims-table td { color: var(--muted); padding: .45rem .5rem .45rem 0; border-bottom: 1px solid var(--line-soft); vertical-align: top; overflow-wrap: anywhere; }',
      '.aims-table .aim-status { white-space: nowrap; color: var(--text); }');
  }
  if (profile.footerSet) {
    out.push('.foot-links { display: flex; flex-wrap: wrap; gap: .25rem .4rem; }',
      '.foot-links a { color: inherit; text-decoration: underline; text-underline-offset: .15em; }');
  }
  if (profile.filter && arr(profile.filter.items).length) {
    const ids = arr(profile.filter.items).map((i) => i.id);
    out.push('.filter { margin: 1.75rem 0 0; display: flex; flex-wrap: wrap; gap: .5rem; }',
      '.filter a { padding: .25rem .85rem; font-size: var(--fs-sm); line-height: 1.8; color: var(--muted); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; }',
      '.filter a:hover { color: var(--text); border-color: var(--accent); }',
      'main:has(.filterable:target) .filterable:not(:target), main:has(.filterable:target) hr.rule { display: none; }',
      ids.map((id) => `main:has(#${id}:target) .filter a[href="#${id}"]`).join(',\n')
        + ',\nmain:not(:has(.filterable:target)) .filter a[href="#filter"] { color: var(--text); border-color: var(--accent); background: var(--accent-soft); }');
  }
  if (profile.printCard) {
    out.push('@media print {', '  @page { size: A4; margin: 12mm; }', '  :root { --fs-md: 11pt; }', '  .hero { padding-top: 0; padding-bottom: 0; }', '  section, .cert, .links-group { break-inside: avoid; }', '}');
  }
  return out.length ? out.join('\n') + '\n' : '';
}

function renderPhotos(photo, note) {
  const list = (Array.isArray(photo) ? photo : [photo]).filter((x) => x && x.src);
  if (!list.length) return '';
  const img = (x, indent) => `${indent}<img class="profile-photo" src="${esc(x.src)}"`
    + ` alt="${esc(x.alt || '')}"`
    + ` width="${esc(String(x.width || ''))}" height="${esc(String(x.height || ''))}"`
    + ' loading="lazy" decoding="async">';
  /* **撮影の断りは、写真の下に置く。**どちらの一枚についてかは断りの側が名乗る。
   * 位置で指さない —— 並びが変われば、位置で指した断りは嘘になる。 */
  /* **断りは一行とは限らない。**撮影のことと、外の道具に掛けた結果は別の話である。
   * 一つの段落に混ぜると、どこまでが確かめたことかが読めなくなる。 */
  const notes = (Array.isArray(note) ? note : [note]).filter((x) => x && String(x).trim());
  const 断り = notes.map((x) => '        <p class="profile-photo-note">' + esc(x) + '</p>');
  if (list.length === 1 && !断り.length) return img(list[0], '      ');
  return ['      <div class="profile-photos">', '        <div class="profile-photos-row">']
    .concat(list.map((x) => img(x, '          ')))
    .concat(['        </div>']).concat(断り).concat(['      </div>']).join('\n');
}


/* 最初の画面の入口。**三つまで。**多ければ入口ではなく目次になる。 */
function renderEntries(list) {
  const items = arr(list);
  if (!items.length) return '';
  if (items.length > 3) throw new Error('entries は三つまでです: ' + items.length);
  return '\n    <ul class="entries reveal">\n' + items.map((e) =>
    `      <li><a href="${esc(e.url)}"${linkAttrs(e.url)}><b>${esc(e.name)}</b>`
    + (e.note ? `<span>${esc(e.note)}</span>` : '') + '</a></li>').join('\n') + '\n    </ul>';
}

/* 種類で絞る。**スクリプトを足さない。**頁の中のリンクで、節を :target にするだけである。
 * 絞った節以外を隠すのは CSS（extraCss）。:has を読まない古いブラウザでは、ただの頁内リンクになる。 */
function renderFilter(f) {
  if (!f || !arr(f.items).length) return '';
  return `\n    <nav class="filter reveal" id="filter" aria-label="${esc(f.label || '')}">`
    + `<a href="#filter">${esc(f.all || '')}</a>`
    + arr(f.items).map((i) => `<a href="#${esc(i.id)}">${esc(i.name)}</a>`).join('')
    + '</nav>';
}

/* 共有カードの画像の名。正の URL の道筋を、そのまま平らにする。
 * https://example.org/          → index
 * https://example.org/a/b.en.html → a-b.en */
function cardName(url) {
  const p = String(url).replace(/^https?:\/\/[^/]+\/?/, '').replace(/\.html$/, '');
  return (p || 'index').replace(/\//g, '-');
}

function renderIdentifiers(ids) {
  if (!ids.length) return '';
  return ids
    .map((id) => {
      const value = id.url
        ? `<a href="${esc(id.url)}"${linkAttrs(id.url)}>${esc(id.value)}</a>`
        : esc(id.value);
      return `    <p class="ident reveal"><span class="label">${esc(id.label)}</span>${value}</p>`;
    })
    .join('\n');
}

function renderCredentials(groups, labels) {
  if (!groups.length) return '';
  const body = groups
    .map((group) => {
      const cards = arr(group.items)
        .map((item) => {
          const tag = item.url ? 'a' : 'div';
          const href = item.url ? ` href="${esc(item.url)}"${linkAttrs(item.url)}` : '';
          return [
            `        <${tag} class="cert reveal"${href}>`,
            item.code ? `          <span class="code">${esc(item.code)}</span>` : '',
            `          <h3>${esc(item.title)}</h3>`,
            item.issuer ? `          <p class="issuer">${esc(item.issuer)}</p>` : '',
            item.url ? `          <span class="verify">${esc(item.verify || labels.verify)}</span>` : '',
            `        </${tag}>`,
          ].filter(Boolean).join('\n');
        })
        .join('\n');
      return [
        '    <div class="group">',
        group.name ? `      <div class="group-name reveal">${esc(group.name)}</div>` : '',
        '      <div class="cards">',
        cards,
        '      </div>',
        '    </div>',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');

  return `
  <hr class="rule">

  <section id="credentials" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.credentials)}</h2>
      ${labels.credentialsNote ? `<p>${esc(labels.credentialsNote)}</p>` : ''}
    </div>

${body}
  </section>`;
}

/* 説明文に 1 つだけリンクを許す。DOI をまとめて解析する導線などに使う。 */
function noteHtmlOf(n) { return typeof n === 'object' && n.html ? n.html : esc(n); }

function renderPapers(papers, labels, profile) {
  if (profile && profile.papersLayout === 'table') return renderPaperTable(papers, labels, profile);
  return renderCards(papers, 'papers', labels.papers, labels.papersNote, labels);
}

/* 論文の表。**題・年・DOI・状態を一行に並べる。**カードより比べやすい（2026-11-12）。
 *
 * 状態は手で書かない。目録（catalog.json）の行から取る。行は catalogId で名指す。
 * 年は設定の year に書く。DataCite の publicationYear を写したものである。
 * どちらかが欠けたら生成を止める。空欄の表は、比べられない表である。 */
function renderPaperTable(papers, labels, profile) {
  if (!papers.length) return '';
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
  const en = String(profile.lang || 'ja').slice(0, 2) !== 'ja';
  const cols = arr(labels.papersColumns).length === 4 ? labels.papersColumns
    : (en ? ['Title', 'Year', 'DOI', 'Status'] : ['題', '年', 'DOI', '状態']);
  const rows = papers.map((item) => {
    const w = cat.works.find((x) => x.id === item.catalogId);
    if (!w) throw new Error('論文の表の行が目録にありません（catalogId）: ' + (item.catalogId || item.title));
    if (!/^\d{4}$/.test(String(item.year || ''))) throw new Error('論文の表の行に年がありません: ' + item.title);
    const st = cat.statuses[w.status];
    if (!st) throw new Error('目録に無い状態です: ' + w.status);
    const where = arr(item.locations).map((l) => (l.url
      ? `<a href="${esc(l.url)}"${linkAttrs(l.url)}>${esc(l.name)}${l.id ? ' ' + esc(l.id) : ''}</a>`
      : esc(l.name) + (l.id ? ' ' + esc(l.id) : '')) + (l.note ? esc(l.note) : '')).join('　／　');
    const title = item.url
      ? `<a href="${esc(item.url)}"${linkAttrs(item.url)}>${esc(item.title)}</a>` : esc(item.title);
    const doi = item.doi
      ? `<a href="https://doi.org/${esc(item.doi)}"${linkAttrs('https://')}>${esc(item.doi)}</a>` : '—';
    return [
      '        <tr class="paper">',
      `          <td class="t-title">${title}`
        + (item.summary ? `<span class="t-sum">${esc(item.summary)}</span>` : '')
        + (where ? `<span class="t-where">${where}</span>` : '') + '</td>',
      `          <td class="t-year" data-label="${esc(cols[1])}">${esc(String(item.year))}</td>`,
      `          <td class="t-doi" data-label="${esc(cols[2])}">${doi}</td>`,
      `          <td class="t-state" data-label="${esc(cols[3])}">${esc(en ? st.en : st.ja)}</td>`,
      '        </tr>',
    ].join('\n');
  }).join('\n');
  const note = labels.papersNote;
  return `
  <hr class="rule">

  <section id="papers" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.papers)}</h2>
      ${note ? `<p>${noteHtmlOf(note)}</p>` : ''}
    </div>

    <div class="reveal">
      <table class="works-table">
        <thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </section>`;
}

/* 制作物。論文と同じカードの形で、節の id と見出しだけ変える。 */
function renderWorks(works, labels) {
  return renderCards(works, 'works', labels.works, labels.worksNote, labels);
}

function renderCards(papers, sectionId, heading, note, labels) {
  if (!papers.length) return '';

  const cards = papers
    .map((item) => {
      const tag = item.url ? 'a' : 'div';
      const href = item.url ? ` href="${esc(item.url)}"${linkAttrs(item.url)}` : '';
      /* 同じ資料の別の所在。<a> の入れ子は作れないので、カードの外に置く。
       * 文字で出すだけでは辿れないため、一つずつリンクにする。
       * note はリンクのすぐ後ろに文字で添える（削除を依頼した所在など。2026-11-13）。 */
      const where = arr(item.locations).length
        ? `      <p class="where">${arr(item.locations).map((l) => (l.url
            ? `<a href="${esc(l.url)}"${linkAttrs(l.url)}>${esc(l.name)}${l.id ? ' ' + esc(l.id) : ''}</a>`
            : esc(l.name) + (l.id ? ' ' + esc(l.id) : '')) + (l.note ? esc(l.note) : '')).join('　／　')}</p>`
        : '';
      const card = [
        `      <${tag} class="cert reveal"${href}>`,
        item.code ? `        <span class="code">${esc(item.code)}</span>` : '',
        `        <h3>${esc(item.title)}</h3>`,
        item.subtitle ? `        <p class="alt">${esc(item.subtitle)}</p>` : '',
        item.summary ? `        <p class="issuer">${esc(item.summary)}</p>` : '',
        item.doi ? `        <p class="doi">DOI ${esc(item.doi)}</p>` : '',

        item.url ? `        <span class="verify">${esc(item.verify || labels.verify)}</span>` : '',
        `      </${tag}>`,
      ].filter(Boolean).join('\n');
      return where
        ? '      <div class="cert-group reveal">\n' + card.replace(/^ {6}/gm, '        ')
          + '\n' + where.replace(/^ {6}/gm, '        ') + '\n      </div>'
        : card;
    })
    .join('\n');

  return `
  <hr class="rule">

  <section id="${esc(sectionId)}" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(heading)}</h2>
      ${note ? `<p>${noteHtmlOf(note)}</p>` : ''}
    </div>

    <div class="cards">
${cards}
    </div>
  </section>`;
}

function renderAreas(areas, labels) {
  if (!areas.length) return '';
  const rows = areas
    .map(
      (a) =>
        `      <div class="area reveal">\n        <h3>${esc(a.name)}</h3>\n        <p>${esc(a.detail)}</p>\n      </div>`
    )
    .join('\n');
  return `
  <hr class="rule">

  <section id="areas" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.areas)}</h2>
    </div>

    <div class="areas">
${rows}
    </div>
  </section>`;
}

function renderLinks(groups, labels) {
  if (!groups.length) return '';
  const body = groups
    .map((group) => {
      const pills = arr(group.items)
        .map(
          (l) =>
            `          <a class="link" href="${esc(l.url)}"${linkAttrs(l.url)}>${esc(l.name)}` +
            (l.note ? ` <span>${esc(l.note)}</span>` : '') +
            '</a>'
        )
        .join('\n');
      return [
        '      <div class="group reveal">',
        group.name ? `        <div class="group-name">${esc(group.name)}</div>` : '',
        '        <div class="links">',
        pills,
        '        </div>',
        '      </div>',
      ].filter(Boolean).join('\n');
    })
    .join('\n');

  return `
  <hr class="rule">

  <section id="links" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.links)}</h2>
    </div>

${body}
  </section>`;
}

/* ------------------------------------------------------------------ *
 * 主張
 *
 * 一つだけ出す。反証の手順まで書いていなければ、主張ではなく宣伝である。
 * だから refute は必須で、無ければ節ごと出さない。
 * ------------------------------------------------------------------ */
function renderClaim(claim, labels) {
  if (!claim || !claim.statement) return '';
  if (!claim.refute) {
    throw new Error('claim には refute（どうすれば覆るか）が要ります。'
      + '反証の手順を書けない主張は、主張ではなく宣伝です。');
  }
  const rows = arr(claim.rows)
    .map((r) => [
      '        <div>',
      `          <dt>${esc(r.term)}</dt>`,
      `          <dd>${r.html || esc(r.text || '')}</dd>`,
      '        </div>',
    ].join('\n'))
    .join('\n');

  return `
  <hr class="rule">

  <section id="claim" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.claim)}</h2>
      ${labels.claimNote ? `<p>${esc(labels.claimNote)}</p>` : ''}
    </div>

    <div class="claim reveal">
      <p class="claim-what">${claim.statementHtml || esc(claim.statement)}</p>

      <dl class="claim-kv">
${rows}
        <div>
          <dt>${esc(labels.refute)}</dt>
          <dd>${claim.refuteHtml || esc(claim.refute)}</dd>
        </div>
      </dl>
${claim.foot ? `\n      <p class="claim-foot">${claim.footHtml || esc(claim.foot)}</p>` : ''}
    </div>
  </section>`;
}

/* 検証 —— 何項目がどこで走るか。数だけ書いて中身が無いものは出さない。
 *
 * **作品の種類ごとに分けて出せる。**groups を書けば、群ごとに見出しを置いて並べる。
 * どの作品のどの主張を、どの検査が支えているかを、種類で辿れるようにする。
 * 行の形（<dt> と <dd>）は分けないときと同じにする。名乗る数は <dt> から拾われている。 */
function verificationGroups(v) {
  if (!v) return [];
  if (arr(v.groups).length) return arr(v.groups).filter((g) => arr(g.items).length);
  return arr(v.items).length ? [{ items: arr(v.items) }] : [];
}

function renderVerification(v, labels) {
  const groups = verificationGroups(v);
  if (!groups.length) return '';
  const facts = (items) => arr(items)
    .map((i) => [
      '      <div class="fact">',
      `        <dt>${esc(i.name)}</dt>`,
      `        <dd>${i.html || esc(i.detail || '')}</dd>`,
      '      </div>',
    ].join('\n'))
    .join('\n');
  const body = groups.map((g) => [
    g.name ? `    <div class="group-name reveal"${g.id ? ` id="${esc(g.id)}"` : ''}>${esc(g.name)}</div>` : '',
    g.note ? `    <p class="hint reveal">${g.noteHtml || esc(g.note)}</p>` : '',
    '    <div class="facts reveal">',
    facts(g.items),
    '    </div>',
  ].filter(Boolean).join('\n')).join('\n\n');
  return `
  <hr class="rule">

  <section id="verification" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.verification)}</h2>
      ${v.note ? `<p>${esc(v.note)}</p>` : ''}
    </div>

${body}
  </section>`;
}

/* 年表 —— 訂正の登録簿に、記録した日ごとに何件を書いたか（2026-11-14）。
 * **数は手で書かない。**register-timeline.json（build_timeline.js が self-correction の register.csv から作る）を読む。
 * 一行は「日・棒・件数」。棒は飾りで、件数は字で出る。合計も行から数える。
 * 文言は設定の timeline が持つ。{n} に数が入る。 */
function timelineOf(profile) {
  const all = [profile && profile.withdrawn && profile.withdrawn.timeline]
    .concat(arr(profile && profile.blocks).map((b) => b.timeline));
  return all.find((t) => t && t.file) || null;
}

function renderTimeline(t) {
  if (!t || !t.file) return '';
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, t.file), 'utf8'));
  const rows = arr(data.rows);
  if (!rows.length) throw new Error('年表の行がありません: ' + t.file);
  rows.forEach((r) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) || !(Number(r.count) > 0)) throw new Error('年表の行の形: ' + JSON.stringify(r));
  });
  const max = Math.max(...rows.map((r) => Number(r.count)));
  const total = rows.reduce((n, r) => n + Number(r.count), 0);
  const fill = (tpl, n) => esc(String(tpl || '{n}')).replace('{n}', String(n));
  return `
    <div class="timeline reveal">
      <p class="timeline-head">${esc(t.label || '')}</p>
      <ol>
${rows.map((r) => `        <li><time datetime="${esc(r.date)}">${esc(r.date)}</time>${design.barSvg(Number(r.count), max)}<span class="tl-count">${fill(t.unit, r.count)}</span></li>`).join('\n')}
      </ol>
      <p class="timeline-total">${fill(t.total, total)}</p>
    </div>
`;
}

/* 撤回 —— 消さずに残す。空で出すことはしない。 */
function renderWithdrawn(w, labels) {
  if (!w || !arr(w.items).length) return '';
  const rows = arr(w.items)
    .map((i) => [
      '      <div class="fact">',
      `        <dt>${esc(i.name)}</dt>`,
      `        <dd>${i.html || esc(i.detail || '')}</dd>`,
      '      </div>',
    ].join('\n'))
    .join('\n');
  return `
  <hr class="rule">

  <section id="withdrawn" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.withdrawn)}</h2>
      ${w.note ? `<p>${noteHtmlOf(w.note)}</p>` : ''}
    </div>

    <div class="facts reveal">
${rows}
    </div>
${renderTimeline(w.timeline)}${w.recordUrl ? `
    <p class="hint reveal"><a href="${esc(w.recordUrl)}"${linkAttrs(w.recordUrl)}>${esc(w.recordLabel || w.recordUrl)}</a></p>` : ''}
  </section>`;
}

/* 連絡先 —— 批判と誤りの指摘を先に置く。順序は設定ではなく、ここで固定する。 */
function renderContact(c, labels) {
  if (!c) return '';
  if (!c.criticism) {
    throw new Error('contact には criticism（批判・誤りの指摘の宛先）が要ります。'
      + 'それを先に書かない連絡先は置きません。');
  }
  const others = arr(c.others)
    .map((o) => [
      '      <div class="fact">',
      `        <dt>${esc(o.name)}</dt>`,
      `        <dd>${o.html || esc(o.detail || '')}</dd>`,
      '      </div>',
    ].join('\n'))
    .join('\n');
  return `
  <hr class="rule">

  <section id="contact" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.contact)}</h2>
      <p>${esc(labels.contactNote)}</p>
    </div>

    <div class="claim reveal">
      <p class="claim-what">${c.criticismHtml || esc(c.criticism)}</p>
    </div>
${others ? `
    <div class="facts reveal">
${others}
    </div>` : ''}
  </section>`;
}

/* 自由記述の節。トップに一つだけ置く導線などに使う。 */
function renderProse(b, labels) {
  if (!b || !b.html) return '';
  return `
  <hr class="rule">

  <section id="${esc(b.id || 'prose')}" class="wrap block${b.filterable ? ' filterable' : ''}">
${b.anchors ? '    ' + arr(b.anchors).map((a) => `<span id="${esc(a)}"></span>`).join('') + '\n' : ''}    <div class="sec-head reveal">
      <h2 class="serif">${esc(b.title)}</h2>
      ${b.note ? `<p>${b.noteHtml || esc(b.note)}</p>` : ''}
    </div>
    <div class="${esc(b.class || 'notes-list')} reveal">${b.html}</div>
${renderTimeline(b.timeline)}  </section>`;
}

/* 節をどの順に出すか。既定は履歴書の形（修了証が先）。
 * sections を書けば、その順に並ぶ。書かれていない節は出ない。 */
const SECTION_ORDER_DEFAULT = ['credentials', 'areas', 'papers', 'links'];

/* 修得した科目。**外部の修了証とは別に置く。**
 *
 * 修了証は発行機関の検証ページを開けるが、大学の単位はそれができない。
 * 同じ節に混ぜると、検証できるものとできないものが同じ顔で並ぶ。
 */
function renderCourses(groups, labels) {
  if (!groups.length) return '';
  const body = groups.map((g) => {
    const items = arr(g.items);
    const rows = items.map((c) => {
      const note = [c.category,
                    c.credits ? (g.en ? c.credits + ' credits' : c.credits + ' 単位') : '',
                    c.grade ? (g.en ? 'grade ' + c.grade : '評価 ' + c.grade) : '']
        .filter(Boolean).join(g.en ? ', ' : '・');
      return `        <li data-category="${esc(c.category || '')}" data-credits="${Number(c.credits) || 0}"`
        + ` data-grade="${esc(c.grade || '')}">`
        + `<span class="course-name">${esc(c.name)}</span>`
        + (note ? `<span class="course-note">${esc(note)}</span>` : '')
        + '</li>';
    }).join('\n');

    /* **合計は手で書かない。**上の行から数える。
     * 区分が一つしか無いときは内訳を出さない。同じ数を二度書くことになる。 */
    const total = `        <p class="courses-total">${courseTotal(items, !!g.en)}</p>`;

    return [
      '    <div class="group">',
      g.name ? `      <div class="group-name reveal">${esc(g.name)}</div>` : '',
      '      <ul class="courses reveal">',
      rows,
      '      </ul>',
      total,
      '    </div>',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
  return `
  <hr class="rule">

  <section id="courses" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.courses)}</h2>
      ${labels.coursesNote ? `<p>${esc(labels.coursesNote)}</p>` : ''}
      ${groups[0] && groups[0].asOf ? `<p class="as-of">${esc(groups[0].asOf)}</p>` : ''}
    </div>

${body}
  </section>`;
}


/* 自己紹介を、最初の画面から外して節にする（2026-11-12）。
 * sections に 'profile' と書いた頁だけがこうなる。書かない頁は、前と同じく最初の画面に置く。
 * 見出しは自己紹介の板の <h2 class="profile-label"> が持つ。節の見出しを重ねると、同じ語が二度出る。
 * 板の後ろに、紹介の一段（tagline）を置く。README の写しは、板からこの一段の手前までを読む。 */
function renderProfileSection(profile) {
  if (!profile.profile) return '';
  const tag = profile.taglineHtml || profile.tagline;
  return `
  <hr class="rule">

  <section id="profile" class="wrap block profile-section">
${renderProfile(profile.profile, renderIdentifiers(arr(profile.identifiers)))}${tag ? `    <p class="lead reveal">${profile.taglineHtml || esc(profile.tagline)}</p>\n` : ''}  </section>`;
}

/* 図。**トップに一枚だけ置く。既にある図から取る。**
 * 黄金比の窓の図（golden-window.js）の計算を、生成のときに回して SVG にする。
 * 頁ではスクリプトを動かさない。外のファイルも読まない。色は CSS の変数で付ける。 */
function renderFigure(fig) {
  if (!fig || fig.kind !== 'golden-window') return '';
  const gw = require('./golden-window.js');
  const d = Number(fig.delta);
  const W = 600, PAD = 24, LO = 0.45, HI = 0.75;
  const dx = (v) => PAD + (W - 2 * PAD) * (v - LO) / (HI - LO);
  const tx = (v) => PAD + (W - 2 * PAD) * v;
  const r1 = (v) => Math.round(v * 10) / 10;
  const T = fig.labels || {};
  const out = [];
  out.push(`<rect class="band" x="${r1(dx(LO))}" y="18" width="${r1(dx(HI) - dx(LO))}" height="10"/>`);
  out.push(`<rect class="win" x="${r1(dx(gw.PHI_INV))}" y="18" width="${r1(dx(2 / 3) - dx(gw.PHI_INV))}" height="10"/>`);
  out.push(`<text x="${r1((dx(gw.PHI_INV) + dx(2 / 3)) / 2)}" y="12" text-anchor="middle">${esc(T.window || '')}</text>`);
  [[0.5, '1/2'], [gw.PHI_INV, '1/φ'], [2 / 3, '2/3']].forEach(([v, s]) => {
    out.push(`<line class="tick" x1="${r1(dx(v))}" x2="${r1(dx(v))}" y1="16" y2="30"/>`);
    out.push(`<text x="${r1(dx(v))}" y="42" text-anchor="middle">${s}</text>`);
  });
  out.push(`<line class="now" x1="${r1(dx(d))}" x2="${r1(dx(d))}" y1="14" y2="32"/><circle class="now" cx="${r1(dx(d))}" cy="23" r="4"/>`);
  out.push(`<text x="${W - PAD}" y="58" text-anchor="end">${esc(T.deltaAxis || '')}</text>`);
  out.push(`<rect class="band" x="${tx(0)}" y="82" width="${tx(1) - tx(0)}" height="18"/>`);
  /* 区間は千を超える。**一画素より細いものは、画素の列にまとめて描く。**
   * 一つずつ <rect> にすると、図だけで頁が百キロバイトを超える。 */
  const res = gw.tSet(d);
  const cols = new Set();
  res.list.forEach(([a, b]) => {
    for (let x = Math.floor(tx(a)); x <= Math.max(Math.floor(tx(a)), Math.ceil(tx(b)) - 1); x++) cols.add(x);
  });
  const xs = [...cols].sort((a, b) => a - b);
  const runs = [];
  xs.forEach((x) => {
    const last = runs[runs.length - 1];
    if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]);
  });
  out.push(`<path class="set" stroke-width="18" d="${runs.map(([a, b]) => `M${a} 91h${b - a + 1}`).join('')}"/>`);
  [0, 0.5, 1].forEach((v) => out.push(`<text x="${tx(v)}" y="116" text-anchor="middle">${v}</text>`));
  out.push(`<text x="${W - PAD}" y="134" text-anchor="end">${esc(T.tAxis || '')}</text>`);
  return `
  <hr class="rule">

  <section id="diagram" class="wrap block figure-section">
    <figure class="figure reveal">
      <svg viewBox="0 0 ${W} 140" role="img" aria-label="${esc(fig.alt || '')}">${out.join('')}</svg>
      <figcaption>${fig.captionHtml || esc(fig.caption || '')}</figcaption>
    </figure>
  </section>`;
}

function renderSections(profile, labels) {
  const order = arr(profile.sections).length ? arr(profile.sections) : SECTION_ORDER_DEFAULT;
  /* blocks の id が組み込みの節名と同じだと、組み込みのほうが勝つ。
   * 組み込みに渡す配列が空なら、その節は何も出さずに消える。
   * **書いたはずの節が、黙って落ちる。**落ちたことは出力を読んでも分からない。
   * 三言語の頁で実際に起きた（self-correction の SC-033）。ここで止める。 */
  const RESERVED = ['credentials', 'areas', 'courses', 'papers', 'works', 'links',
                    'claim', 'verification', 'withdrawn', 'contact', 'profile', 'diagram'];
  arr(profile.blocks).forEach((b) => {
    if (RESERVED.indexOf(b.id) >= 0) {
      throw new Error('blocks の id が組み込みの節名と同じです: ' + b.id
                      + '（組み込みが勝ち、この節は出ません。別の id にしてください）');
    }
  });
  const known = {
    credentials: () => renderCredentials(arr(profile.credentials), labels),
    areas: () => renderAreas(arr(profile.areas), labels),
    courses: () => renderCourses(arr(profile.courses), labels),
    papers: () => renderPapers(arr(profile.papers), labels, profile),
    profile: () => renderProfileSection(profile),
    diagram: () => renderFigure(profile.figure),
    works: () => renderWorks(arr(profile.works), labels),
    links: () => renderLinks(arr(profile.links), labels),
    claim: () => renderClaim(profile.claim, labels),
    verification: () => renderVerification(profile.verification, labels),
    withdrawn: () => renderWithdrawn(profile.withdrawn, labels),
    contact: () => renderContact(profile.contact, labels),
  };
  return order.map((name) => {
    if (known[name]) return known[name]();
    const b = arr(profile.blocks).find((x) => x.id === name);
    if (b) return renderProse(b, labels);
    throw new Error('sections に知らない節があります: ' + name);
  }).filter(Boolean).join('\n');
}

function renderNav(profile, labels) {
  /* ナビは節の順に従う。ページの並びとナビの並びが食い違うのを防ぐ。 */
  const order = arr(profile.sections).length ? arr(profile.sections) : SECTION_ORDER_DEFAULT;
  const has = {
    credentials: () => arr(profile.credentials).length,
    areas: () => arr(profile.areas).length,
    courses: () => arr(profile.courses).length,
    papers: () => arr(profile.papers).length,
    works: () => arr(profile.works).length,
    links: () => arr(profile.links).length,
    claim: () => !!(profile.claim && profile.claim.statement),
    verification: () => verificationGroups(profile.verification).length > 0,
    withdrawn: () => !!(profile.withdrawn && arr(profile.withdrawn.items).length),
    contact: () => !!profile.contact,
    /* 自己紹介と図はナビに出さない。どちらも最初の画面のすぐ下にある。 */
    profile: () => false,
    diagram: () => false,
  };
  const items = [];
  order.forEach((name) => {
    if (has[name]) {
      if (has[name]()) items.push(`<a href="#${name}">${esc(labels[name] || name)}</a>`);
      return;
    }
    const b = arr(profile.blocks).find((x) => x.id === name);
    /* nav が文字列なら、それを見出しの代わりにナビへ出す。
     * 見出しをそのまま並べると、長い言語では 1 行に収まらず右へ流れる。 */
    if (b && b.nav !== false) {
      const label = typeof b.nav === 'string' ? b.nav : b.title;
      items.push(`<a href="#${esc(b.id)}">${esc(label)}</a>`);
    }
  });
  /* 手で書いたページへの導線。生成の対象外なので、設定から足す。 */
  arr(profile.extraNav).forEach((n) => {
    items.push(`<a href="${esc(n.url)}">${esc(n.name)}</a>`);
  });
  return items.map((i) => `      ${i}`).join('\n');
}

/* ------------------------------------------------------------------ *
 * ファビコン
 * ------------------------------------------------------------------ */

function renderFavicon(profile) {
  const initials = esc(profile.initials || '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${esc(profile.name)}">
  <rect width="64" height="64" rx="14" fill="#16161a"/>
  <text x="32" y="34" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="${initials.length > 2 ? 24 : 30}" font-weight="400" letter-spacing="1"
        fill="${esc(profile.accent || '#b08d57')}">${initials}</text>
</svg>
`;
}

/* ------------------------------------------------------------------ *
 * 生成
 * ------------------------------------------------------------------ */

function build() {
  if (!fs.existsSync(CONFIG)) {
    console.error(`設定ファイルが見つかりません: ${CONFIG}`);
    process.exit(1);
  }

  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch (e) {
    console.error(`設定ファイルを読めません（JSON として不正です）: ${e.message}`);
    process.exit(1);
  }

  /* 同じ本文を別の配信先へ出すときは、違うところだけを重ねる。
   * 本文を二つの設定に写すと、片方だけ直した日にずれる。 */
  if (process.env.PROFILE_OVERLAY) {
    try {
      Object.assign(profile, JSON.parse(fs.readFileSync(process.env.PROFILE_OVERLAY, 'utf8')));
    } catch (e) {
      console.error(`重ねる設定を読めません: ${e.message}`);
      process.exit(1);
    }
  }

  if (!profile.name) {
    console.error('設定ファイルに name がありません。');
    process.exit(1);
  }

  /* 修得した単位は courses.json だけが持つ。**設定に写さない。**
   * 同じ一覧を四つの設定に写すと、科目が増えた日に写し忘れる。
   * ここで言語に合わせて解いてから、節にも学歴の行にも同じものを配る。 */
  if (profile.coursesFile) {
    const src = JSON.parse(
      fs.readFileSync(path.join(ROOT, profile.coursesFile), 'utf8'));
    const en = String(profile.lang || 'ja').slice(0, 2) === 'en';
    const groups = arr(src.groups).map((g) => ({
      id: g.id,
      name: en ? (g.nameEn || g.name) : g.name,
      items: arr(g.items).map((c) => ({
        name: en ? (c.nameEn || c.name) : c.name,
        category: en ? (c.categoryEn || c.category) : c.category,
        credits: c.credits,
        /* 評語はそのまま運ぶ。**言語で置き換えない。**
         * 発行元が印字した一文字である。訳せば別の尺度に見える。 */
        grade: c.grade,
      })),
    }));
    const asOf = asOfLabel(src.asOf, en);
    groups.forEach((g) => { g.en = en; g.asOf = asOf; });
    profile.coursesAsOf = asOf;
    if (profile.coursesSection) profile.courses = groups;
    arr(profile.profile && profile.profile.history).forEach((h) => {
      if (!h.coursesGroup) return;
      const g = groups.find((x) => x.id === h.coursesGroup);
      if (!g) throw new Error('courses.json に無い群を指しています: ' + h.coursesGroup);
      h.courses = g.items;
      h.en = en;
      h.asOf = asOf;
    });
  }

  /* 作者のサイトの意匠（design.js）。当たるのは siteUrl が作者のサイトの頁だけ。 */
  const useDesign = design.applies(profile);

  const labels = Object.assign({}, DEFAULT_LABELS, profile.labels || {});
  const profileInSection = arr(profile.sections).indexOf('profile') >= 0;
  /* 共有カードの画像を頁ごとにする（2026-11-12）。ogCard に置き場の URL を書いた頁は、
   * 正の URL の道筋から画像の名を作る。画像そのものは build_cards.js が頁から作る。 */
  if (profile.ogCard && profile.siteUrl) {
    profile.ogImage = profile.ogCard + cardName(profile.siteUrl) + '.png';
    profile.twitterCard = 'summary_large_image';
  }
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');
  const accent = profile.accent || '#8a6a3d';
  const accentDark = profile.accentDark || '#b08d57';

  const title = profile.title || (profile.nameLatin ? `${profile.name} | ${profile.nameLatin}` : profile.name);
  const canonical = profile.siteUrl ? `<link rel="canonical" href="${esc(profile.siteUrl)}">` : '';
  const ogUrl = profile.siteUrl ? `<meta property="og:url" content="${esc(profile.siteUrl)}">` : '';
  const ogImage = profile.ogImage
    /* カードの型は既定で大きい画像。正方形のロゴだけを見せるときは summary を選ぶ。
     * twitter:image も明示する。X は og:image で補うと書いているが、出ないことがあった。 */
    ? `<meta property="og:image" content="${esc(profile.ogImage)}">\n<meta name="twitter:card" content="${esc(profile.twitterCard || 'summary_large_image')}">\n<meta name="twitter:image" content="${esc(profile.ogImage)}">`
    : '';

  let html = template
    .replace(/{{LANG}}/g, esc(profile.lang || 'ja'))
    .replace(/{{TITLE}}/g, esc(title))
    .replace(/{{DESCRIPTION}}/g, esc(profile.description || profile.tagline || ''))
    .replace(/{{CANONICAL}}/g, canonical)
    .replace(/{{OG_URL}}/g, ogUrl)
    .replace(/{{OG_IMAGE}}/g, ogImage)
    .replace(/{{ACCENT}}/g, esc(accent))
    .replace(/{{ACCENT_DARK}}/g, esc(accentDark))
    .replace(/{{INITIALS}}/g, esc(profile.initials || ''))
    .replace(/{{NAV}}/g, renderNav(profile, labels))
    .replace(/{{EYEBROW}}/g, labels.eyebrow ? `    <p class="eyebrow reveal">${esc(labels.eyebrow)}</p>\n` : '')
    .replace(/{{NAME}}/g, esc(profile.name))
    .replace(/{{NAME_LATIN}}/g, profile.nameLatin ? `    <p class="romaji reveal">${esc(profile.nameLatin)}</p>` : '')
    .replace(/{{IDENTIFIERS}}/g, profileInSection ? '' : renderIdentifiers(arr(profile.identifiers)))
    .replace(/{{PROFILE}}/g, profileInSection ? '' : renderProfile(profile.profile))
    /* 規則の要約のように、外側が動くものを載せた頁は、いつ時点かを出す。
     * 日付は設定の asOf 一つが持つ。頁の言語に合わせて書き直すだけである。 */
    /* 最初の画面の一文（lead）を書いた頁は、紹介の一段（tagline）を自己紹介の節へ送る。 */
    .replace(/{{TAGLINE}}/g, ((profile.leadHtml || profile.lead)
      ? `    <p class="hero-what reveal">${profile.leadHtml || esc(profile.lead)}</p>`
      : (!profileInSection && (profile.taglineHtml || profile.tagline))
        ? `    <p class="lead reveal">${profile.taglineHtml || esc(profile.tagline)}</p>` : '')
      + (profile.asOf
        ? `\n    <p class="as-of reveal">${esc(asOfLabel(profile.asOf,
            String(profile.lang || 'ja').slice(0, 2) === 'en'))}</p>` : ''))
    .replace(/{{ENTRIES}}/g, renderEntries(profile.entries) + renderFilter(profile.filter))
    .replace(/{{SECTIONS}}/g, renderSections(profile, labels))
    /* 下の階層に置くページは、ファビコンを一段上から参照する。
      * 決め打ちにすると notes/ の中でリンク切れになる。 */
    .replace(/{{FAVICON}}/g, esc(profile.favicon || './favicon.svg'))
    /* 論文ごとのページは article、それ以外は profile。既定は変えない。 */
    .replace(/{{OG_TYPE}}/g, esc(profile.ogType || 'profile'))
    .replace(/{{HEAD_EXTRA}}/g, [
      /* 言語ごとの版がある場合の相互参照。片方だけ直すのを防ぐため設定から出す。 */
      ...arr(profile.alternates).map((a) =>
        `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.url)}">`),
      ...arr(profile.headExtra),
    ].join('\n'))
    .replace(/{{JSONLD}}/g, profile.jsonld
      ? '<script type="application/ld+json">\n'
        + JSON.stringify(profile.jsonld, null, 2) + '\n</script>\n'
      : '')
    .replace(/{{FOOTER}}/g, esc(profile.footer || ''))
    /* 頁の下の欄に、運営・連絡・免責への道と、中身が変わった日を置く（2026-11-11）。
     * 設定に書いた頁だけに出す。書いていない頁の出力は、一字一句前と同じである。 */
    .replace(/{{FOOTER_EXTRA}}/g, renderFooterExtra(profile))
    .replace(/{{EXTRA_CSS}}/g, extraCss(profile) + (useDesign ? design.css() : ''))
    .replace(/{{BAND}}/g, useDesign ? '\n  ' + design.bandSvg() : '')
    .replace(/{{SKIP}}/g, esc(labels.skip))
    .replace(/{{THEME_TOGGLE}}/g, esc(labels.themeToggle));

  /* **場の言葉のまま置いた引用を、翻訳に食わせない。**
   * <code> の中身は、掲載基準の原文と DOI と識別子である。訳す対象ではない。
   * ブラウザの翻訳を通すと、周りの日本語ごと書き換えられ、引用の位置まで動く。
   * 2026年9月12日、利用者が翻訳越しに読んだ頁では「専門職の水準」が
   * 「専門職の一時」に、「脅迫・嫌がらせ」が「注意・嫌がらせ」に化け、
   * PhilArchive の見出しごと落ちていた。**引用であることが消える。**
   * translate="no" は標準の属性、notranslate は Google の翻訳が見る印である。 */
  html = html.replace(/<code>/g, '<code translate="no" class="notranslate">');

  /* 意匠の飾り。名前の下に長いもの、節の見出しの下に短いものを置く。
   * 見出しの字は変えない。飾りは読み上げない。 */
  if (useDesign) {
    html = html
      .replace('<section class="wrap hero">\n', '<section class="wrap hero">\n    ' + design.sealSvg() + '\n')
      .replace(/(<h1 class="serif reveal">[^\n]*<\/h1>\n(?: {4}<p class="romaji reveal">[^\n]*<\/p>\n)?)/,
        '$1    ' + design.ornamentSvg('long') + '\n')
      .replace(/(<div class="sec-head reveal">\n\s*<h2 class="serif">[^\n]*<\/h2>)/g,
        '$1\n      ' + design.ornamentSvg('short'))
      .replace(/(\n( *)<h2 class="profile-label">[^\n]*<\/h2>)/g,
        (m, a, ind) => a + '\n' + ind + design.ornamentSvg('short'));
  }

  /* 頁に固有のスクリプト。**外のファイルを読みに行かせない。**中身を頁に入れ、
   * CSP はその中身のハッシュで許す（withCSP）。'unsafe-inline' は使わない。
   * 出所は researcher-profile の中のファイルで、設定には名前だけを書く。
   * 手で頁に書き足すと、次の生成で消える。 */
  arr(profile.scripts).forEach((name) => {
    const file = path.join(ROOT, name);
    if (path.dirname(path.resolve(file)) !== ROOT || !fs.existsSync(file)) {
      throw new Error('scripts に書いたファイルがありません（researcher-profile の直下に置きます）: ' + name);
    }
    const code = fs.readFileSync(file, 'utf8');
    if (/<\/script/i.test(code)) throw new Error('scripts の中身に </script> があります: ' + name);
    html = html.replace(/<\/body>/, '<script>\n' + code.replace(/\s+$/, '') + '\n</script>\n</body>');
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), withCSP(html));
  if (!profile.favicon) {
    fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), renderFavicon(profile));
  }
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

  const certCount = arr(profile.credentials).reduce((n, g) => n + arr(g.items).length, 0);
  const linkCount = arr(profile.links).reduce((n, g) => n + arr(g.items).length, 0);
  console.log(`生成しました: ${path.relative(process.cwd(), OUT_DIR)}/index.html`);
  console.log(`  修了証 ${certCount} 件 / 領域 ${arr(profile.areas).length} 件 / 論文 ${arr(profile.papers).length} 件 / リンク ${linkCount} 件`);
}

build();
