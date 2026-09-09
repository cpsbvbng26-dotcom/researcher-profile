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


function renderProfile(p) {
  if (!p) return '';
  const rows = arr(p.history).map((h, i, all) => {
    const now = i === all.length - 1;
    /* 単位を取った科目は、この行に入れる。**合計は行から数える。**
     * note を手で書いた場合はそれを使うが、courses があるほうを優先する。 */
    const cs = arr(h.courses);
    let note = h.note || '';
    let list = '';
    if (cs.length) {
      note = courseTotal(cs, !!h.en);
      list = '<ul class="path-courses">'
        + cs.map((c) => `<li data-category="${esc(c.category || '')}" `
            + `data-credits="${Number(c.credits) || 0}">${esc(c.name)}`
            + (c.category ? `<i>${esc(c.category)}</i>` : '') + '</li>').join('')
        + '</ul>';
    }
    return `      <li${now ? ' class="path-now"' : ''}>`
      + `<span class="path-name">${esc(h.name)}</span>`
      + `<span class="path-state">${esc(h.state)}</span>`
      + (note ? `<span class="path-note">${esc(note)}</span>` : '')
      + list
      + '</li>';
  }).join('\n');
  const aims = arr(p.aims).map((a) => `      <li>${esc(a)}</li>`).join('\n');
  return [
    /* section にしない。ヒーローの検査は最初の </section> で切るので、
     * 入れ子にすると査読前の断りがヒーローの外に出る。実際に一度そうなった。 */
    '    <div class="profile reveal">',
    `      <h2 class="profile-label">${esc(p.label || '')}</h2>`,
    `      <p class="profile-now">${p.nowHtml || esc(p.now || '')}</p>`,
    p.studyHtml ? `      <p class="profile-now profile-study">${p.studyHtml}</p>` : '',
    rows ? '      <ol class="path">' : '',
    rows,
    rows ? '      </ol>' : '',
    aims ? `      <p class="aims-label">${esc(p.aimsLabel || '')}</p>` : '',
    aims ? '      <ul class="aims">' : '',
    aims,
    aims ? '      </ul>' : '',
    '    </div>'
  ].filter((x) => x !== '').join('\n') + '\n';
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

function renderPapers(papers, labels) {
  return renderCards(papers, 'papers', labels.papers, labels.papersNote, labels);
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
       * 文字で出すだけでは辿れないため、一つずつリンクにする。 */
      const where = arr(item.locations).length
        ? `      <p class="where">${arr(item.locations).map((l) => (l.url
            ? `<a href="${esc(l.url)}"${linkAttrs(l.url)}>${esc(l.name)}${l.id ? ' ' + esc(l.id) : ''}</a>`
            : esc(l.name) + (l.id ? ' ' + esc(l.id) : ''))).join('　／　')}</p>`
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

/* 検証 —— 何項目がどこで走るか。数だけ書いて中身が無いものは出さない。 */
function renderVerification(v, labels) {
  if (!v || !arr(v.items).length) return '';
  const rows = arr(v.items)
    .map((i) => [
      '      <div class="fact">',
      `        <dt>${esc(i.name)}</dt>`,
      `        <dd>${i.html || esc(i.detail || '')}</dd>`,
      '      </div>',
    ].join('\n'))
    .join('\n');
  return `
  <hr class="rule">

  <section id="verification" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.verification)}</h2>
      ${v.note ? `<p>${esc(v.note)}</p>` : ''}
    </div>

    <div class="facts reveal">
${rows}
    </div>
  </section>`;
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
      ${w.note ? `<p>${esc(w.note)}</p>` : ''}
    </div>

    <div class="facts reveal">
${rows}
    </div>
${w.recordUrl ? `
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

  <section id="${esc(b.id || 'prose')}" class="wrap block">
${b.anchors ? '    ' + arr(b.anchors).map((a) => `<span id="${esc(a)}"></span>`).join('') + '\n' : ''}    <div class="sec-head reveal">
      <h2 class="serif">${esc(b.title)}</h2>
      ${b.note ? `<p>${b.noteHtml || esc(b.note)}</p>` : ''}
    </div>
    <div class="${esc(b.class || 'notes-list')} reveal">${b.html}</div>
  </section>`;
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
      const note = [c.category, c.credits ? c.credits + ' 単位' : ''].filter(Boolean).join('・');
      return `        <li data-category="${esc(c.category || '')}" data-credits="${Number(c.credits) || 0}">`
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
    </div>

${body}
  </section>`;
}


function renderSections(profile, labels) {
  const order = arr(profile.sections).length ? arr(profile.sections) : SECTION_ORDER_DEFAULT;
  const known = {
    credentials: () => renderCredentials(arr(profile.credentials), labels),
    areas: () => renderAreas(arr(profile.areas), labels),
    courses: () => renderCourses(arr(profile.courses), labels),
    papers: () => renderPapers(arr(profile.papers), labels),
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
    verification: () => !!(profile.verification && arr(profile.verification.items).length),
    withdrawn: () => !!(profile.withdrawn && arr(profile.withdrawn.items).length),
    contact: () => !!profile.contact,
  };
  const items = [];
  order.forEach((name) => {
    if (has[name]) {
      if (has[name]()) items.push(`<a href="#${name}">${esc(labels[name] || name)}</a>`);
      return;
    }
    const b = arr(profile.blocks).find((x) => x.id === name);
    if (b && b.nav !== false) items.push(`<a href="#${esc(b.id)}">${esc(b.title)}</a>`);
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
      })),
    }));
    groups.forEach((g) => { g.en = en; });
    if (profile.coursesSection) profile.courses = groups;
    arr(profile.profile && profile.profile.history).forEach((h) => {
      if (!h.coursesGroup) return;
      const g = groups.find((x) => x.id === h.coursesGroup);
      if (!g) throw new Error('courses.json に無い群を指しています: ' + h.coursesGroup);
      h.courses = g.items;
      h.en = en;
    });
  }

  const labels = Object.assign({}, DEFAULT_LABELS, profile.labels || {});
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');
  const accent = profile.accent || '#8a6a3d';
  const accentDark = profile.accentDark || '#b08d57';

  const title = profile.title || (profile.nameLatin ? `${profile.name} | ${profile.nameLatin}` : profile.name);
  const canonical = profile.siteUrl ? `<link rel="canonical" href="${esc(profile.siteUrl)}">` : '';
  const ogUrl = profile.siteUrl ? `<meta property="og:url" content="${esc(profile.siteUrl)}">` : '';
  const ogImage = profile.ogImage
    ? `<meta property="og:image" content="${esc(profile.ogImage)}">\n<meta name="twitter:card" content="summary_large_image">`
    : '';

  const html = template
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
    .replace(/{{EYEBROW}}/g, esc(labels.eyebrow))
    .replace(/{{NAME}}/g, esc(profile.name))
    .replace(/{{NAME_LATIN}}/g, profile.nameLatin ? `    <p class="romaji reveal">${esc(profile.nameLatin)}</p>` : '')
    .replace(/{{IDENTIFIERS}}/g, renderIdentifiers(arr(profile.identifiers)))
    .replace(/{{PROFILE}}/g, renderProfile(profile.profile))
    .replace(/{{TAGLINE}}/g, (profile.taglineHtml || profile.tagline)
      ? `    <p class="lead reveal">${profile.taglineHtml || esc(profile.tagline)}</p>` : '')
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
    .replace(/{{SKIP}}/g, esc(labels.skip))
    .replace(/{{THEME_TOGGLE}}/g, esc(labels.themeToggle));

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
