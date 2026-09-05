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
  links: 'リンク',
  verify: '確認',
  skip: '本文へスキップ',
  themeToggle: 'テーマを切り替える',
};

/* ------------------------------------------------------------------ *
 * 各部品の組み立て
 * ------------------------------------------------------------------ */

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

function renderPapers(papers, labels) {
  if (!papers.length) return '';

  const cards = papers
    .map((item) => {
      const tag = item.url ? 'a' : 'div';
      const href = item.url ? ` href="${esc(item.url)}"${linkAttrs(item.url)}` : '';
      return [
        `      <${tag} class="cert reveal"${href}>`,
        item.code ? `        <span class="code">${esc(item.code)}</span>` : '',
        `        <h3>${esc(item.title)}</h3>`,
        item.subtitle ? `        <p class="alt">${esc(item.subtitle)}</p>` : '',
        item.summary ? `        <p class="issuer">${esc(item.summary)}</p>` : '',
        item.doi ? `        <p class="doi">DOI ${esc(item.doi)}</p>` : '',
        item.url ? `        <span class="verify">${esc(item.verify || labels.verify)}</span>` : '',
        `      </${tag}>`,
      ].filter(Boolean).join('\n');
    })
    .join('\n');

  return `
  <hr class="rule">

  <section id="papers" class="wrap block">
    <div class="sec-head reveal">
      <h2 class="serif">${esc(labels.papers)}</h2>
      ${labels.papersNote ? `<p>${esc(labels.papersNote)}</p>` : ''}
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

function renderNav(profile, labels) {
  const items = [];
  if (arr(profile.credentials).length) items.push(`<a href="#credentials">${esc(labels.credentials)}</a>`);
  if (arr(profile.areas).length) items.push(`<a href="#areas">${esc(labels.areas)}</a>`);
  if (arr(profile.papers).length) items.push(`<a href="#papers">${esc(labels.papers)}</a>`);
  if (arr(profile.links).length) items.push(`<a href="#links">${esc(labels.links)}</a>`);
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
    .replace(/{{TAGLINE}}/g, profile.tagline ? `    <p class="lead reveal">${esc(profile.tagline)}</p>` : '')
    .replace(/{{CREDENTIALS}}/g, renderCredentials(arr(profile.credentials), labels))
    .replace(/{{AREAS}}/g, renderAreas(arr(profile.areas), labels))
    .replace(/{{PAPERS}}/g, renderPapers(arr(profile.papers), labels))
    .replace(/{{LINKS}}/g, renderLinks(arr(profile.links), labels))
    .replace(/{{FOOTER}}/g, esc(profile.footer || ''))
    .replace(/{{SKIP}}/g, esc(labels.skip))
    .replace(/{{THEME_TOGGLE}}/g, esc(labels.themeToggle));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), renderFavicon(profile));
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

  const certCount = arr(profile.credentials).reduce((n, g) => n + arr(g.items).length, 0);
  const linkCount = arr(profile.links).reduce((n, g) => n + arr(g.items).length, 0);
  console.log(`生成しました: ${path.relative(process.cwd(), OUT_DIR)}/index.html`);
  console.log(`  修了証 ${certCount} 件 / 領域 ${arr(profile.areas).length} 件 / 論文 ${arr(profile.papers).length} 件 / リンク ${linkCount} 件`);
}

build();
