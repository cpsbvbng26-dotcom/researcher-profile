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

console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
