/* 全作品の目録と、道具の一覧を、catalog.json から作る。
 *
 *   CATALOG_OUT=../cpsbvbng26-dotcom node build_catalog.js
 *
 * 出すもの（どれも生成物。手で直さない）
 *   catalog.html / catalog.en.html   種類ごとの目録
 *   tools.html / tools.en.html       道具の一覧（目録の「ソフトウェア」のうち tool の印があるもの）
 *   catalog.json                     同じ中身を、機械が読む形で
 *   catalog.bib                      同じ中身を、引用の管理の道具が読む形で
 *
 * 出所は catalog.json の一箇所だけである。頁は build.js をそのまま呼んで作るので、
 * head・ナビ・CSP・構造化データの作りはトップと同じものになる。
 *
 * **ライセンスの列は手で書かない。**置いてあるリポジトリの LICENSE の置き方から出す。
 * 置き方の表は catalog.json の licenceLayout にあり、check_ecosystem.js が
 * 各リポジトリの LICENSE と突き合わせる。
 *
 * **散文に数を書かない。**件数は表の行が持つ。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const OUT = process.env.CATALOG_OUT
  ? path.resolve(process.env.CATALOG_OUT)
  : path.join(ROOT, 'dist', 'catalog');
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${text}</a>`;
const doiUrl = (d) => 'https://doi.org/' + d;

const L = {
  ja: {
    file: 'catalog.html', other: 'catalog.en.html', tools: 'tools.html', toolsOther: 'tools.en.html',
    top: './index.html', name: '全作品の目録', nameLatin: 'Catalogue of works', eyebrow: 'Catalogue',
    title: '全作品の目録 | 根本卓哉',
    description: '根本卓哉の作品を種類ごとに並べた目録です。題・種類・状態・DOI・正の所在・ライセンス・Zenodo の資源の種類・始めた時期を一表にしています。',
    tagline: '作品を種類ごとに並べます。各行に、状態・DOI・正の所在・ライセンス・Zenodo の資源の種類・始めた時期を置きます。'
      + 'どの作品も査読を受けていません。DOI があることは、査読を受けたことを意味しません。',
    cols: ['題', '種類', '状態', 'DOI', '正の所在', 'ライセンス', 'Zenodo の種類', '始めた時期'],
    year1: '学部一年次', year2: '学部二年次', yearUnknown: '—（確かめていない）', year1Cont: '学部一年次の成果（{}）の続き',
    rulesYear: '始めた時期は、作品を置いたリポジトリの最初のコミットの日付から出しています。学部二年次は 2026 年 10 月からです。',
    concept: '全版', also: '別の所在',
    noRepo: '—（リポジトリに置いていない）',
    mit: 'MIT（全体）', split: 'CC BY 4.0（文書）・MIT（コード）', splitText: 'CC BY 4.0（文書と論文）',
    noType: '—', notZenodo: '—（Zenodo に無い）', figshare: '（Figshare）', noDoi: '—（DOI を持たない）',
    dataTitle: '機械で読む形と、列の決め方', dataNav: '機械で読む形',
    dataNote: '同じ中身を、JSON と BibTeX でも配っています。',
    json: '目録の JSON', jsonNote: '題・種類・状態・DOI・正の所在・ライセンス・Zenodo の資源の種類・始めた時期を、作品ごとに',
    bib: '目録の BibTeX', bibNote: 'DOI を持つ作品の書誌。引用の管理の道具にそのまま取り込めます',
    rulesCanon: '正の所在は、正本の優先順位の決めに従います',
    rulesLicence: 'ライセンスの列は、置いてあるリポジトリの LICENSE の置き方から出しています。',
    rulesLicence2: 'リポジトリに置いていない作品は、置き場の記録の表示に従います。',
    rulesType: 'Zenodo の種類は、DataCite に登録された資源の種類です。検査が DataCite の記録と突き合わせます。',
    rulesGen: 'この頁と JSON と BibTeX は、researcher-profile の catalog.json から生成しています。',
    canonDoc: '正本の優先順位', disclaimer: '免責事項', source: '生成もと（catalog.json）',
    toolsName: '道具の一覧', toolsLatin: 'Tools', toolsEyebrow: 'Tools', toolsTitle: '道具の一覧 | 根本卓哉',
    toolsDescription: '根本卓哉が公開している道具の一覧です。一つずつ、何をするか・リポジトリ・DOI・ライセンスを並べます。',
    toolsTagline: 'ほかの人も使える道具です。一つずつ、何をするか・リポジトリ・DOI・ライセンスを並べます。',
    toolsSection: '道具', toolsSectionNote: '目録の「ソフトウェア」の行と同じ中身です。',
    repoLabel: 'リポジトリ', licenceLabel: 'ライセンス', backCatalog: '目録', backTop: '核へ戻る',
    operator: '作用素', lang: '日本語', otherLang: 'English',
    sep: '　／　', skip: '本文へスキップ', theme: 'テーマを切り替える',
  },
  en: {
    file: 'catalog.en.html', other: 'catalog.html', tools: 'tools.en.html', toolsOther: 'tools.html',
    top: './index.en.html', name: 'Catalogue of works', nameLatin: '全作品の目録', eyebrow: 'Catalogue',
    title: 'Catalogue of works | Takuya Nemoto',
    description: 'The works of Takuya Nemoto by type, in one table: title, type, status, DOI, canonical location, licence, Zenodo resource type and the period in which it was begun.',
    tagline: 'The works, by type. Each row gives the status, DOI, canonical location, licence, Zenodo resource type and the period in which it was begun. '
      + 'None of the works has been peer-reviewed. A DOI does not imply peer review.',
    cols: ['Title', 'Type', 'Status', 'DOI', 'Canonical location', 'Licence', 'Zenodo resource type', 'Begun'],
    year1: 'First undergraduate year', year2: 'Second undergraduate year', yearUnknown: '— (not checked)', year1Cont: 'Continuation of first-year work ({})',
    rulesYear: 'The period begun is taken from the first commit of the repository that holds the work. The second undergraduate year began in October 2026.',
    concept: 'all versions', also: 'also',
    noRepo: '— (not in a repository)',
    mit: 'MIT (whole repository)', split: 'CC BY 4.0 (texts) and MIT (code)', splitText: 'CC BY 4.0 (texts and papers)',
    noType: '—', notZenodo: '— (not on Zenodo)', figshare: ' (Figshare)', noDoi: '— (no DOI)',
    dataTitle: 'Machine-readable forms, and how the columns are decided', dataNav: 'Data',
    dataNote: 'The same content is also published as JSON and BibTeX.',
    json: 'Catalogue as JSON', jsonNote: 'Title, type, status, DOI, canonical location, licence, Zenodo resource type and period begun, for each work',
    bib: 'Catalogue as BibTeX', bibNote: 'Records for the works with a DOI, ready for a reference manager',
    rulesCanon: 'The canonical location follows the rules on which copy is canonical',
    rulesLicence: "The licence column is generated from the LICENSE layout of the repository that holds the work.",
    rulesLicence2: 'For a work not held in a repository, the licence shown by its record applies.',
    rulesType: 'The Zenodo resource type is the resource type registered with DataCite. A check compares it with the DataCite record.',
    rulesGen: 'This page, the JSON and the BibTeX are generated from catalog.json in researcher-profile.',
    canonDoc: 'Which copy is canonical', disclaimer: 'Disclaimer', source: 'Source (catalog.json)',
    toolsName: 'Tools', toolsLatin: '道具の一覧', toolsEyebrow: 'Tools', toolsTitle: 'Tools | Takuya Nemoto',
    toolsDescription: 'The tools published by Takuya Nemoto. For each: what it does, the repository, the DOI and the licence.',
    toolsTagline: 'Tools that others can use. For each: what it does, the repository, the DOI and the licence.',
    toolsSection: 'Tools', toolsSectionNote: 'The same content as the Software rows of the catalogue.',
    repoLabel: 'Repository', licenceLabel: 'Licence', backCatalog: 'Catalogue', backTop: 'Profile',
    operator: 'Operator', lang: 'English', otherLang: '日本語',
    sep: ' / ', skip: 'Skip to content', theme: 'Toggle theme',
  },
};

/* ------------------------------------------------------------ 値を解く */

function layoutOf(repo) {
  if (!repo) return null;
  if (SRC.licenceLayout.mit.includes(repo)) return 'mit';
  if (SRC.licenceLayout.split.includes(repo)) return 'split';
  throw new Error('licenceLayout に無いリポジトリです: ' + repo);
}

/* SPDX の並び。JSON と構造化データに使う。 */
function licenceSpdx(w) {
  const lay = layoutOf(w.repo);
  if (lay === 'mit') return ['MIT'];
  if (lay === 'split') return w.kind === 'repository' ? ['CC-BY-4.0', 'MIT'] : ['CC-BY-4.0'];
  return [];
}

function licenceText(w, t) {
  const lay = layoutOf(w.repo);
  if (lay === 'mit') return t.mit;
  if (lay === 'split') return w.kind === 'repository' ? t.split : t.splitText;
  return t.noRepo;
}

const typeOf = (id) => {
  const ty = SRC.types.find((x) => x.id === id);
  if (!ty) throw new Error('知らない種類です: ' + id);
  return ty;
};
const statusOf = (id) => {
  const s = SRC.statuses[id];
  if (!s) throw new Error('知らない状態です: ' + id);
  return s;
};

function canonicalOf(w, lang) {
  const c = SRC.canonical[w.canonical];
  if (!c) throw new Error('知らない正の所在です: ' + w.canonical);
  let url = null;
  if (w.canonical === 'zenodo' || w.canonical === 'figshare' || w.canonical === 'ssrn') url = doiUrl(w.doi);
  else if (w.canonical === 'github') url = SRC.gh + w.repo;
  else if (c.url) url = c.url;
  return { name: lang === 'en' ? c.en : c.ja, url, rule: lang === 'en' ? c.ruleEn : c.ruleJa };
}

function resourceTypeText(w, t) {
  if (!w.doi) return t.noDoi;
  if (w.registry === 'Crossref') return t.notZenodo;
  if (w.registry === 'Figshare') return esc(w.resourceType) + t.figshare;
  return esc(w.resourceType || t.noType);
}

/* 始めた時期。**作品を置いたリポジトリの最初のコミットの日付から出す。**
 * 置いていない作品は、startRepo（続きにあたるリポジトリ）か、記録にある startDate を使う。
 * どれも無ければ「確かめていない」と出す。推測で学年を当てない。 */
function begunOf(w) {
  const Y = SRC.years;
  let date = null, basis = null;
  if (Object.prototype.hasOwnProperty.call(w, 'startDate')) { date = w.startDate; basis = date ? 'record' : null; }
  else {
    const repo = w.startRepo || w.repo;
    if (repo) {
      if (!Y.firstCommit[repo]) throw new Error('years.firstCommit に無いリポジトリです: ' + repo);
      date = Y.firstCommit[repo]; basis = 'first commit of ' + repo;
    }
  }
  const period = date ? (date < Y.secondYearFrom ? 'first' : 'second') : null;
  return { date, basis, period };
}
/* 学部一年次の成果の続き（決めごと 15 が許すもの）は、その旨を名指す。黄金比の窓の予想は Trinity-Infinity の続きである。 */
const begunText = (w, t) => { const b = begunOf(w); if (b.period === 'first' && w.continues) return t.year1Cont.replace('{}', w.continues); return b.period === 'first' ? t.year1 : b.period === 'second' ? t.year2 : t.yearUnknown; };

/* ------------------------------------------------------------ 表 */

function doiCell(w, t) {
  if (!w.doi) return t.noDoi;
  const parts = [ext(doiUrl(w.doi), '<code>' + esc(w.doi) + '</code>')];
  if (w.conceptDoi) parts.push(t.concept + ' ' + ext(doiUrl(w.conceptDoi), '<code>' + esc(w.conceptDoi) + '</code>'));
  (w.otherDois || []).forEach((d) => parts.push(t.also + ' ' + ext(doiUrl(d), '<code>' + esc(d) + '</code>')));
  return parts.join('<br>');
}

function titleCell(w, lang) {
  const main = lang === 'en' && w.titleEn ? w.titleEn : w.title;
  const sub = lang === 'en' ? w.summaryEn : w.summaryJa;
  return `<b>${esc(main)}</b><br><span>${esc(sub)}</span>`;
}

function row(w, lang) {
  const t = L[lang];
  const ty = typeOf(w.type);
  const c = canonicalOf(w, lang);
  const cells = [
    titleCell(w, lang),
    esc(lang === 'en' ? ty.en : ty.ja),
    esc(lang === 'en' ? statusOf(w.status).en : statusOf(w.status).ja),
    doiCell(w, t),
    c.url ? ext(c.url, esc(c.name)) : esc(c.name),
    esc(licenceText(w, t)),
    resourceTypeText(w, t),
    esc(begunText(w, t)),
  ];
  return `        <tr id="${esc(w.id)}">` + cells.map((x) => `<td>${x}</td>`).join('') + '</tr>';
}

function table(works, lang) {
  const t = L[lang];
  return [
    '',
    '      <table>',
    '        <thead><tr>' + t.cols.map((x) => `<th scope="col">${esc(x)}</th>`).join('') + '</tr></thead>',
    '        <tbody>',
    ...works.map((w) => row(w, lang)),
    '        </tbody>',
    '      </table>',
    '    ',
  ].join('\n');
}

/* 表の見た目。**新しい色を作らない。**頁の既存の色の名前だけを使う。
 * テンプレートを直すと全部の頁のハッシュが変わるので、この頁の head にだけ足す。 */
const TABLE_STYLE = '<style>'
  + '.wrap:has(.catalog){max-width:72rem}'
  + '.notes-list.catalog{max-width:none}'
  + '.notes-list.catalog table{border-collapse:collapse;width:100%;font-size:.8rem;line-height:1.7}'
  + '.notes-list.catalog th,.notes-list.catalog td{text-align:left;vertical-align:top;padding:.55rem .6rem;border-bottom:1px solid var(--line-soft)}'
  + '.notes-list.catalog th{font-weight:400;color:var(--faint);letter-spacing:.06em;white-space:nowrap}'
  + '.notes-list.catalog td:nth-child(2),.notes-list.catalog td:nth-child(3),.notes-list.catalog td:nth-child(7),.notes-list.catalog td:nth-child(8){white-space:nowrap}'
  + '.notes-list.catalog table td code{white-space:nowrap;overflow-wrap:normal}'
  + '.notes-list.catalog td span{display:inline;margin:0;font-size:.76rem;color:var(--muted)}'
  + '.notes-list.catalog td b{font-weight:600;color:var(--text)}'
  + '</style>';

const ICONS = [
  '<link rel="icon" href="./favicon.ico" sizes="48x48">',
  '<link rel="icon" href="./favicon-192.png" sizes="192x192" type="image/png">',
  '<link rel="apple-touch-icon" href="./apple-touch-icon.png">',
];

/* ------------------------------------------------------------ 構造化データ */

const PERSON = {
  '@type': 'Person',
  '@id': SRC.base + '#person',
  affiliation: { '@type': 'CollegeOrUniversity', name: 'ZEN University' },
  name: 'Takuya Nemoto',
  alternateName: '根本卓哉',
  identifier: 'https://orcid.org/' + SRC.orcid,
  url: SRC.base,
};

const LICENCE_URL = { MIT: 'https://opensource.org/licenses/MIT', 'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/' };

/* データセットの印。Google Dataset Search が読む形にする。
 * description は 50 字以上が要る。要約に、置き場の説明を一文足す。 */
function datasetNode(w) {
  const name = w.titleEn || w.title;
  const node = {
    '@type': 'Dataset',
    '@id': doiUrl(w.doi),
    name,
    description: w.summaryEn + '. Archived on Zenodo; the maintained repository is on GitHub. Not peer-reviewed.',
    url: doiUrl(w.doi),
    identifier: [{ '@type': 'PropertyValue', propertyID: 'DOI', value: w.doi }],
    sameAs: [SRC.gh + w.repo],
    version: w.version,
    license: licenceSpdx(w).map((x) => LICENCE_URL[x]),
    creator: { '@id': PERSON['@id'] },
    isAccessibleForFree: true,
    keywords: w.keywords || [],
    includedInDataCatalog: { '@type': 'DataCatalog', name: 'Zenodo', url: 'https://zenodo.org/' },
    publisher: { '@type': 'Organization', name: 'Zenodo' },
  };
  if (w.title !== name) node.alternateName = w.title;
  if (w.conceptDoi) node.isPartOf = { '@type': 'CreativeWork', '@id': doiUrl(w.conceptDoi), identifier: w.conceptDoi };
  return node;
}

function catalogJsonld(lang) {
  const url = SRC.base + L[lang].file;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': url, url, name: L[lang].name, inLanguage: lang,
        author: { '@id': PERSON['@id'] } },
      PERSON,
      ...SRC.works.filter((w) => w.type === 'dataset').map(datasetNode),
    ],
  };
}

/* ------------------------------------------------------------ 頁の設定 */

function base(lang, file, otherFile, name, nameLatin, eyebrow, title, description, tagline) {
  const t = L[lang];
  const en = lang === 'en';
  const jaFile = en ? otherFile : file;
  const enFile = en ? file : otherFile;
  return {
    name, nameLatin, initials: 'TN', lang,
    title, description,
    siteUrl: SRC.base + file,
    alternates: [
      { lang: 'ja', url: SRC.base + jaFile },
      { lang: 'en', url: SRC.base + enFile },
      { lang: 'x-default', url: SRC.base + jaFile },
    ],
    ogImage: SRC.base + 'og.png',
    twitterCard: 'summary',
    ogType: 'website',
    accent: SRC.accent, accentDark: SRC.accentDark,
    footer: SRC.footer,
    footerSet: lang, updatedFrom: ['catalog.json'],
    taglineHtml: esc(tagline),
    asOf: SRC.asOf,
    labels: { eyebrow, verify: en ? 'Open' : '開く', skip: t.skip, themeToggle: t.theme },
    headExtra: ICONS.slice(),
  };
}

function catalogConfig(lang) {
  const t = L[lang];
  const en = lang === 'en';
  const cfg = base(lang, t.file, t.other, t.name, t.nameLatin, t.eyebrow, t.title, t.description, t.tagline);
  cfg.headExtra.push(TABLE_STYLE);
  const blocks = SRC.types.map((ty) => {
    const works = SRC.works.filter((w) => w.type === ty.id);
    if (!works.length) throw new Error('作品の無い種類があります: ' + ty.id);
    return {
      id: ty.id, title: en ? ty.en : ty.ja, note: en ? ty.noteEn : ty.noteJa,
      class: 'notes-list catalog', html: table(works, lang),
    };
  });
  const canonRules = [...new Set(Object.keys(SRC.canonical).filter((k) => k !== '_')
    .map((k) => en ? SRC.canonical[k].ruleEn : SRC.canonical[k].ruleJa))];
  const gh = SRC.gh;
  const data = [
    `      <p><a href="./catalog.json">${esc(t.json)}</a><span>${esc(t.jsonNote)}</span></p>`,
    `      <p><a href="./catalog.bib">${esc(t.bib)}</a><span>${esc(t.bibNote)}</span></p>`,
    `      <p>${ext(gh + 'cpsbvbng26-dotcom/blob/main/docs/canonical-sources.md', esc(t.canonDoc))}`
      + `<span>${esc(t.rulesCanon)}${en ? ': ' : '：'}${canonRules.map(esc).join(en ? '; ' : '。')}${en ? '.' : '。'}</span></p>`,
    `      <p>${ext(gh + 'cpsbvbng26-dotcom/blob/main/' + (en ? 'DISCLAIMER.en.md' : 'DISCLAIMER.md'), esc(t.disclaimer))}`
      + `<span>${esc(t.rulesLicence)}${en ? ' ' : ''}${esc(t.rulesLicence2)}</span></p>`,
    `      <p>${ext(gh + 'researcher-profile/blob/main/catalog.json', esc(t.source))}`
      + `<span>${esc(t.rulesGen)}${en ? ' ' : ''}${esc(t.rulesType)}${en ? ' ' : ''}${esc(en ? SRC.statusNoteEn : SRC.statusNoteJa)}${en ? ' ' : ''}${esc(t.rulesYear)}</span></p>`,
  ];
  blocks.push({ id: 'data', title: t.dataTitle, nav: t.dataNav, note: t.dataNote, html: '\n' + data.join('\n') + '\n    ' });
  cfg.sections = blocks.map((b) => b.id);
  /* 種類ごとの節はナビに出さない。並べるとナビが一行に収まらない。 */
  blocks.forEach((b) => { if (b.id !== 'data') b.nav = false; });
  cfg.blocks = blocks;
  cfg.extraNav = [
    { name: t.backTop, url: t.top },
    /* 作用素のページへの導線は、どのページにも要る（check_site.js が見ている）。 */
    { name: t.operator, url: './trinity.html' },
    { name: t.toolsName, url: './' + t.tools },
    { name: t.otherLang, url: './' + t.other },
  ];
  cfg.jsonld = catalogJsonld(lang);
  return cfg;
}

function toolsConfig(lang) {
  const t = L[lang];
  const en = lang === 'en';
  const cfg = base(lang, t.tools, t.toolsOther, t.toolsName, t.toolsLatin, t.toolsEyebrow, t.toolsTitle,
    t.toolsDescription, t.toolsTagline);
  const tools = SRC.works.filter((w) => w.tool);
  const rows = tools.map((w) => {
    const ty = typeOf(w.type);
    if (ty.id !== 'software') throw new Error('道具の印はソフトウェアにだけ付けます: ' + w.id);
    return `      <p id="${esc(w.id)}">${ext(SRC.gh + w.repo, esc(w.repo))}`
      + `<span>${esc(en ? w.summaryEn : w.summaryJa)}${t.sep}`
      + `DOI ${ext(doiUrl(w.doi), '<code>' + esc(w.doi) + '</code>')}${t.sep}`
      + `${esc(t.licenceLabel)} ${esc(licenceText(w, t))}</span></p>`;
  });
  cfg.sections = ['tools'];
  cfg.blocks = [{
    id: 'tools', title: t.toolsSection,
    noteHtml: esc(t.toolsSectionNote) + ` <a href="./${t.file}#software">${esc(t.backCatalog)}</a>`,
    note: t.toolsSectionNote,
    html: '\n' + rows.join('\n') + '\n    ',
  }];
  cfg.extraNav = [
    { name: t.backTop, url: t.top },
    { name: t.operator, url: './trinity.html' },
    { name: t.backCatalog, url: './' + t.file },
    { name: t.otherLang, url: './' + t.toolsOther },
  ];
  cfg.jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': SRC.base + t.tools, url: SRC.base + t.tools, name: t.toolsName,
        inLanguage: lang, author: { '@id': PERSON['@id'] } },
      PERSON,
      ...tools.map((w) => ({
        '@type': 'SoftwareSourceCode',
        '@id': doiUrl(w.doi),
        name: w.titleEn || w.title,
        description: w.summaryEn,
        identifier: [{ '@type': 'PropertyValue', propertyID: 'DOI', value: w.doi }],
        codeRepository: SRC.gh + w.repo,
        version: w.version,
        license: licenceSpdx(w).map((x) => LICENCE_URL[x]),
        author: { '@id': PERSON['@id'] },
      })),
    ],
  };
  return cfg;
}

/* ------------------------------------------------------------ JSON と BibTeX */

function exportJson() {
  return {
    _: 'Generated from catalog.json in researcher-profile by build_catalog.js. Do not edit by hand.',
    asOf: SRC.asOf,
    author: { name: 'Takuya Nemoto', alternateName: '根本卓哉', orcid: 'https://orcid.org/' + SRC.orcid },
    statusNote: SRC.statusNoteEn,
    types: SRC.types.map((ty) => ({ id: ty.id, ja: ty.ja, en: ty.en })),
    works: SRC.works.map((w) => {
      const ty = typeOf(w.type);
      const st = statusOf(w.status);
      const cj = canonicalOf(w, 'ja');
      const ce = canonicalOf(w, 'en');
      return {
        id: w.id,
        type: w.type, typeJa: ty.ja, typeEn: ty.en,
        status: w.status, statusJa: st.ja, statusEn: st.en,
        title: w.title,
        titleEn: w.titleEn || null,
        summaryJa: w.summaryJa, summaryEn: w.summaryEn,
        doi: w.doi || null,
        conceptDoi: w.conceptDoi || null,
        otherDois: w.otherDois || [],
        url: w.doi ? doiUrl(w.doi) : null,
        version: w.version || null,
        repository: w.repo ? SRC.gh + w.repo : null,
        canonical: { ja: cj.name, en: ce.name, url: ce.url },
        licence: { spdx: licenceSpdx(w), ja: licenceText(w, L.ja), en: licenceText(w, L.en) },
        resourceType: w.resourceType || null,
        begun: Object.assign(begunOf(w), { ja: begunText(w, L.ja), en: begunText(w, L.en),
          noteJa: w.startNoteJa || null, noteEn: w.startNoteEn || null }),
        registry: w.doi ? (w.registry || 'DataCite (Zenodo)') : null,
      };
    }),
  };
}

const bibEsc = (s) => String(s).replace(/([{}])/g, '\\$1').replace(/([&%$#_])/g, '\\$1');

function exportBib() {
  const PUB = { zenodo: 'Zenodo', github: 'Zenodo', site: 'Zenodo', figshare: 'Figshare', ssrn: 'SSRN' };
  const out = [
    '% Catalogue of works by Takuya Nemoto (ORCID ' + SRC.orcid + ').',
    '% Generated from catalog.json in researcher-profile by build_catalog.js. Do not edit by hand.',
    '% As of ' + SRC.asOf + '. None of these works has been peer-reviewed.',
    '',
  ];
  SRC.works.filter((w) => w.doi).forEach((w) => {
    const ty = typeOf(w.type);
    const key = 'nemoto2026' + w.id.replace(/[^a-z0-9]/g, '');
    const publisher = w.registry === 'Figshare' ? 'Figshare' : (w.registry === 'Crossref' ? 'SSRN' : PUB[w.canonical]);
    const fields = [
      ['author', 'Nemoto, Takuya'],
      ['title', w.title],
      ['year', '2026'],
      ['publisher', publisher],
      ['doi', w.doi],
      ['url', doiUrl(w.doi)],
    ];
    if (w.version) fields.push(['version', w.version]);
    fields.push(['note', 'Type: ' + ty.en + '. Status: ' + statusOf(w.status).en + '.'
      + (w.resourceType ? ' Resource type: ' + w.resourceType + '.' : '') + ' Not peer-reviewed.']);
    out.push('@misc{' + key + ',');
    out.push(fields.map(([k, v]) => '  ' + k.padEnd(9) + ' = {' + (k === 'url' || k === 'doi' ? v : bibEsc(v)) + '}').join(',\n'));
    out.push('}', '');
  });
  return out.join('\n');
}

/* ------------------------------------------------------------ 書き出す */

function render(cfg, name, tmp) {
  const cfgPath = path.join(tmp, name + '.json');
  const outDir = path.join(tmp, name);
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
    env: Object.assign({}, process.env, { PROFILE_CONFIG: cfgPath, PROFILE_OUT: outDir }),
    stdio: 'pipe',
  });
  fs.copyFileSync(path.join(outDir, 'index.html'), path.join(OUT, name));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
fs.mkdirSync(OUT, { recursive: true });
try {
  for (const lang of ['ja', 'en']) {
    render(catalogConfig(lang), L[lang].file, tmp);
    render(toolsConfig(lang), L[lang].tools, tmp);
  }
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(exportJson(), null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'catalog.bib'), exportBib());
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`生成しました: ${path.relative(process.cwd(), OUT) || '.'}/ （目録と道具の一覧 各 2 頁、catalog.json、catalog.bib / 作品 ${SRC.works.length} 件）`);
