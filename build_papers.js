/* 論文ごとの単独ページを、papers.json から作る。
 *
 *   PAPERS_OUT=../cpsbvbng26-dotcom/papers node build_papers.js
 *
 * 出所は papers.json の一箇所だけである。日本語と英語で 1 篇 2 ページ。
 * build.js をそのまま呼ぶので、head・ナビ・CSP・構造化データの作りは
 * トップと同じものになる。
 *
 * 散文に数を書かない。件数は生成先のリポジトリで動くので、書けば必ず古くなる。
 * ここが出すのは導線だけである。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname);
const OUT = process.env.PAPERS_OUT
  ? path.resolve(process.env.PAPERS_OUT)
  : path.join(ROOT, 'dist', 'papers');
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'papers.json'), 'utf8'));

const L = {
  ja: {
    eyebrow: 'Paper', verify: '開く', skip: '本文へスキップ',
    themeToggle: 'テーマを切り替える',
    locations: '所在', record: '記録', ai: 'AI の利用', cite: '引用',
    locationsNote: '同じ本文が複数の場所にあります。引用は Zenodo の DOI を用いてください。',
    recordNote: '見つかった不備と、直せなかったものです。消していません。',
    aiNote: 'どの作業に AI を用いたかです。AI は著者ではありません。',
    citeNote: '版が分かる形で引用してください。',
    canonical: 'Zenodo', canonicalNote: '正本。DOI が付き、版が固定されます',
    pdf: 'GitHub の PDF', pdfNote: '配布されたファイルそのものです。控えであって正本ではありません',
    transcript: '本文の書き起こし', transcriptNote: 'PDF から起こしたもので、抽出した語の並びと照合しています',
    supersedes: '訂正の対象（引用してはいけない）',
    supersedesNote: 'この論文が訂正している初版です。現行はこのページの DOI です',
    errata: '正誤表', route: '再発見の経路', verification: '検証スクリプト',
    register: '訂正の登録簿', shelf: 'まだ読んでいない本の書棚',
    routeNote: '着想から、標準的な結果の再発見だと同定するまでの九段階です',
    verificationNote: '定理と、紙面に印字された数値を、機械で当たります',
    registerNote: '公開したあとで見つかった誤りを、一件ずつ記録しています',
    shelfNote: '引用した原典に著者は当たっていません。読む予定の一覧です',
    aiRepo: 'このリポジトリの AI 開示', peer: '査読を受けていません',
    peerNote: 'DOI があることは、査読を受けたことを意味しません',
    external: '外部からの評価', externalNote: '受けた評価と、その検証です',
    backTop: '核へ戻る', operator: '作用素', backNotes: 'ノート', other: 'English',
  },
  en: {
    eyebrow: 'Paper', verify: 'Open', skip: 'Skip to content',
    themeToggle: 'Toggle theme',
    locations: 'Where it lives', record: 'The record', ai: 'Use of AI', cite: 'Citation',
    locationsNote: 'The same text exists in several places. Cite the Zenodo DOI.',
    recordNote: 'Defects found, and what could not be fixed. Nothing has been deleted.',
    aiNote: 'What AI was used for. AI is not an author.',
    citeNote: 'Cite in a form that makes the version clear.',
    canonical: 'Zenodo', canonicalNote: 'Canonical. It carries the DOI and fixes the version',
    pdf: 'PDF on GitHub', pdfNote: 'The distributed file itself — a copy, not the canonical record',
    transcript: 'Transcription of the text', transcriptNote: 'Raised from the PDF and checked against the extracted word sequence',
    supersedes: 'Superseded — do not cite',
    supersedesNote: 'The first edition this paper corrects. The current DOI is the one on this page',
    errata: 'Errata', route: 'Route of the rediscovery', verification: 'Verification scripts',
    register: 'Correction register', shelf: 'Shelf of books not yet read',
    routeNote: 'Nine stages from the initial idea to identifying it as a rediscovery of standard results',
    verificationNote: 'Checks the theorems, and every number printed on the page, by machine',
    registerNote: 'Every error found after publication, recorded one by one',
    shelfNote: 'The author has not consulted the primary sources cited. This lists what is to be read',
    aiRepo: "This repository's AI disclosure", peer: 'Not peer-reviewed',
    peerNote: 'A DOI does not imply peer review',
    external: 'External evaluations', externalNote: 'Evaluations received, and how they were checked',
    backTop: 'Core', operator: 'Operator', backNotes: 'Notes', other: '日本語',
  },
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const row = (label, href, note, blank) =>
  `      <p><a href="${esc(href)}"${blank ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`
  + `<span>${note}</span></p>`;

function pageConfig(p, lang) {
  const t = L[lang];
  const v = p[lang];
  const en = lang === 'en';
  const file = p.slug + (en ? '.en.html' : '.html');
  const url = SRC.base + 'papers/' + file;
  const doiUrl = 'https://doi.org/' + p.doi;
  const gh = SRC.gh;

  const locations = [
    row(t.canonical + ' ' + esc(p.doi), doiUrl, t.canonicalNote, true),
    row(t.pdf, gh + p.repo + '/blob/main/' + p.pdf, t.pdfNote, true),
  ];
  (p.locations || []).forEach((l) => {
    locations.push(row(esc(l.name) + ' ' + esc(l.id), l.url, en ? 'Same text' : '同じ本文です', true));
  });
  if (p.transcript) locations.push(row(t.transcript, gh + p.transcript, t.transcriptNote, true));
  if (p.supersedes) {
    locations.push(row(t.supersedes + ' ' + esc(p.supersedes),
      'https://doi.org/' + p.supersedes, t.supersedesNote, true));
  }

  const record = [row(t.errata, gh + p.errata, t.recordNote, true)];
  if (p.route) record.push(row(t.route, gh + 'trinity-infinity/blob/main/ROUTE.md', t.routeNote, true));
  if (p.verification) record.push(row(t.verification, gh + p.verification, t.verificationNote, true));
  if (p.shelf) record.push(row(t.shelf, gh + 'autonomy-and-self-cultivation/blob/main/SHELF.md', t.shelfNote, true));
  record.push(row(t.register + '（' + p.registerPrefix + '-…）',
    gh + 'self-correction/blob/main/REGISTER.md', t.registerNote, true));
  record.push(row(t.external, gh + 'cpsbvbng26-dotcom/blob/main/docs/external-evaluations.md',
    t.externalNote, true));

  const ai = [
    `      <p>${v.note}</p>`,
    row(t.aiRepo, gh + p.repo + '#ai-の利用', t.aiNote, true),
    `      <p><strong>${t.peer}</strong><span>${t.peerNote}</span></p>`,
  ];

  const cite = [
    `      <p><code>Nemoto, T. (2026). ${esc(p.title)}: ${esc(p.subtitle)}. Zenodo. ${esc(doiUrl)}</code>`
    + `<span>${t.citeNote}</span></p>`,
  ];

  return {
    name: p.title,
    nameLatin: p.subtitle,
    initials: 'TN',
    lang: en ? 'en' : 'ja',
    title: p.title + ' | ' + (en ? 'Takuya Nemoto' : '根本卓哉'),
    description: v.summary,
    siteUrl: url,
    alternates: [
      { lang: 'ja', url: SRC.base + 'papers/' + p.slug + '.html' },
      { lang: 'en', url: SRC.base + 'papers/' + p.slug + '.en.html' },
      { lang: 'x-default', url: SRC.base + 'papers/' + p.slug + '.html' },
    ],
    ogImage: SRC.base + 'og.png',
    ogType: 'article',
    favicon: './../favicon.svg',
    accent: SRC.accent,
    accentDark: SRC.accentDark,
    footer: SRC.footer,
    identifiers: [
      { label: 'DOI', value: p.doi, url: doiUrl },
      { label: 'ORCID', value: SRC.orcid, url: 'https://orcid.org/' + SRC.orcid },
      { label: en ? 'Version' : '版', value: v.version },
    ],
    taglineHtml: esc(v.summary),
    sections: ['locations', 'record', 'ai', 'cite'],
    blocks: [
      { id: 'locations', title: t.locations, note: t.locationsNote, html: '\n' + locations.join('\n') + '\n    ' },
      { id: 'record', title: t.record, note: t.recordNote, html: '\n' + record.join('\n') + '\n    ' },
      { id: 'ai', title: t.ai, note: t.aiNote, html: '\n' + ai.join('\n') + '\n    ' },
      { id: 'cite', title: t.cite, note: t.citeNote, html: '\n' + cite.join('\n') + '\n    ' },
    ],
    extraNav: [
      { name: t.backTop, url: en ? './../index.en.html' : './../index.html' },
      /* 作用素のページへの導線は、どのページにも要る（check_site.js が見ている）。 */
      { name: t.operator, url: './../trinity.html' },
      { name: t.backNotes, url: en ? './../notes/index.en.html' : './../notes/index.html' },
      { name: t.other, url: en ? './' + p.slug + '.html' : './' + p.slug + '.en.html' },
    ],
    labels: {
      eyebrow: t.eyebrow, verify: t.verify, skip: t.skip, themeToggle: t.themeToggle,
    },
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ScholarlyArticle',
          '@id': doiUrl,
          name: p.title + ': ' + p.subtitle,
          headline: p.title,
          abstract: p.en.summary,
          inLanguage: 'en',
          identifier: [{ '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi }],
          sameAs: [doiUrl].concat((p.locations || []).map((l) => l.url)),
          author: {
            '@type': 'Person',
            name: 'Takuya Nemoto',
            alternateName: '根本卓哉',
            identifier: 'https://orcid.org/' + SRC.orcid,
            url: 'https://orcid.org/' + SRC.orcid,
          },
          datePublished: '2026-08',
          publisher: { '@type': 'Organization', name: 'Zenodo' },
          license: 'https://creativecommons.org/licenses/by/4.0/',
          creativeWorkStatus: 'Preprint',
          url,
        },
        { '@type': 'WebPage', '@id': url, url, name: p.title, inLanguage: en ? 'en' : 'ja' },
      ],
    },
  };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'papers-'));
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const p of SRC.papers) {
  for (const lang of ['ja', 'en']) {
    const cfgPath = path.join(tmp, p.slug + '.' + lang + '.json');
    const outDir = path.join(tmp, p.slug + '.' + lang);
    fs.writeFileSync(cfgPath, JSON.stringify(pageConfig(p, lang), null, 2));
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
      env: Object.assign({}, process.env, { PROFILE_CONFIG: cfgPath, PROFILE_OUT: outDir }),
      stdio: 'pipe',
    });
    const name = p.slug + (lang === 'en' ? '.en.html' : '.html');
    fs.copyFileSync(path.join(outDir, 'index.html'), path.join(OUT, name));
    n++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`生成しました: ${path.relative(process.cwd(), OUT)}/ （${n} ページ / 論文 ${SRC.papers.length} 篇）`);
