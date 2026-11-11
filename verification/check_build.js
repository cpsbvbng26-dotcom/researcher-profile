/* profile.json と、そこから生成した HTML を検査する。
 *
 *   node build.js && node verification/check_build.js
 *
 * 依存パッケージなし。ブラウザも起こさない。
 *
 * この道具の要は「設定ファイル 1 つ」であることで、裏を返すと **設定が壊れても
 * 変な HTML が出るまで気づけない**。テンプレートに置換されない印が残っても、
 * 生成は成功したように見える。そこを落とす。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.PROFILE_OUT || path.join(ROOT, 'dist');

let pass = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log('  OK   ' + label); pass++; return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label);
}
function section(n) { console.log('\n' + n); }
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  ok(label, g === w, '期待 ' + w + ' / 実際 ' + g);
}


/* ------------------------------------------------------- 1. profile.json */
section('1. profile.json');

let profile = null;
try {
  profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile.json'), 'utf8'));
  ok('JSON として読める', true);
} catch (e) {
  ok('JSON として読める', false, e.message);
  process.exit(1);
}

const REQUIRED_STRINGS = ['name', 'initials', 'lang', 'title', 'description', 'siteUrl',
                          'accent', 'accentDark', 'footer'];
const missing = REQUIRED_STRINGS.filter((k) => typeof profile[k] !== 'string' || !profile[k].trim());
ok('必須の文字列がそろっている', missing.length === 0, missing.join(', '));

const REQUIRED_ARRAYS = ['identifiers', 'credentials', 'areas', 'papers', 'links'];
const badArrays = REQUIRED_ARRAYS.filter((k) => !Array.isArray(profile[k]));
ok('必須の配列がそろっている', badArrays.length === 0, badArrays.join(', '));

ok('labels がある', profile.labels && typeof profile.labels === 'object');

/* 各要素に必要な欄。欠けると、そのカードだけ空で出る。 */
const SHAPES = {
  identifiers: ['label', 'value', 'url'],
  areas: ['name', 'detail'],
  papers: ['title'],
  credentials: ['name', 'items'],
  links: ['name', 'items']
};
const shapeErrors = [];
Object.keys(SHAPES).forEach((key) => {
  (profile[key] || []).forEach((item, i) => {
    SHAPES[key].forEach((f) => {
      if (item[f] === undefined || item[f] === null || item[f] === '') {
        shapeErrors.push(key + '[' + i + '].' + f);
      }
    });
  });
});
ok('各項目に必要な欄がある', shapeErrors.length === 0, shapeErrors.join(', '));

const itemErrors = [];
['credentials', 'links'].forEach((key) => {
  (profile[key] || []).forEach((group, gi) => {
    if (!Array.isArray(group.items) || group.items.length === 0) {
      itemErrors.push(key + '[' + gi + '].items が空');
      return;
    }
    group.items.forEach((it, i) => {
      const need = key === 'credentials' ? ['title', 'issuer', 'url'] : ['name', 'url'];
      need.forEach((f) => {
        if (!it[f]) itemErrors.push(key + '[' + gi + '].items[' + i + '].' + f);
      });
    });
  });
});
ok('入れ子の項目に必要な欄がある', itemErrors.length === 0, itemErrors.join(', '));

/* 色は CSS にそのまま埋まる。壊れていると配色が崩れるだけで、生成は成功する。 */
const HEX = /^#[0-9a-fA-F]{6}$/;
ok('accent が #rrggbb', HEX.test(profile.accent), profile.accent);
ok('accentDark が #rrggbb', HEX.test(profile.accentDark), profile.accentDark);

ok('siteUrl が https', /^https:\/\//.test(profile.siteUrl || ''), profile.siteUrl);
ok('lang が言語タグの形', /^[a-z]{2}(-[A-Za-z0-9]+)*$/.test(profile.lang || ''), profile.lang);

/* 外部 URL はすべて https。http だと混在コンテンツになる。 */
const insecure = [];
JSON.stringify(profile).replace(/"(https?:\/\/[^"]+)"/g, (m, u) => {
  if (u.indexOf('http://') === 0) insecure.push(u);
  return m;
});
ok('外部 URL がすべて https', insecure.length === 0, insecure.join(', '));

/* --------------------------------------------------------- 2. 生成物 */
section('2. 生成物');

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  ok('index.html が生成されている', false, '先に node build.js を実行してください');
  console.log('\n' + '-'.repeat(56));
  process.exit(1);
}
ok('index.html が生成されている', true);
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');

/* いちばん効く検査。テンプレートに印を足して build.js を直し忘れると、
 * ページに {{FOO}} がそのまま出る。生成は成功したように見える。 */
const leftover = [...new Set((html.match(/\{\{[A-Z_]+\}\}/g) || []))];
ok('置換されていない印が残っていない', leftover.length === 0, leftover.join(', '));

/* テンプレート側の印が、build.js に一つ残らず渡されているか（生成前に分かる） */
const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const tplTokens = [...new Set((tpl.match(/\{\{[A-Z_]+\}\}/g) || []))];
const unhandled = tplTokens.filter((t) => build.indexOf(t) < 0);
ok('テンプレートの印をすべて build.js が扱っている', unhandled.length === 0, unhandled.join(', '));

ok('title が入っている', html.indexOf('<title>' + profile.title + '</title>') >= 0);
ok('lang が入っている', html.indexOf('<html lang="' + profile.lang + '"') >= 0);
ok('accent が CSS に入っている', html.indexOf(profile.accent) >= 0);

/* 件数がそのまま出ているか。設定を足したのに出ない、を拾う。 */
const countAttr = (re) => (html.match(re) || []).length;
const credTotal = profile.credentials.reduce((n, g) => n + g.items.length, 0);
const linkTotal = profile.links.reduce((n, g) => n + g.items.length, 0);
ok('修了証の件数が一致する', countAttr(/class="cert reveal"/g) >= credTotal,
   '設定 ' + credTotal + ' / 生成 ' + countAttr(/class="cert reveal"/g));
ok('学習領域の件数が一致する', countAttr(/class="area /g) === profile.areas.length,
   '設定 ' + profile.areas.length + ' / 生成 ' + countAttr(/class="area /g));
ok('リンクの件数が一致する', countAttr(/class="link"/g) === linkTotal,
   '設定 ' + linkTotal + ' / 生成 ' + countAttr(/class="link"/g));

/* すべての URL が生成物に現れているか（1 件でも落ちれば設定と食い違う） */
const urls = [];
const collect = (o) => {
  if (Array.isArray(o)) return o.forEach(collect);
  if (o && typeof o === 'object') return Object.keys(o).forEach((k) => {
    if (k === 'url' && typeof o[k] === 'string') urls.push(o[k]);
    else collect(o[k]);
  });
};
collect(profile);
// build.js と同じ escape をかけてから探す。& を含む URL は &amp; になって入る。
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dropped = urls.filter((u) => html.indexOf(esc(u)) < 0);
ok('設定にある URL がすべて生成物にある', dropped.length === 0,
   dropped.length + ' 件欠落: ' + dropped.slice(0, 3).join(', '));

/* この道具の売りは「外部リクエストゼロ」。自動で取りに行く要素が無いこと。 */
const external = [
  /<script[^>]+src="(https?:)?\/\//,
  /<link[^>]+rel="stylesheet"[^>]+href="(https?:)?\/\//,
  /<img[^>]+src="(https?:)?\/\//,
  /@import\s+url\(["']?https?:/
].filter((re) => re.test(html));
ok('自動で外部を取りに行く要素が無い', external.length === 0, external.length + ' 件');

/* 空のリンクは、設定の欄が空だったときに出る */
ok('href が空のリンクが無い', !/href=""/.test(html));


/* --------------------------------------- 新しい節と、節の順序 */
section('新しい節と節の順序');

const { execFileSync } = require('child_process');
const os = require('os');

function buildWith(cfg, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-' + name + '-'));
  const cfgPath = path.join(dir, 'c.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
    env: { ...process.env, PROFILE_CONFIG: cfgPath, PROFILE_OUT: dir },
    stdio: 'pipe',
  });
  return fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
}

function buildFails(cfg) {
  try { buildWith(cfg, 'fail'); return null; }
  catch (e) { return String(e.stderr || e.message); }
}

const BASE = { name: '試験', initials: 'T' };

/* sections に書いた順に並ぶこと。既定は履歴書の形のままであること。 */
(() => {
  const html = buildWith({
    ...BASE,
    sections: ['claim', 'verification', 'withdrawn', 'papers', 'contact'],
    claim: { statement: 'S', refute: 'R' },
    verification: { items: [{ name: 'V', detail: 'd' }] },
    withdrawn: { items: [{ name: 'W', detail: 'd' }] },
    papers: [{ title: 'P' }],
    contact: { criticism: 'C' },
  }, 'order');
  const ids = [...html.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1]);
  eq('sections の順に節が並ぶ', ids,
     ['claim', 'verification', 'withdrawn', 'papers', 'contact']);
  const nav = [...html.matchAll(/<a href="#([a-z]+)">/g)].map((m) => m[1]);
  eq('ナビも同じ順になる', nav,
     ['claim', 'verification', 'withdrawn', 'papers', 'contact']);
})();

(() => {
  const html = buildWith({ ...BASE, credentials: [{ name: 'g', items: [{ title: 't' }] }],
                           papers: [{ title: 'p' }] }, 'default');
  const ids = [...html.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1]);
  eq('sections を書かなければ既定の順のまま', ids, ['credentials', 'papers']);
})();

/* 反証の手順を書けない主張は、主張ではなく宣伝である。生成を止める。 */
ok('refute の無い claim は生成が止まる',
   /refute/.test(buildFails({ ...BASE, sections: ['claim'], claim: { statement: 'S' } }) || ''));
ok('criticism の無い contact は生成が止まる',
   /criticism/.test(buildFails({ ...BASE, sections: ['contact'], contact: {} }) || ''));
ok('知らない節名は生成が止まる',
   /知らない節/.test(buildFails({ ...BASE, sections: ['nonesuch'] }) || ''));

/* 連絡先は、批判の宛先が他の項目より前にあること。 */
(() => {
  const html = buildWith({
    ...BASE, sections: ['contact'],
    contact: { criticism: 'まず誤りの指摘を', others: [{ name: 'その他', detail: 'あと' }] },
  }, 'contact');
  ok('批判の宛先が他の連絡先より前にある',
     html.indexOf('まず誤りの指摘を') < html.indexOf('あと'));
})();

/* JSON-LD をそのまま通すこと。 */
(() => {
  const html = buildWith({ ...BASE, jsonld: { '@context': 'https://schema.org', '@type': 'Person' } }, 'ld');
  ok('jsonld が出力に入る', /<script type="application\/ld\+json">/.test(html));
  ok('CSP がその script を許している',
     (html.match(/sha256-/g) || []).length >= 1);
})();

/* 検証の節を、作品の種類ごとに分けて出せること。分けないときの形は変えない。
 * 名乗る数は <dt> から拾われているので、行の形は群に分けても同じにする。 */
(() => {
  const items = [{ name: 'A 1', detail: 'a' }, { name: 'B 2', detail: 'b' }, { name: 'C 3', detail: 'c' }];
  const flat = buildWith({ ...BASE, sections: ['verification'], verification: { items } }, 'vflat');
  const grouped = buildWith({ ...BASE, sections: ['verification'], verification: {
    groups: [{ id: 'g-soft', name: '群一', items: items.slice(0, 2) }, { id: 'g-data', name: '群二', items: items.slice(2) }],
  } }, 'vgroup');
  const dts = (h) => [...h.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);
  eq('検証を群に分けても、行（<dt>）は同じ順に同じ形で出る', dts(grouped), dts(flat));
  const heads = [...grouped.matchAll(/<div class="group-name reveal" id="([^"]+)">([^<]*)<\/div>/g)].map((m) => m[1] + ':' + m[2]);
  eq('群の見出しが、書いた順に出る', heads, ['g-soft:群一', 'g-data:群二']);
  ok('群に分けないときは、群の見出しを出さない', flat.indexOf('<div class="group-name') < 0);
  ok('群に分けても、ナビに検証が出る', /<a href="#verification">/.test(grouped));
})();

/* 頁に固有のスクリプトは、中身を頁に入れ、CSP はハッシュで許す。外へは取りに行かせない。 */
(() => {
  const html = buildWith({ ...BASE, scripts: ['golden-window.js'] }, 'script');
  const code = fs.readFileSync(path.join(ROOT, 'golden-window.js'), 'utf8').replace(/\s+$/, '');
  const sha = "'sha256-" + require('crypto').createHash('sha256').update('\n' + code + '\n', 'utf8').digest('base64') + "'";
  ok('scripts に書いたファイルが、頁の中に入る', html.indexOf('<script>\n' + code + '\n</script>') >= 0);
  ok('CSP が、そのスクリプトをハッシュで許している', html.indexOf(sha) >= 0);
  ok('scripts の頁にも src のある script を出さない', !/<script[^>]+src=/.test(html));
  ok('scripts に無いファイルを書くと生成が止まる', /scripts/.test(buildFails({ ...BASE, scripts: ['nonesuch.js'] }) || ''));
  ok('scripts で外のディレクトリを指すと生成が止まる', /scripts/.test(buildFails({ ...BASE, scripts: ['../build.js'] }) || ''));
})();

/* 雛形として使うときの見本。README の手順のとおりに生成できること。 */
(() => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'minimal.json'), 'utf8'));
  let html = '';
  try { html = buildWith(cfg, 'example'); } catch (e) { html = ''; }
  ok('見本の設定（examples/minimal.json）から頁が生成できる', html.indexOf('<title>' + cfg.title + '</title>') >= 0);
  ok('見本の設定の主張に、覆し方が書いてある', !!(cfg.claim && cfg.claim.refute) && html.indexOf(cfg.claim.refute) >= 0);
})();

/* 全作品の目録。catalog.json から、頁四つと JSON と BibTeX を作る。 */
(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-catalog-'));
  let made = [];
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build_catalog.js')], {
      env: { ...process.env, CATALOG_OUT: dir }, stdio: 'pipe' });
    made = fs.readdirSync(dir).sort();
  } catch (e) { made = []; }
  eq('目録の生成で、頁四つと JSON と BibTeX が出る', made,
     ['catalog.bib', 'catalog.en.html', 'catalog.html', 'catalog.json', 'tools.en.html', 'tools.html']);
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
  let out = null;
  try { out = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8')); } catch (e) { out = null; }
  ok('目録の JSON が、設定の作品をすべて挙げる', out !== null && out.works.length === src.works.length
     && src.works.every((w) => out.works.some((x) => x.id === w.id)));
  const dois = src.works.filter((w) => w.doi).map((w) => w.doi);
  ok('DOI は設定に書いた番号だけで、重ならない', new Set(dois).size === dois.length
     && dois.every((d) => /^10\.\d{4,9}\/\S+$/.test(d)));
})();

/* --------------------------------------------------- 3. CSP */
section('3. Content-Security-Policy');

const crypto = require('crypto');
const shaOf = (t) => "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";
const hashesIn = (h, tag) => {
  const re = new RegExp('<' + tag + '(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</' + tag + '>', 'g');
  const out = []; let m;
  while ((m = re.exec(h)) !== null) out.push(shaOf(m[1]));
  return out;
};
const cspMatch = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
ok('CSP がある', !!cspMatch);
if (cspMatch) {
  const csp = cspMatch[1];
  ok("default-src が 'none' から始まる", csp.indexOf("default-src 'none'") === 0, csp.slice(0, 40));
  ok('緩められていない', !/unsafe-inline|unsafe-eval|unsafe-hashes|\*/.test(csp));
  const missing = hashesIn(html, 'style').concat(hashesIn(html, 'script'))
    .filter((h) => csp.indexOf(h) < 0);
  ok('ハッシュがページの中身と一致する', missing.length === 0, missing.length + ' 件が欠けている');
}

/* --------------------------------------------------- 3b. 作者のサイトの設定 */
section('3b. 作者のサイトの設定（五言語の日付・目標・頁の下の欄・依存）');

(() => {
  const { execFileSync } = require('child_process');
  const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  /* 中身が変わった日。build.js の contentDate と同じ決め方（未コミットなら今日）。 */
  const dateOf = (f) => {
    const opt = { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    try {
      if (execFileSync('git', ['status', '--porcelain', '--', f], opt).trim()) return new Date().toISOString().slice(0, 10);
      return execFileSync('git', ['log', '-1', '--format=%cs', '--', f], opt).trim() || null;
    } catch (e) { return null; }
  };

  /* 373. **五つの言語を、同じ日に直す。**日本語だけ直して訳を置いていくと、
   * 片方だけ古い頁が残る。最後に変えた日が一つでも違えば落とす。 */
  const LANGS = { 'site.json': 'ja', 'site.en.json': 'en', 'site.de.json': 'de', 'site.fr.json': 'fr', 'site.it.json': 'it' };
  const dates = Object.keys(LANGS).map((f) => [f, dateOf(f)]);
  ok('トップの頁の五つの言語の設定を、同じ日に直している', dates.every(([, d]) => d && d === dates[0][1]),
     dates.map(([f, d]) => f + ' ' + d).join(', '));

  /* 374. **目標に、達成したかどうかの欄を置く。**何をもって達成とするかも同じ行に書く。 */
  const STATUS = { ja: ['未達成', '達成'], en: ['Not achieved', 'Achieved'], de: ['Nicht erreicht', 'Erreicht'],
                   fr: ['Non atteint', 'Atteint'], it: ['Non raggiunto', 'Raggiunto'] };
  const aimBad = [];
  Object.entries(LANGS).forEach(([f, l]) => {
    const p = J(f).profile || {};
    const a = Array.isArray(p.aims) ? p.aims : [];
    if (a.length !== 2) aimBad.push(f + ' の目標が ' + a.length);
    a.forEach((x, i) => {
      if (!x || typeof x !== 'object' || !x.text || !x.when) aimBad.push(f + ' の ' + (i + 1) + ' つ目に、何をもって達成とするかが無い');
      else if (!STATUS[l].includes(x.status)) aimBad.push(f + ' の ' + (i + 1) + ' つ目の状態が ' + x.status);
    });
    if (!Array.isArray(p.aimsStatusLabel) || p.aimsStatusLabel.length !== 3) aimBad.push(f + ' の表の見出し');
  });
  ok('五つの言語の目標が二つずつあり、達成とする時と状態の欄を持つ', aimBad.length === 0, aimBad.join(' / '));

  /* 328・379. **頁の下の欄。**作者のサイトの頁は、運営（© の行）・連絡・免責への道と、
   * 中身が変わった日を出す。連絡は GitHub の issue だけで、個人の連絡先を置かない。 */
  const F = J('footer.json');
  const setBad = ['ja', 'en', 'de', 'fr', 'it'].filter((l) => {
    const s = F[l];
    return !s || !s.updated || !Array.isArray(s.links) || s.links.length !== 2
      || !/\/issues\/new\/choose$/.test(s.links[0].url) || !/\/DISCLAIMER(\.en)?\.md$/.test(s.links[1].url);
  });
  ok('頁の下の欄の組（footer.json）が、五言語とも連絡と免責の二つと日付の見出しを持つ', setBad.length === 0, setBad.join(', '));
  ok('頁の下の欄に、メールアドレスも mailto も無い', !/mailto:|@[a-z0-9-]+\.[a-z]{2,}/i.test(JSON.stringify(F)));
  const site = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f) && !/^(profile|footer|catalog|papers|courses|package)/.test(f) && !/\.site\.json$/.test(f))
    .filter((f) => { try { return /^https:\/\/cpsbvbng26-dotcom\.vercel\.app\//.test(J(f).siteUrl || ''); } catch (e) { return false; } });
  const noSet = site.filter((f) => J(f).footerSet !== String(J(f).lang || 'ja').slice(0, 2));
  ok('作者のサイトに出す設定（' + site.length + ' 本）が、頁の言語の欄の組を指す', site.length > 0 && noSet.length === 0, noSet.join(', '));

  /* 生成して、欄と日付が実際に出ることを見る。日付は設定の中身が変わった日である。 */
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rp-foot-'));
  let h = '';
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')],
      { env: Object.assign({}, process.env, { PROFILE_CONFIG: path.join(ROOT, 'site.json'), PROFILE_OUT: out }), stdio: 'pipe' });
    h = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  } catch (e) { h = ''; }
  const foot = (/<footer>[\s\S]*?<\/footer>/.exec(h) || [''])[0];
  const want = dateOf('site.json');
  ok('トップの頁の下の欄に、運営・連絡・免責と、中身が変わった日がある',
     foot.indexOf('© 2026 根本卓哉') >= 0 && foot.indexOf('/issues/new/choose') >= 0 && foot.indexOf('DISCLAIMER.md') >= 0
     && foot.indexOf('<time datetime="' + want + '">') >= 0, '期待する日 ' + want);
  ok('目標の表が、状態の欄つきで頁に出る', /<table class="aims-table">[\s\S]*?<td class="aim-status">未達成<\/td>/.test(h));

  /* 378. 印刷して一枚に収める頁。 */
  let card = '';
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')],
      { env: Object.assign({}, process.env, { PROFILE_CONFIG: path.join(ROOT, 'card.json'), PROFILE_OUT: out }), stdio: 'pipe' });
    card = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  } catch (e) { card = ''; }
  fs.rmSync(out, { recursive: true, force: true });
  ok('印刷向けの一頁（card.json）が生成でき、印刷の体裁を持つ', /@page \{ size: A4; margin: 12mm; \}/.test(card) && card.indexOf('0009-0000-1406-0547') >= 0);

  /* 313. **依存を持たない。**package.json を置かず、require は Node.js の組み込みだけ。
   * CI も何も入れない。足したら、ここが落ちる。 */
  const BUILTIN = new Set(['fs', 'path', 'crypto', 'child_process', 'os', 'url', 'util']);
  const js = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      if (['.git', 'node_modules', 'dist'].includes(e.name)) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) js.push(p);
    });
  })(ROOT);
  const 外 = [];
  js.forEach((p) => {
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/require\(\s*'([^']+)'\s*\)/g)) {
      const name = m[1].replace(/^node:/, '');
      if (!BUILTIN.has(name) && !name.startsWith('.')) 外.push(path.relative(ROOT, p) + ' → ' + m[1]);
    }
  });
  const wf = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).map((f) => fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8')).join('\n')
    .split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  ok('依存を持たない（package.json が無く、require は組み込みだけで、CI が何も入れない）',
     !fs.existsSync(path.join(ROOT, 'package.json')) && 外.length === 0 && !/npm (install|ci)|pip install/.test(wf), 外.join(', '));
})();

/* この検査が名乗る件数。README と CI の仕事の名前に書いた数を、実際と合わせる（決めごと 5）。 */
section('4. この検査が名乗る件数');
(() => {
  const total = pass + failures.length + 1;
  const claims = [
    ['README.md', /push のたびに (\d+) 項目を通します/],
    ['.github/workflows/verify.yml', /設定と生成物 (\d+) 項目/],
  ];
  const wrong = claims.map(([f, re]) => {
    const m = re.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    return m && Number(m[1]) === total ? null : f + ' が ' + (m ? m[1] : '名乗っていない');
  }).filter(Boolean);
  ok('この検査が名乗る件数が実際と合う', wrong.length === 0, '実際 ' + total + (wrong.length ? ' / ' + wrong.join(', ') : ''));
})();

console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
