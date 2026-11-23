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

/* 五つのファイルを、同じ時に変えたか。cwd は git の作業木。
 * 返すのは { ok, detail }。日が同じなら通す。一日だけ違うなら、最後に変えたコミットが
 * すべて同じ変更（同じマージが持ち込んだもの、またはまだ main に入っていない同じ枝）にあるときだけ通す。 */
function sameChange(cwd, files) {
  const { execFileSync } = require('child_process');
  const opt = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  const git = (args) => { try { return execFileSync('git', args, opt).trim(); } catch (e) { return null; } };
  const today = new Date().toISOString().slice(0, 10);
  const rows = files.map((f) => {
    if (git(['status', '--porcelain', '--', f])) return { f, date: today, commit: 'WORKTREE' };
    const line = git(['log', '-1', '--format=%H %cs', '--', f]);
    if (!line) return { f, date: null, commit: null };
    const [commit, date] = line.split(' ');
    return { f, date, commit };
  });
  const detail = rows.map((r) => r.f + ' ' + r.date).join(', ');
  if (rows.some((r) => !r.date)) return { ok: false, detail };
  if (rows.every((r) => r.date === rows[0].date)) return { ok: true, detail };
  const days = rows.map((r) => Date.parse(r.date + 'T00:00:00Z') / 86400000);
  if (Math.max(...days) - Math.min(...days) > 1) return { ok: false, detail: detail + '（二日以上ずれている）' };
  /* どの変更が持ち込んだか。main の第一の親の並びで、そのコミットを最初に含むもの。 */
  const fp = (git(['rev-list', '--first-parent', '--reverse', 'HEAD']) || '').split('\n').filter(Boolean);
  const main = git(['rev-parse', '-q', '--verify', 'refs/remotes/origin/main']);
  const isAnc = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], opt); return true; } catch (e) { return false; } };
  const groupOf = (c) => {
    if (c === 'WORKTREE') return 'WORKTREE';
    if (main && !isAnc(c, main)) return 'BRANCH';
    let lo = 0, hi = fp.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (isAnc(c, fp[mid])) { found = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return found < 0 ? null : fp[found];
  };
  const groups = rows.map((r) => groupOf(r.commit));
  const 一つ = groups.every((g) => g && g === groups[0]);
  /* 第一の親の並びのコミットがマージでなく、自分自身なら、それは一つのコミットである。
   * 五つが別々の直の push なら、群は別々になって落ちる。 */
  return { ok: 一つ, detail: detail + (一つ ? '（一日のずれ。五つとも同じ PR で変えた）' : '（一日のずれ。別の変更で直している）') };
}

/* 判定そのものを、作り物の履歴で確かめる。外へは出ない。落ちた場合の名を返す。 */
function sameChangeSelfTest() {
  const os = require('os');
  const { execFileSync } = require('child_process');
  const bad = [];
  const mk = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'samechange-'));
    const g = (args, env) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t', '-c', 'commit.gpgsign=false'].concat(args),
      { cwd: d, stdio: 'ignore', env: Object.assign({}, process.env, env || {}) });
    g(['init', '-q', '-b', 'main']);
    return { d, g };
  };
  const at = (iso) => ({ GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso });
  const write = (d, files, v) => files.forEach((f) => fs.writeFileSync(path.join(d, f), v));
  const F = ['a', 'b', 'c', 'd', 'e'];
  try {
    /* 一つの PR の中で、日をまたいで直した。マージで main に入った。 → 通る */
    {
      const { d, g } = mk();
      write(d, F, '0'); g(['add', '.']); g(['commit', '-q', '-m', 'init'], at('2026-11-01T12:00:00+0000'));
      g(['checkout', '-q', '-b', 'pr']);
      write(d, ['a', 'b'], '1'); g(['commit', '-q', '-am', 'ab'], at('2026-11-11T23:59:00+0000'));
      write(d, ['c', 'd', 'e'], '1'); g(['commit', '-q', '-am', 'cde'], at('2026-11-12T00:01:00+0000'));
      g(['checkout', '-q', 'main']); g(['merge', '-q', '--no-ff', '-m', 'merge', 'pr'], at('2026-11-12T00:05:00+0000'));
      if (!sameChange(d, F).ok) bad.push('同じ PR で日をまたいだのに落ちた');
      fs.rmSync(d, { recursive: true, force: true });
    }
    /* 別々に main へ直に入れて、日がずれた。 → 落ちる */
    {
      const { d, g } = mk();
      write(d, F, '0'); g(['add', '.']); g(['commit', '-q', '-m', 'init'], at('2026-11-01T12:00:00+0000'));
      write(d, ['a', 'b'], '1'); g(['commit', '-q', '-am', 'ab'], at('2026-11-11T23:59:00+0000'));
      write(d, ['c', 'd', 'e'], '1'); g(['commit', '-q', '-am', 'cde'], at('2026-11-12T00:01:00+0000'));
      if (sameChange(d, F).ok) bad.push('別の変更で日がずれたのに通った');
      fs.rmSync(d, { recursive: true, force: true });
    }
    /* 別々の PR で、日が一つずれた。 → 落ちる */
    {
      const { d, g } = mk();
      write(d, F, '0'); g(['add', '.']); g(['commit', '-q', '-m', 'init'], at('2026-11-01T12:00:00+0000'));
      for (const [name, fs2, when] of [['p1', ['a', 'b'], '2026-11-11T23:00:00+0000'], ['p2', ['c', 'd', 'e'], '2026-11-12T01:00:00+0000']]) {
        g(['checkout', '-q', '-b', name]); write(d, fs2, name); g(['commit', '-q', '-am', name], at(when));
        g(['checkout', '-q', 'main']); g(['merge', '-q', '--no-ff', '-m', 'merge ' + name, name], at(when));
      }
      if (sameChange(d, F).ok) bad.push('別の PR で日がずれたのに通った');
      fs.rmSync(d, { recursive: true, force: true });
    }
    /* 同じ PR でも、二日ずれた。 → 落ちる */
    {
      const { d, g } = mk();
      write(d, F, '0'); g(['add', '.']); g(['commit', '-q', '-m', 'init'], at('2026-11-01T12:00:00+0000'));
      g(['checkout', '-q', '-b', 'pr']);
      write(d, ['a', 'b'], '1'); g(['commit', '-q', '-am', 'ab'], at('2026-11-10T12:00:00+0000'));
      write(d, ['c', 'd', 'e'], '1'); g(['commit', '-q', '-am', 'cde'], at('2026-11-12T12:00:00+0000'));
      g(['checkout', '-q', 'main']); g(['merge', '-q', '--no-ff', '-m', 'merge', 'pr'], at('2026-11-12T12:05:00+0000'));
      if (sameChange(d, F).ok) bad.push('二日ずれたのに通った');
      fs.rmSync(d, { recursive: true, force: true });
    }
    /* 同じ日なら、別々でも通る（これまでどおり）。 */
    {
      const { d, g } = mk();
      write(d, F, '0'); g(['add', '.']); g(['commit', '-q', '-m', 'init'], at('2026-11-01T12:00:00+0000'));
      write(d, ['a', 'b'], '1'); g(['commit', '-q', '-am', 'ab'], at('2026-11-12T01:00:00+0000'));
      write(d, ['c', 'd', 'e'], '1'); g(['commit', '-q', '-am', 'cde'], at('2026-11-12T09:00:00+0000'));
      if (!sameChange(d, F).ok) bad.push('同じ日なのに落ちた');
      fs.rmSync(d, { recursive: true, force: true });
    }
  } catch (e) { bad.push('作り物の履歴を作れなかった: ' + e.message); }
  return bad;
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
   * 片方だけ古い頁が残る。最後に変えた日が一つでも違えば落とす。
   *
   * 478（百本ノック五）。**日付をまたぐコミットで落ちないようにする。**一つの PR の中で、
   * 23:59 と 00:01 に分けてコミットすると、同じ時に直したのに日が一つずれる。
   * 日が違うときは、一日のずれに限り、五つを最後に変えたコミットがすべて同じ PR
   * （main の第一の親の並びで、同じマージが持ち込んだもの）に入っていれば通す。
   * 「一緒に変えた」より弱くはしない。別の PR で変えたなら、日がずれれば落ちる。 */
  const LANGS = { 'site.json': 'ja', 'site.en.json': 'en', 'site.de.json': 'de', 'site.fr.json': 'fr', 'site.it.json': 'it' };
  const together = sameChange(ROOT, Object.keys(LANGS));
  const self = sameChangeSelfTest();
  ok('トップの頁の五つの言語の設定を、同じ日に直している（日をまたぐなら同じ PR で）', together.ok && self.length === 0,
     together.detail + (self.length ? ' / 判定の自己試験が落ちた: ' + self.join(', ') : ''));

  /* 374. **目標に、達成したかどうかの欄を置く。**何をもって達成とするかも同じ行に書く。 */
  const STATUS = { ja: ['未達成', '達成'], en: ['Not achieved', 'Achieved'], de: ['Nicht erreicht', 'Erreicht'],
                   fr: ['Non atteint', 'Atteint'], it: ['Non raggiunto', 'Raggiunto'] };
  const aimBad = [];
  Object.entries(LANGS).forEach(([f, l]) => {
    const p = J(f).profile || {};
    const a = Array.isArray(p.aims) ? p.aims : [];
    /* 2026-11-19 に Georgia Tech の OMSCS での修士号を足して三つにした（所有者が決めた）。 */
    if (a.length !== 3) aimBad.push(f + ' の目標が ' + a.length);
    a.forEach((x, i) => {
      if (!x || typeof x !== 'object' || !x.text || !x.when) aimBad.push(f + ' の ' + (i + 1) + ' つ目に、何をもって達成とするかが無い');
      else if (!STATUS[l].includes(x.status)) aimBad.push(f + ' の ' + (i + 1) + ' つ目の状態が ' + x.status);
    });
    if (!Array.isArray(p.aimsStatusLabel) || p.aimsStatusLabel.length !== 3) aimBad.push(f + ' の表の見出し');
  });
  ok('五つの言語の目標が三つずつあり、達成とする時と状態の欄を持つ', aimBad.length === 0, aimBad.join(' / '));

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

  /* 2026-11-22。デザインに関する法的な扱いの頁（design-legal.json・design-legal.en.json）。
   * 頁の下の欄の sitePages から、作者のサイトの頁にだけ相対の道でつなぐ。日本語の頁は日本語の版へ、ほかの四言語は英語の版へ。
   * 予想のサイト（重ねる設定で siteUrl が変わる）には出さない。引いた文の CSS は、引いた文を持つ頁にだけ足す。 */
  {
    const WANT = { ja: 'notes/design-legal.html', en: 'notes/design-legal.en.html', de: 'notes/design-legal.en.html', fr: 'notes/design-legal.en.html', it: 'notes/design-legal.en.html' };
    const 組の問題 = (G) => Object.keys(WANT).filter((l) => {
      const s = (G[l] || {}).sitePages;
      return !Array.isArray(s) || s.length !== 1 || s[0].page !== WANT[l] || !s[0].label || s[0].url !== undefined;
    });
    const 組 = 組の問題(F);
    ok('頁の下の欄の組（footer.json）が、五言語ともデザインに関する法的な扱いの頁を一つずつ、その言語の版（独仏伊は英語の版）で指す', 組.length === 0, 組.join(', '));
    const 組壊 = [Object.assign({}, F, { de: Object.assign({}, F.de, { sitePages: [{ label: 'x', page: 'notes/design-legal.html' }] }) }),
      Object.assign({}, F, { ja: Object.assign({}, F.ja, { sitePages: [] }) })].map(組の問題);
    ok('壊して確かめる：独語の欄を日本語の版へ向ける・日本語の欄から外すのどちらでも落ちる', 組壊.every((b) => b.length > 0));

    const gen = (cfg, overlay) => {
      const o = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rp-dl-'));
      try {
        execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { env: Object.assign({}, process.env, { PROFILE_CONFIG: path.join(ROOT, cfg), PROFILE_OUT: o }, overlay ? { PROFILE_OVERLAY: path.join(ROOT, overlay) } : {}), stdio: 'pipe' });
        return fs.readFileSync(path.join(o, 'index.html'), 'utf8');
      } catch (e) { return ''; }
    };
    const footOf = (x) => (/<footer>[\s\S]*?<\/footer>/.exec(x) || [''])[0];
    const 道 = [['site.json', '<a href="./notes/design-legal.html">'], ['site.de.json', '<a href="./notes/design-legal.en.html">'],
      ['design-legal.json', '<a href="./design-legal.html">'], ['design-legal.en.json', '<a href="./design-legal.en.html">'], ['mission.en.json', '<a href="./design-legal.en.html">']];
    const 道外れ = 道.filter(([c, w]) => footOf(gen(c)).indexOf(w) < 0).map(([c]) => c);
    ok('作者のサイトの頁の下の欄が、根と notes/ のどちらからも、デザインに関する法的な扱いの頁を相対の道で指す（' + 道.length + ' 本で生成）', 道外れ.length === 0, 道外れ.join(', '));
    const gw = gen('golden-window.en.json', 'golden-window.site.json');
    ok('予想のサイトの頁には、その道も引いた文の CSS も出ない', gw.length > 0 && gw.indexOf('design-legal') < 0 && gw.indexOf('blockquote.profile-core') < 0);
    const dl = gen('design-legal.json'), top = gen('site.json');
    ok('引いた文の CSS は、引いた文を持つ頁にだけ出る', /\.notes-list blockquote\.profile-core \{/.test(dl) && top.indexOf('blockquote.profile-core') < 0);
  }

  /* 所属は「ZEN大学」／「ZEN University」だけを書く。肩書きでは書かない（決めごと 6、2026-11-11）。 */
  const 所属 = [];
  ['site.json', 'site.en.json', 'cv.json'].forEach((f) => {
    const g = ((J(f).jsonld || {})['@graph'] || []).find((x) => x['@type'] === 'Person');
    const a = g && g.affiliation;
    if (!a || !/^ZEN(大学| University)$/.test(a.name)) 所属.push(f);
  });
  /* 2026-11-12。論文の頁と目録は、作品の著者に所属を付けない。論文は研究上の所属が無いと書いている。
   * 在籍は人の頁（site・cv の Person）にだけ書く。作品の著者に付ければ、大学の研究のように読める。 */
  const 所属文 = ['build_papers.js', 'build_catalog.js'].filter((f) =>
    /affiliation/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  const 独立 = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f))
    .filter((f) => /"(affiliation|jobTitle)"[^}]*[Ii]ndependent/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  ok('構造化データの所属は人の頁だけが ZEN大学／ZEN University で書き、論文と目録の著者には付けず、Independent の所属も肩書きも無い',
     所属.length === 0 && 所属文.length === 0 && 独立.length === 0, 所属.concat(所属文, 独立).join(', '));

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

/* 見た目の決まり（2026-11-12、百本ノック五の 433・435・436・437・441・472）。
 * テンプレートの <style> と、作者の設定を読む。決まりは README の「見た目の決まり」にある。 */
section('3c. 見た目の決まり（字・幅・色・印刷・写真・最初の一文）');
(() => {
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');
  const css = (/<style>([\s\S]*?)<\/style>/.exec(tpl) || [])[1] || '';
  /* 印刷の段は紙の寸法（pt）で決め直すので、ここでは外して数える。印刷は下で別に見る。 */
  const pi = css.indexOf('@media print');
  const screen = pi >= 0 ? css.slice(0, pi) + css.slice(css.indexOf('\n}\n', pi) + 3) : css;

  /* 433. 字の大きさは五段と名前の一段だけ。宣言はどれも変数を通す。外の書体を読まない。 */
  const 段 = (/:root \{[^}]*--fs-xs[^}]*\}/.exec(css) || [''])[0].match(/--fs-[a-z]+:/g) || [];
  const 大きさ = [...screen.matchAll(/(?<![-\w])font-size:\s*([^;}]+)/g)].map((m) => m[1].trim())
    .filter((v) => !/^var\(--fs-(xs|sm|md|lg|xl|name)\)$/.test(v) && v !== 'inherit');
  const 書体 = [...screen.matchAll(/(?<![-\w])font-family:\s*([^;}]+)/g)].map((m) => m[1].trim())
    .filter((v) => !/^var\(--font-(sans|serif|mono)\)$/.test(v));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const 名乗る段 = Number((/字の大きさは `--fs-` の (\d+) 段だけです/.exec(readme) || [])[1]);
  /* README が書く画素の数も、変数の値（rem × 16）と合わせる。 */
  const rem = (k) => Math.round(parseFloat((new RegExp('--fs-' + k + ': ([\\d.]+)rem;').exec(css) || [])[1]) * 16);
  const 画素 = readme.indexOf('です。' + ['xs', 'sm', 'md', 'lg', 'xl'].map(rem).join('・') + ' px と、名前の ' + rem('name') + ' px です。') >= 0;
  ok('字の大きさが一つの段の表（README が名乗る ' + 名乗る段 + ' 段）だけで決まり、書体も三つの変数だけで、外の書体を読まない',
     段.length === 6 && 段.length === 名乗る段 && 画素 && 大きさ.length === 0 && 書体.length === 0 && !/@font-face|@import|fonts\.googleapis/.test(tpl),
     '段 ' + 段.length + (大きさ.length ? ' / 外れた大きさ ' + 大きさ.join(', ') : '') + (書体.length ? ' / 外れた書体 ' + 書体.join(', ') : ''));

  /* 436. 幅は二つだけ。頁の幅（--page）と、一行の長さ（--measure、40 字）。 */
  const 幅 = [...screen.matchAll(/(?<![-\w(])max-width:\s*([^;}]+)/g)].map((m) => m[1].trim())
    .filter((v) => !/^(var\(--(measure|page)\)|calc\(var\(--page\) \+ 3rem\)|100%|none)$/.test(v));
  /* README が名乗る幅と字数も、テンプレートの値と合わせる（決めごと 5）。16 px の字で 1rem が 1 字である。 */
  const 名乗る = /頁の幅は `--page`（(\d+)rem）、一行の長さは `--measure`（(\d+)rem）の二つだけです。\2rem は、16 px の字でおよそ \2 字です。/.exec(readme);
  ok('頁の幅と一行の長さが --page と --measure の二つだけで決まり、README の名乗り（' + (名乗る ? 名乗る[1] + 'rem・' + 名乗る[2] + ' 字' : '無し') + '）と合う',
     名乗る !== null && css.indexOf('--measure: ' + 名乗る[2] + 'rem;') >= 0 && css.indexOf('--page: ' + 名乗る[1] + 'rem;') >= 0
       && 幅.length === 0, 幅.join(', '));

  /* 437. 色の値は変数の定義にしか書かない。指し色は一つで、薄めた二つはその指し色から作る。 */
  const 色 = css.split('\n').filter((l) => /#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(l) && !/^\s*--[a-z-]+:/.test(l.trim().replace(/^(--[a-z-]+:[^;]*;\s*)+$/, '--x: y;')));
  const 名 = [...new Set([...((/:root \{([^}]*)\}/.exec(css) || [])[1] || '').matchAll(/--([a-z-]+):/g)].map((m) => m[1]))];
  /* 2026-11-23。奥行きの段（面の下の色・光・縁の明かり・四つの影）を足した。決まりは 3i が見る。 */
  const 許す = ['bg', 'card', 'card-lo', 'text', 'muted', 'faint', 'line', 'line-soft', 'accent', 'accent-soft', 'accent-wash', 'header-bg',
    'glow', 'edge-hi', 'shadow-face', 'shadow-float', 'shadow-front', 'shadow-well'];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
  const 指し = [[/:root \{([^}]*)\}/, 'ライト'], [/:root\[data-theme="dark"\] \{([^}]*)\}/, 'ダーク']].filter(([re]) => {
    const b = (re.exec(css) || [])[1] || '';
    const a = (/--accent: (#[0-9a-f]{6});/.exec(b) || [])[1];
    return !a || b.indexOf('--accent-soft: rgba(' + rgb(a) + ',') < 0 || b.indexOf('--accent-wash: rgba(' + rgb(a) + ',') < 0;
  }).map(([, n]) => n);
  ok('色の値を変数の定義にしか書かず、指し色が一つで、薄めた色もその指し色から作る',
     色.length === 0 && 名.every((n) => 許す.indexOf(n) >= 0) && 指し.length === 0,
     [色.length ? '定義の外の色 ' + 色.length + ' 行' : '', 名.filter((n) => 許す.indexOf(n) < 0).join(', '), 指し.join(', ')].filter(Boolean).join(' / '));

  /* 441. 印刷。頁の上の欄を外し、表とカードを途中で切らず、外への URL を書き出す。 */
  const 印 = pi >= 0 ? css.slice(pi) : '';
  ok('印刷の指定が、頁の上の欄を外し、行と塊を途中で切らず、外への URL を書き出す',
     /header, \.theme-toggle/.test(印) && /\.works-table tr[^{]*\{ break-inside: avoid; \}/.test(印)
       && /a\[href\^="http"\]::after \{ content: " <" attr\(href\) ">"/.test(印));

  /* 435. 顔写真は置かない。ロゴだけにする（2026-11-12 に決めた）。 */
  const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const 写真 = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f)).filter((f) => {
    const p = J(f).profile;
    return p && typeof p === 'object' && (p.photo || p.photoNote);
  });
  ok('作者の設定が顔写真を持たず、頁の上の欄にロゴを置く', 写真.length === 0
     && /<a class="mark" href="#main"><img src="\{\{FAVICON\}\}" alt="\{\{NAME\}\}" width="32" height="32"><\/a>/.test(tpl),
     写真.join(', '));

  /* 472. 頁の最初の一文は、その頁が何かを言う。「一学部生の入口です」のような文にしない。 */
  const 一文 = (h) => String(h || '').replace(/<[^>]*>/g, '').split('。')[0] + '。';
  const 何か = /(頁|目録|一覧)です。$/;
  const 外れ = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f) && !/\.(en|de|fr|it)\.json$/.test(f))
    .map((f) => [f, J(f)]).filter(([, o]) => o.name && o.lang === 'ja' && /vercel\.app/.test(o.siteUrl || ''))
    .map(([f, o]) => [f, 一文(o.leadHtml || o.lead || o.taglineHtml || o.tagline)])
    .filter(([, x]) => !何か.test(x));
  const 論文 = J('papers.json').papers.filter((p) => !/(論文|史料ノート)です。$/.test(一文(p.ja.summary))).map((p) => p.slug);
  ok('日本語の頁の最初の一文が、その頁が何かを言う（〜の頁です・目録です・一覧です、論文の頁は〜論文です）',
     外れ.length === 0 && 論文.length === 0, 外れ.map(([f, x]) => f + '「' + x + '」').concat(論文).join(' / '));
})();

/* 2026-11-12 の続き（法的なリスクを締めた）。Vercel の利用規約 第 4 節は、無料の枠（Hobby）を個人の利用か
 * 非商用の利用に限る。商品や役務の販売の広告を商用の例に挙げた Fair use Guidelines の節は、2026-11-12 の頁にあり、
 * 2026-11-13 の頁には無い（記録の十一度目の節）。配っている頁の設定に、受注の場への道と「案件募集」を置かない。
 * LinkedIn も、仕事の依頼の窓口として同じ日に外した（利用者が決めました）。見本の profile.json は
 * 配らないが、作者の窓口を載せないことは同じなので、LinkedIn だけはそちらも見る。 */
section('3d. 配っている頁に、受注の場への道を置かない');
(() => {
  const 場 = /lancers\.jp|coconala\.com|crowdworks\.jp|wantedly\.com|linkedin\.com\/in\/|案件募集|independent work/i;
  const 出た = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f) && f !== 'profile.json' && f !== 'package.json')
    .filter((f) => 場.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  const 見本 = /linkedin\.com\/in\//i.test(fs.readFileSync(path.join(ROOT, 'profile.json'), 'utf8')) ? ['profile.json'] : [];
  ok('配る頁の設定に、受注の場（ランサーズ・ココナラ・クラウドワークス・Wantedly・LinkedIn）への道と案件募集の語が無い', 出た.length === 0 && 見本.length === 0, 出た.concat(見本).join(', '));
})();

/* 2026-11-12 の続き（六度目の見落とし。決めたのは 2026-11-13）。
 * 一つ目。英語の要旨が、海軍公報を「held by JACAR」と書いていた。JACAR の目録（C12070491000）は所蔵館を
 * 防衛省防衛研究所と書き、JACAR は画像を公開している側である。JACAR やアジア歴史資料センターを所蔵の主に
 * 置く文を、どの言語でも設定に置かない。式は cpsbvbng26-dotcom の ecosystem.json（六度目の見落とし）と同じものにしてある。
 * 二つ目。日本語の自己紹介が、Friedkin と Johnsen の 2011 年の本を「単著の理論書」と書いていた。Crossref の記録は
 * 種類を monograph、著者を二人と返す。Friedkin・Johnsen の名か本の題と同じ段落に、単著や single-authored を置かない。
 * どちらの式も、止める文と通す文で先に壊して確かめる。 */
section('3e. 所蔵の主と、本の著者の数');
(() => {
  const 所蔵 = [
    /held (?:by|at|in) (?:the )?(?:JACAR|Japan Center for Asian Historical Records)/i,
    /(?:JACAR|Japan Center for Asian Historical Records)(?:'s|’s)? (?:holds|holding|collection|owns|keeps)/i,
    /(?:JACAR|アジア歴史資料センター)\s*(?:が|の)?\s*(?:所蔵|保管|所有)/,
    /所蔵(?:館|機関|先|元)?(?:[:：は]\s*)?(?:JACAR|アジア歴史資料センター)/,
    /(?:im Besitz|im Bestand|aufbewahrt) (?:von |des |der |bei )?JACAR/i,
    /conserv\S* (?:par|à|au|aux) (?:le |la |l’)?JACAR/i,
    /conservat\S* (?:da|presso|dal|dall’) ?(?:il |lo )?JACAR/i,
  ];
  const 単著 = /単著|single-authored|sole-authored|single author|sole author|einzig\w* Autor|auteur unique|unico autore/i;
  const 相手 = /Friedkin|Johnsen|Social Influence Network Theory/;
  const 所蔵か = (s) => 所蔵.some((re) => re.test(s));
  const 単著か = (s) => 相手.test(s) && 単著.test(s);
  const 試験 = [], 試験2 = [];
  ['from a gazette held by JACAR, and separates', 'JACAR holds the original gazette.', 'アジア歴史資料センター所蔵の海軍公報', 'JACAR が所蔵する海軍公報',
   '所蔵：JACAR', 'ein Blatt im Besitz von JACAR', 'un bulletin conservé par JACAR', 'un bollettino conservato presso JACAR']
    .forEach((x) => { if (!所蔵か(x)) 試験.push('通した：' + x); });
  ['held by the National Institute for Defense Studies (Ministry of Defense) and published by JACAR (Ref. C12070491000)',
   'アジア歴史資料センターが公開する海軍公報', 'JACAR（アジア歴史資料センター）Ref.C12070491000、海軍公報（防衛省防衛研究所）']
    .forEach((x) => { if (所蔵か(x)) 試験.push('止めた：' + x); });
  if (!単著か('Friedkin–Johnsen モデルは 2011 年に Cambridge から単著の理論書になり')) 試験2.push('単著を通した');
  if (!単著か('Social Influence Network Theory, a single-authored book')) 試験2.push('single-authored を通した');
  if (単著か('Friedkin–Johnsen モデルは 2011 年に Cambridge から Friedkin と Johnsen の共著の理論書になり')) 試験2.push('共著を止めた');
  const 設定 = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f) && f !== 'package.json');
  const 出た = [], 段 = [];
  設定.forEach((f) => {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (所蔵か(t)) 出た.push(f);
    t.split(/\n|<\/p>/).forEach((p) => { if (単著か(p)) 段.push(f); });
  });
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'papers.json'), 'utf8')).papers.find((p) => p.slug === 'naval-gazette-otani-tsune');
  const 正 = 'held by the National Institute for Defense Studies (Ministry of Defense) and published by JACAR';
  ok('どの設定も JACAR を所蔵の主に置かず、海軍公報の英語の要旨が所蔵館を防衛研究所、JACAR を公開の側と書く（' + 設定.length + ' 本、式は日英独仏伊）',
     出た.length === 0 && 試験.length === 0 && !!P && P.en.summary.indexOf(正) >= 0, 出た.concat(試験).join(' / ') || (P ? '' : '海軍公報の項が無い'));
  const ja = fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8');
  ok('Friedkin と Johnsen の 2011 年の本を単著と書かず、日本語の自己紹介が二人の共著と書く（' + 設定.length + ' 本）',
     段.length === 0 && 試験2.length === 0 && ja.indexOf('Friedkin と Johnsen の共著の理論書') >= 0, [...new Set(段)].concat(試験2).join(' / '));
})();

/* ワークフローと GitHub の規約（2026-11-13）。GitHub の利用規約は I 節で追加製品の規約を取り込み、その Actions の節は、
 * GitHub の実行環境での使い方を、リポジトリのソフトウェアのプロジェクトの制作・検査・配備・公開に限る。ワークフローを足すときは、
 * 点検の記録の「八度目の見落とし」の表に行を足して判定する。行の無いワークフローも、無いワークフローの行も落とす。 */
(() => {
  const EIGHTH = '\n## 2026-11-12 の続き：八度目の見落とし\n';
  const PURPOSE = 'If using GitHub-hosted runners, any other activity unrelated to the production, testing, deployment, or publication of the software project associated with the repository where GitHub Actions are used.';
  const problems = (text, names) => {
    const i = text.indexOf(EIGHTH);
    if (i < 0) return ['記録に八度目の見落としの節が無い'];
    const j = text.indexOf('\n## ', i + EIGHTH.length);
    const sec = text.slice(i, j < 0 ? text.length : j);
    const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| 箇所 |') && !l.startsWith('| --- |')).map((l) => l.slice(2, -2).split(' | '));
    const bad = [];
    for (const r of rows) {
      if (r.length !== 6 || !['誤り', '根拠不足', '漏れ', '表現', '問題なし'].includes(r[4])) bad.push('表の形：' + r[0].slice(0, 30));
      else if (r[4] !== '問題なし' && !r[5].includes('2026-11-13 に Claude が決めました。')) bad.push('決めた者の無い行：' + r[0].slice(0, 30));
    }
    const named = rows.map((r) => (/^`\.github\/workflows\/([^`]+)`/.exec(r[0]) || [])[1]).filter(Boolean);
    names.filter((n) => !named.includes(n)).forEach((n) => bad.push('行の無いワークフロー：' + n));
    named.filter((n) => !names.includes(n)).forEach((n) => bad.push('無いワークフローの行：' + n));
    if (!sec.includes('「' + PURPOSE + '」')) bad.push('Actions の節の文を引いていない');
    return bad;
  };
  const f = path.join(ROOT, 'docs', 'legal-audit-2026-11-12.md');
  const text = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const names = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).filter((x) => /\.ya?ml$/.test(x)).sort();
  const now = problems(text, names);
  ok('ワークフロー（' + names.length + ' 本）が、どれも点検の記録の表に行を持ち、GitHub の追加製品の規約に照らして判定してある', now.length === 0, now.join(', '));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const broken = [
    problems(text, names.concat(['newsletter.yml'])),
    problems(text, names.slice(1)),
    problems(text.replace(new RegExp('\\n\\| `\\.github/workflows/' + esc(names[0]) + '`[^\\n]*'), ''), names),
    problems(text.replace('publication of the software project', 'promotion of the software project'), names),
    problems(text.replace(EIGHTH, '\n## 八度目\n'), names),
  ];
  ok('壊して確かめる：新しいワークフロー・外したワークフロー・表から外した行・引いた文の一語・節の見出しのどれでも落ちる（' + broken.filter((b) => b.length).length + ' / ' + broken.length + '）',
    broken.every((b) => b.length > 0));
})();

/* 2026-11-14。作者のサイトの意匠（design.js）。決まりは README の「意匠」にある。
 * テンプレートと同じ決まり（字の大きさは --fs-、書体は三つの変数、幅は --measure と --page、色は変数の定義だけ）を、
 * 意匠の CSS にも当てる。飾りの SVG は長方形・多角形・型だけで、字・画像・外への参照を持たない。
 * 当たるのは作者のサイトの頁だけで、予想のサイト（重ねる設定）には当たらない。年表は行から数える。
 * どの決まりも、壊した入力で落ちることを先に確かめる。 */
section('3g. 作者のサイトの意匠（帯・飾り・年表・色・字）');
(() => {
  const { execFileSync } = require('child_process');
  const design = require(path.join(ROOT, 'design.js'));
  const cssProblems = (css) => {
    const pi = css.indexOf('@media print');
    const screen = pi >= 0 ? css.slice(0, pi) : css;
    const bad = [];
    [...screen.matchAll(/(?<![-\w])font-size:\s*([^;}]+)/g)].map((m) => m[1].trim())
      .filter((v) => !/^var\(--fs-(xs|sm|md|lg|xl|name)\)$/.test(v)).forEach((v) => bad.push('字の大きさ ' + v));
    [...screen.matchAll(/(?<![-\w])font-family:\s*([^;}]+)/g)].map((m) => m[1].trim())
      .filter((v) => !/^var\(--font-(sans|serif|mono)\)$/.test(v)).forEach((v) => bad.push('書体 ' + v));
    [...screen.matchAll(/(?<![-\w(])max-width:\s*([^;}]+)/g)].map((m) => m[1].trim())
      .filter((v) => !/^(var\(--(measure|page)\)|100%|none)$/.test(v)).forEach((v) => bad.push('幅 ' + v));
    css.split('\n').filter((l) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l))
      .filter((l) => !/^\s*(:root[^{]*\{\s*)?(--[a-z0-9-]+:\s*[^;]+;\s*)+\}?\s*$/.test(l)).forEach((l) => bad.push('定義の外の色 ' + l.trim().slice(0, 40)));
    if (/@font-face|@import|url\(\s*['"]?(?:https?:)?\/\//i.test(css)) bad.push('外の書体か外への参照');
    return bad;
  };
  const svgProblems = (svg) => {
    const bad = [];
    const tags = [...svg.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]);
    tags.filter((t) => ['svg', 'rect', 'polygon', 'defs', 'pattern'].indexOf(t) < 0).forEach((t) => bad.push('使わない要素 ' + t));
    if (!/^<svg [^>]*aria-hidden="true"/.test(svg)) bad.push('読み上げを外していない');
    if (/href|https?:|<text|<image|font/i.test(svg)) bad.push('字か外への参照');
    return bad;
  };
  const svgs = () => [design.bandSvg(), design.sealSvg(), design.ornamentSvg('long'), design.ornamentSvg('short'), design.barSvg(3, 7)];

  const css = design.css();
  const cssNow = cssProblems(css);
  ok('意匠の CSS が、字の大きさを --fs- に、書体を三つの変数に、幅を二つに限り、色を変数の定義にしか書かず、外の書体を読まない',
     cssNow.length === 0, cssNow.join(' / '));
  const cssBroken = [css.replace('font-size: var(--fs-sm)', 'font-size: 13px'), css.replace('font-family: var(--font-mono)', 'font-family: Menlo'),
    css.replace('max-width: var(--measure)', 'max-width: 37rem'), css.replace('fill: var(--accent)', 'fill: #8a6a3d'),
    css + '@font-face { font-family: X; src: url(https://example.org/x.woff2); }\n'].map(cssProblems);
  ok('壊して確かめる：字の大きさ・書体・幅・色・外の書体のどれを混ぜても落ちる（' + cssBroken.filter((b) => b.length).length + ' / ' + cssBroken.length + '）',
     cssBroken.every((b) => b.length > 0));

  const svgNow = svgs().map(svgProblems).flat();
  ok('帯・銘・飾り・年表の棒の SVG（' + svgs().length + ' 種）が、長方形と多角形と型だけで描かれ、字も外への参照も持たず、読み上げない', svgNow.length === 0, svgNow.join(' / '));
  const svgBroken = [design.bandSvg().replace('</svg>', '<text>TN</text></svg>'), design.ornamentSvg('short').replace(' aria-hidden="true"', ''),
    design.sealSvg().replace('</svg>', '<image href="https://example.org/a.png"/></svg>')].map(svgProblems);
  ok('壊して確かめる：字・読み上げ・外の画像のどれを混ぜても落ちる（' + svgBroken.filter((b) => b.length).length + ' / ' + svgBroken.length + '）',
     svgBroken.every((b) => b.length > 0));

  /* ロゴの寸法から描いたものが、ロゴの寸法どおりか。favicon.svg との一字一句の照合は、兄弟を読める
   * cpsbvbng26-dotcom の check_ecosystem.js が見る。ここでは、飾りの枠の比がロゴの枠の比であることを見る。 */
  ok('飾りの枠の比が、ロゴの枠の比（太さ ' + design.LOGO.frame.stroke + ' / 内寸 ' + (design.LOGO.size - 2 * design.LOGO.frame.inset) + '）から取られている',
     Math.abs(design.FRAME_RATIO - design.LOGO.frame.stroke / (design.LOGO.size - 2 * design.LOGO.frame.inset)) < 1e-12
     && design.logoSvg().indexOf('stroke-width="' + design.LOGO.frame.stroke + '"') >= 0);

  /* 当たる頁と当たらない頁。作者のサイトの設定は全部当たり、予想のサイトの重ねる設定のあとは当たらない。 */
  const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const own = fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f) && !/\.site\.json$/.test(f))
    .filter((f) => { try { return /^https:\/\/cpsbvbng26-dotcom\.vercel\.app\//.test(J(f).siteUrl || ''); } catch (e) { return false; } });
  const gw = Object.assign({}, J('golden-window.en.json'), J('golden-window.site.json'));
  ok('意匠が作者のサイトの設定（' + own.length + ' 本）に当たり、予想のサイトと見本には当たらない',
     own.length > 0 && own.every((f) => design.applies(J(f))) && !design.applies(gw) && !design.applies(J('profile.json')));

  /* 生成して見る。トップの頁は帯が一本、銘が一つ、名前の下の飾りが一つ、節の見出しごとに飾りが一つ。 */
  const gen = (cfg, overlay) => {
    const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rp-design-'));
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { env: Object.assign({}, process.env,
        { PROFILE_CONFIG: path.join(ROOT, cfg), PROFILE_OUT: out }, overlay ? { PROFILE_OVERLAY: path.join(ROOT, overlay) } : {}), stdio: 'pipe' });
      return fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    } catch (e) { return ''; } finally { fs.rmSync(out, { recursive: true, force: true }); }
  };
  const top = gen('site.json');
  const count = (h, s) => h.split(s).length - 1;
  const heads = count(top, '<div class="sec-head reveal">') + count(top, '<h2 class="profile-label">');
  ok('トップの頁に、帯が一本・銘が一つ・名前の下の飾りが一つ・節の見出しごとに飾りが一つ（' + heads + '）あり、意匠の CSS が入る',
     count(top, design.bandSvg()) === 1 && /<header>\n  <svg class="band"/.test(top) && count(top, design.sealSvg()) === 1
     && count(top, design.ornamentSvg('long')) === 1 && count(top, design.ornamentSvg('short')) === heads && heads > 0
     && top.indexOf(design.css()) >= 0);
  const gwHtml = gen('golden-window.en.json', 'golden-window.site.json');
  ok('予想のサイトの頁には、帯も飾りも意匠の CSS も入らない',
     gwHtml !== '' && !/class="(band|seal|orn )|orn orn-/.test(gwHtml) && gwHtml.indexOf('意匠（design.js') < 0);

  /* 年表。行は register-timeline.json の行と同じ並びで、件数と合計を字で出す。合計は行から数える。 */
  const tl = J('register-timeline.json');
  const rows = [...top.matchAll(/<li><time datetime="(\d{4}-\d{2}-\d{2})">\1<\/time><svg class="tl-bar"[^]*?<\/svg><span class="tl-count">(\d+) 件<\/span><\/li>/g)]
    .map((m) => ({ date: m[1], count: Number(m[2]) }));
  const sum = tl.rows.reduce((n, r) => n + r.count, 0);
  ok('トップの頁の年表が、register-timeline.json の ' + tl.rows.length + ' 行を同じ並びで出し、合計（' + sum + ' 件）を行から数える',
     JSON.stringify(rows) === JSON.stringify(tl.rows) && top.indexOf('<p class="timeline-total">合計 ' + sum + ' 件</p>') >= 0
     && tl.rows.every((r, i) => i === 0 || tl.rows[i - 1].date < r.date));
  const langs = ['site.en.json', 'site.de.json', 'site.fr.json', 'site.it.json'].filter((f) => {
    const h = gen(f);
    return count(h, '<span class="tl-count">') !== tl.rows.length || h.indexOf('<p class="timeline-total">') < 0 || h.indexOf(String(sum)) < 0;
  });
  ok('ほかの四つの言語のトップの頁にも、同じ年表が出る', langs.length === 0, langs.join(', '));
  const { timeline } = require(path.join(ROOT, 'build_timeline.js'));
  const csv = 'id,status,recorded\nA-1,open,2026-09-08\n"B-1","x, ""y""\nz",2026-09-07\nA-2,open,2026-09-08\n';
  const t1 = timeline(csv);
  let threw = false;
  try { timeline('id,recorded\nA-1,2026-9-8\n'); } catch (e) { threw = true; }
  ok('壊して確かめる：年表は引用符の中の改行とカンマを読み、日の順に並べ、日付でない記録の日で止まる',
     JSON.stringify(t1) === JSON.stringify([{ date: '2026-09-07', count: 1 }, { date: '2026-09-08', count: 2 }]) && threw);
})();

/* 2026-11-23。奥行き。決まりは README の「奥行き」にある（3i）。テンプレートと意匠と生成した頁の CSS を読む。
 * - 高さは段の変数（--shadow-face・--shadow-float・--shadow-front・--shadow-well）でしか付けない。影を規則の中に直に書かない。
 * - 段の変数は、明るい側・暗い側・端末の設定の暗い側の三か所に同じ名前で置き、暗い側の二か所は一字一句同じにする。
 * - 光は左上から一方向。外へ落とす影は、横も縦も負にしない（右下へ落ちる）。
 * - 浮かせる（translate）のは、指したときと焦点が入ったときだけ。動きを減らす設定では、同じ部品の浮きを外す。
 * - 紙では、影と濃淡を外す。
 * どの決まりも、壊した入力で落ちることを先に確かめる。 */
section('3i. 奥行き（高さの段・光の向き・浮き・紙）');
(() => {
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'page.html'), 'utf8');
  const design = require(path.join(ROOT, 'design.js'));
  const NAMES = ['shadow-face', 'shadow-float', 'shadow-front', 'shadow-well'];
  const 問題 = (css) => {
    const bad = [];
    const blk = (re) => (re.exec(css) || [])[1] || '';
    const light = blk(/:root \{([^}]*)\}/), dark = blk(/:root\[data-theme="dark"\] \{([^}]*)\}/), auto = blk(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/);
    [['明', light], ['暗', dark], ['端末の暗', auto]].forEach(([n, b]) => {
      NAMES.concat(['card-lo', 'glow', 'edge-hi']).forEach((k) => { if (b.indexOf('--' + k + ':') < 0) bad.push(n + ' に --' + k + ' が無い'); });
    });
    if (dark.replace(/\s+/g, ' ').trim() !== auto.replace(/\s+/g, ' ').trim()) bad.push('暗い側の二か所が違う');
    /* 段の変数の中の影。inset で無いものは、横と縦のずれが負でない。 */
    [light, dark].forEach((b) => NAMES.forEach((k) => {
      const v = (new RegExp('--' + k + ': ([^;]+);').exec(b) || [])[1] || '';
      v.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => x && !/^inset\b/.test(x)).forEach((x) => {
        const n = x.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat);
        if (!(n[0] >= 0 && n[1] >= 0)) bad.push('--' + k + ' の影が左上へ落ちる: ' + x);
      });
    }));
    /* 規則の中の影は、段の変数か縁の明かりだけ。 */
    const rules = css.replace(/:root[^{]*\{[^}]*\}/g, '');
    [...rules.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => m[1].trim())
      .filter((v) => !/^(var\(--shadow-(face|float|front|well)\)|0 1px 0 var\(--edge-hi\)|none( !important)?)$/.test(v))
      .forEach((v) => bad.push('段の外の影 ' + v.slice(0, 40)));
    /* 浮き。translate を置く規則は :hover か :focus-visible だけで、動きを減らす設定がその部品の浮きを外す。 */
    const pi = css.indexOf('@media print');
    const screen = pi >= 0 ? css.slice(0, pi) + css.slice(css.indexOf('\n}\n', pi) + 3) : css;
    const rm = [...screen.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
    const 外す = [...rm.matchAll(/([^{}\n]+)\{[^}]*translate: none;[^}]*\}/g)].map((m) => m[1]).join(',').split(',').map((x) => x.trim()).filter(Boolean);
    const 浮く = [];
    screen.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g, '').split('}').forEach((chunk) => {
      const i = chunk.lastIndexOf('{');
      if (i < 0 || !/(^|[\s;])translate:\s*(?!none)/.test(chunk.slice(i))) return;
      chunk.slice(0, i).split('\n').pop().split(',').map((x) => x.trim()).forEach((sel) => 浮く.push(sel));
    });
    if (!浮く.length) bad.push('浮く部品が無い');
    浮く.forEach((sel) => {
      if (!/:(hover|focus-visible)$/.test(sel)) bad.push('指していないのに浮く ' + sel);
      if (外す.indexOf(sel) < 0) bad.push('動きを減らす設定で浮きを外していない ' + sel);
    });
    /* 紙。 */
    const 印 = pi >= 0 ? css.slice(pi, css.indexOf('\n}\n', pi)) : '';
    if (!/box-shadow: none !important;/.test(印) || !/background-image: none !important;/.test(印)) bad.push('紙で影か濃淡を外していない');
    return bad;
  };
  const css = ((/<style>([\s\S]*?)<\/style>/.exec(tpl) || [])[1] || '').replace('{{EXTRA_CSS}}', design.css());
  const now = 問題(css);
  ok('奥行きが、四つの段の変数（三か所に同じ名前、暗い側は同じ値）だけで付き、影は右下へ落ち、浮くのは指したときと焦点のときだけで、動きを減らす設定と紙では外れる',
     now.length === 0, now.slice(0, 4).join(' / '));
  const 壊れ = [
    css.replace('.claim, .link, .theme-toggle {\n  background: linear-gradient(180deg, var(--card), var(--card-lo));\n  box-shadow: var(--shadow-face);',
      '.claim, .link, .theme-toggle {\n  background: linear-gradient(180deg, var(--card), var(--card-lo));\n  box-shadow: 0 2px 8px var(--line);'),
    css.replace('  .entries a:hover, .entries a:focus-visible, .cert:hover, .cert:focus-visible, .link:hover, .link:focus-visible { translate: none; }\n', ''),
    css.replace('--shadow-float: inset 0 1px 0 rgba(255, 255, 255, .9), 1px 2px 3px', '--shadow-float: inset 0 1px 0 rgba(255, 255, 255, .9), -1px 2px 3px'),
    css.replace('  *, *::before, *::after { box-shadow: none !important;', '  *, *::before, *::after { opacity: 1;'),
    css.replace(/(@media \(prefers-color-scheme: dark\) \{\n  :root:not\(\[data-theme="light"\]\) \{[\s\S]*?)    --shadow-well: [^\n]*\n/, '$1'),
    css.replace('.theme-toggle:hover, .theme-toggle:focus-visible { box-shadow: var(--shadow-float); }', '.theme-toggle { translate: 0 -1px; }'),
  ].map(問題);
  ok('壊して確かめる：段の外の影・動きを減らす設定の浮き・光の向き・紙の影・暗い側の段・指していない浮きのどれを崩しても落ちる（' + 壊れ.filter((b) => b.length).length + ' / ' + 壊れ.length + '）',
     壊れ.every((b) => b.length > 0));
})();

/* この検査が名乗る件数。README と CI の仕事の名前に書いた数を、実際と合わせる（決めごと 5）。 */
section('3f. 最初のコミットの日付が、どの時刻の日付か');

/* 2026-11-13（九度目の見落とし）。トップの頁は「最初のコミットは 2026-10-30 と 2026-11-02」と
 * 時刻の帯を言わずに書いていた。deposit-check の最初のコミットは 2026-11-02T20:33Z で、日本時間では
 * 2026-11-03 になる。日付は git の履歴が記す協定世界時のものなので、五言語とも UTC と書く。
 * 最初のコミットの日付を書いた段は、その日付より前に UTC と書いてあること。日付が git と合うかは、
 * 兄弟のリポジトリを読める cpsbvbng26-dotcom の check_ecosystem.js が見る。 */
(() => {
  const LANGS = ['site.json', 'site.en.json', 'site.de.json', 'site.fr.json', 'site.it.json'];
  const SAY = {
    'site.json': ['最初のコミットは、協定世界時（UTC）で 2026-10-30 と 2026-11-02 です。', 'この段の日付は、どれも協定世界時（UTC）の日付です。'],
    'site.en.json': ['Their first commits are dated 2026-10-30 and 2026-11-02, in UTC.', 'Every date in this paragraph is a date in UTC.'],
    'site.de.json': ['Ihre ersten Commits tragen die Daten 2026-10-30 und 2026-11-02, in UTC.', 'Alle Daten in diesem Absatz sind Daten in UTC.'],
    'site.fr.json': ['Leurs premiers commits datent du 2026-10-30 et du 2026-11-02, en UTC.', 'Toutes les dates de ce paragraphe sont en UTC.'],
    'site.it.json': ['I loro primi commit sono datati 2026-10-30 e 2026-11-02, in UTC.', 'Tutte le date di questo paragrafo sono in UTC.'],
  };
  const FIRST = /最初のコミット|first commits?|ersten? Commits?|premiers? commits?|prim[oi] commit/i;
  const DATE = /\d{4}-\d{2}-\d{2}/;
  /* 純粋な判定。段（<p>…</p>）ごとに、最初のコミットの語の後に出る最初の日付について、その文か、段のそれより前に UTC があること。 */
  const problems = (texts) => {
    const bad = [];
    for (const f of LANGS) {
      const h = String(texts[f] || '');
      for (const s of SAY[f]) if (h.indexOf(s) < 0) bad.push(f + ' に「' + s.slice(0, 24) + '」が無い');
      const paras = h.split(/<\/p>/);
      paras.forEach((p, i) => {
        const m = FIRST.exec(p);
        if (!m) return;
        const d = DATE.exec(p.slice(m.index));
        if (!d) return;
        const at = m.index + d.index;
        /* 日付を含む文（句点から句点まで）か、段のそれより前に UTC があること。 */
        const end = p.slice(at).search(/[。.](?:\s|<|$)/);
        const 文 = p.slice(Math.max(p.lastIndexOf('。', at), p.lastIndexOf('. ', at)) + 1, end < 0 ? p.length : at + end + 1);
        if (p.slice(0, at).indexOf('UTC') < 0 && 文.indexOf('UTC') < 0) bad.push(f + ' の ' + (i + 1) + ' 段目が UTC と書かずに最初のコミットの日付を書く');
      });
    }
    return bad;
  };
  const texts = Object.fromEntries(LANGS.map((f) => [f, JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).profile.coreHtml]));
  const now = problems(texts);
  ok('トップの頁の五言語が、最初のコミットの日付を UTC の日付と書いている', now.length === 0, now.join(' / '));
  const 替 = (f, a2, b2) => Object.assign({}, texts, { [f]: texts[f].replace(a2, b2) });
  const breaks = [
    ['日本語の一文から UTC を外す', 替('site.json', '最初のコミットは、協定世界時（UTC）で 2026-10-30', '最初のコミットは 2026-10-30')],
    ['英語の段の一文を外す', 替('site.en.json', 'Every date in this paragraph is a date in UTC. ', '')],
    ['ドイツ語の一文から UTC を外す', 替('site.de.json', '2026-11-02, in UTC.', '2026-11-02.')],
    ['フランス語の段の一文を外す', 替('site.fr.json', 'Toutes les dates de ce paragraphe sont en UTC. ', '')],
    ['イタリア語の一文から UTC を外す', 替('site.it.json', '2026-11-02, in UTC.', '2026-11-02.')],
    ['UTC の無い段に最初のコミットの日付を足す', 替('site.en.json', '</p>', ' Its first commit is from 2026-11-03.</p>')],
  ];
  const missed = breaks.filter(([, x]) => problems(x).length === 0).map(([k]) => k);
  ok('壊して確かめる：五言語のどれかで UTC を外すか、UTC の無い段に最初のコミットの日付を足すと落ちる（' + (breaks.length - missed.length) + ' / ' + breaks.length + '）',
     missed.length === 0, missed.join(' / '));
})();

section('3b. Pages へ出す仕事を二つに分ける（2026-11-15）');
(() => {
  /* 組む仕事は読むだけで、鍵を残さずに組んで成果物を上げる。書く権限（pages・id-token）は、組まない deploy の仕事にだけ渡す。
   * autonomy-and-self-cultivation と justice-and-algorithms と同じ形。2026-11-15 に利用者が決め、Claude が書いた。 */
  const WF = path.join(ROOT, '.github', 'workflows', 'pages.yml');
  const real = fs.readFileSync(WF, 'utf8');
  const jobs = (t) => Object.fromEntries((t.split(/^jobs:\n/m)[1] || '').split(/\n(?=  [a-z]+:\n)/).map((b) => [(/^  ([a-z]+):/.exec(b) || [])[1], b]).filter(([k]) => k));
  const problems = (t) => {
    const bad = [];
    const j = jobs(t);
    if (!/^permissions:\n  contents: read\n(?!  \w)/m.test(t)) bad.push('先頭の権限が読むだけでない');
    if (!j.build || !/\n    permissions:\n      contents: read\n      pages: read\n(?!      \w)/.test(j.build) || /: write/.test(j.build)) bad.push('組む仕事の権限');
    if (!j.build || !/persist-credentials: false/.test(j.build) || !/upload-pages-artifact@/.test(j.build)) bad.push('組む仕事が鍵を残すか、成果物を上げない');
    if (!j.deploy || !/\n    needs: build\n/.test(j.deploy) || !/\n    permissions:\n      pages: write\n      id-token: write\n(?!      \w)/.test(j.deploy)) bad.push('出す仕事の権限');
    if (!j.deploy || /actions\/checkout@|node build\.js|run:/.test(j.deploy)) bad.push('出す仕事が取り出すか組む');
    if (Object.keys(j).length !== 2) bad.push('仕事の数');
    return bad;
  };
  const now = problems(real);
  ok('Pages へ出す仕事は二つで、組む仕事は読むだけ（鍵を残さず成果物を上げる）、pages と id-token は組まない deploy の仕事にだけある', now.length === 0, now.join(' / '));
  const breaks = [
    ['先頭に書く権限を戻す', real.replace('permissions:\n  contents: read\n\nconcurrency:', 'permissions:\n  contents: read\n  pages: write\n  id-token: write\n\nconcurrency:')],
    ['組む仕事に pages: write', real.replace('      contents: read\n      pages: read\n', '      contents: read\n      pages: write\n')],
    ['出す仕事で組む', real.replace('      - id: deployment\n', '      - run: node build.js\n      - id: deployment\n')],
    ['組む仕事の checkout が鍵を残す', real.replace('        with:\n          persist-credentials: false\n', '')],
    ['出す仕事が組む仕事を待たない', real.replace('    needs: build\n', '')],
  ];
  const missed = breaks.filter(([, y]) => problems(y).length === 0).map(([k]) => k);
  ok('壊して確かめる：先頭の書く権限・組む仕事の書く権限・出す仕事で組む・鍵を残す checkout・待たない出す仕事のどれでも落ちる（' + (breaks.length - missed.length) + ' / ' + breaks.length + '）', missed.length === 0, missed.join(' / '));
})();

section('3h. Wikidata の項目（2026-11-16）');
(() => {
  /* 2026-11-16 に利用者が求め、Claude が書いた。人の項目と、作品の項目三つを、構造化データの sameAs に置く。
   * 人の項目は、トップの頁の五言語の設定の Person（@id が #person）にある。
   * 作品の項目は、その作品の DOI を持つ ScholarlyArticle のすべて（ノート・要点の頁・論文の頁）にある。
   * 四つ目の作品の項目 Q142184237（Machine-mediated Rediscovery、SSRN）は、このサイトに頁が無いので、どこにも置かない。
   * ほかの Q は置かない。人の項目を作品に、作品の項目を別の作品に付けても落とす。
   * 2026-11-17。予想のサイトの設定（golden-window.site.json）の著者の Person にも、人の項目を置く。
   * その Person は @id を持たないので、ORCID を sameAs に持つ Person に限って、人の項目を許す。 */
  const { execFileSync } = require('child_process');
  const WD = 'https://www.wikidata.org/wiki/';
  const PERSON = 'Q139590485';
  const PERSON_ID = 'https://cpsbvbng26-dotcom.vercel.app/#person';
  const WORKS = { Q142184034: '10.5281/zenodo.22058254', Q142184151: '10.5281/zenodo.22057583', Q142184207: '10.5281/zenodo.22064241' };
  const ALLOWED = [PERSON].concat(Object.keys(WORKS));
  const TWINS = ['site.json', 'site.en.json', 'site.de.json', 'site.fr.json', 'site.it.json'];
  const GW = 'golden-window.site.json';
  const ORCID = 'https://orcid.org/0009-0000-1406-0547';
  const doiOf = (n) => {
    const xs = [n['@id'], n.url].concat([].concat(n.identifier || []).map((x) => (x && typeof x === 'object') ? x.value : x));
    for (const x of xs) {
      const m = /(?:doi\.org\/)?(10\.\d{4,}\/[^\s"]+)$/i.exec(String(x || ''));
      if (m) return m[1].toLowerCase();
    }
    return null;
  };
  const nodes = (o, out) => {
    if (Array.isArray(o)) o.forEach((x) => nodes(x, out));
    else if (o && typeof o === 'object') { if (o['@type']) out.push(o); Object.keys(o).forEach((k) => nodes(o[k], out)); }
    return out;
  };
  /* 純粋な判定。docs は { 名: JSON-LD }。 */
  const problems = (docs) => {
    const bad = [];
    const seen = Object.fromEntries(Object.keys(WORKS).map((q) => [q, 0]));
    for (const [f, ld] of Object.entries(docs)) {
      for (const n of nodes(ld, [])) {
        const same = [].concat(n.sameAs || []);
        const qs = same.filter((u) => /wikidata\.org/.test(u)).map((u) => (u.indexOf(WD) === 0 ? u.slice(WD.length) : '形の違う ' + u));
        const d = doiOf(n);
        qs.forEach((q) => {
          if (q === PERSON) { if (n['@type'] !== 'Person' || (n['@id'] !== PERSON_ID && !(f === GW && !n['@id'] && same.includes(ORCID)))) bad.push(f + ' の ' + (n.name || n['@type']) + ' に人の項目'); }
          else if (WORKS[q]) { if (d !== WORKS[q]) bad.push(f + ' の ' + (d || n['@type']) + ' に ' + q); else seen[q]++; }
          else bad.push(f + ' に置かない項目 ' + q);
        });
        const want = Object.keys(WORKS).find((q) => WORKS[q] === d);
        if (want && /Article|CreativeWork/.test(n['@type']) && !qs.includes(want)) bad.push(f + ' の ' + d + ' に ' + want + ' が無い');
      }
    }
    TWINS.forEach((f) => {
      const p = nodes(docs[f] || [], []).filter((n) => n['@type'] === 'Person' && n['@id'] === PERSON_ID);
      if (!p.some((n) => [].concat(n.sameAs || []).includes(WD + PERSON))) bad.push(f + ' の人に ' + PERSON + ' が無い');
    });
    {
      const p = nodes(docs[GW] || [], []).filter((n) => n['@type'] === 'Person' && [].concat(n.sameAs || []).includes(ORCID));
      if (p.length !== 1 || ![].concat(p[0].sameAs).includes(WD + PERSON)) bad.push(GW + ' の著者に ' + PERSON + ' が無い');
    }
    Object.keys(WORKS).forEach((q) => { if (!seen[q]) bad.push(q + ' がどこにも無い'); });
    return bad;
  };
  /* 生もの：設定の JSON-LD と、生成した論文の頁の JSON-LD。 */
  const docs = {};
  fs.readdirSync(ROOT).filter((f) => /\.json$/.test(f)).forEach((f) => {
    try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); if (j && j.jsonld) docs[f] = j.jsonld; } catch (e) { /* 1. で落ちる */ }
  });
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rp-wd-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build_papers.js')], { env: Object.assign({}, process.env, { PAPERS_OUT: out }), stdio: 'pipe' });
    fs.readdirSync(out).forEach((h) => {
      const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(out, h), 'utf8'));
      if (m) docs['papers/' + h] = JSON.parse(m[1]);
    });
  } catch (e) { /* 論文の頁が 0 頁になり、下で落ちる */ }
  fs.rmSync(out, { recursive: true, force: true });
  const paperPages = Object.keys(docs).filter((k) => /^papers\/.+\.html$/.test(k)).length;
  const now = problems(docs);
  ok('人の項目 ' + PERSON + ' が五言語の Person と予想のサイトの著者の sameAs にあり、作品の項目三つがその DOI の論文のすべての sameAs にある（設定 '
     + (Object.keys(docs).length - paperPages) + ' 本・論文の頁 ' + paperPages + ' 頁）', paperPages > 0 && now.length === 0, now.slice(0, 4).join(' / '));
  /* 構造化データの外も見る。設定・生成の道具・README に出る Q は、決めた四つ（人と作品三つ）だけ。 */
  const files = fs.readdirSync(ROOT).filter((f) => /\.(json|js|md)$/.test(f));
  const strays = (texts) => {
    const bad = [];
    for (const [f, t] of Object.entries(texts)) for (const m of String(t).matchAll(/\bQ\d{5,}\b/g)) if (!ALLOWED.includes(m[0])) bad.push(f + ' に ' + m[0]);
    return bad;
  };
  const texts = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
  const 余 = strays(texts);
  ok('決めた四つのほかの Wikidata の項目が、設定と道具に無い（' + files.length + ' ファイル）', 余.length === 0, 余.join(', '));
  /* 壊して確かめる。 */
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const 替 = (f, fn) => { const d = clone(docs); if (d[f]) fn(d[f]); return d; };
  const drop = (q) => (n) => { if (Array.isArray(n.sameAs)) n.sameAs = n.sameAs.filter((u) => u !== WD + q); };
  const at = (pred, fn) => (ld) => nodes(ld, []).filter(pred).forEach(fn);
  const isDoi = (d) => (n) => doiOf(n) === d;
  const 論文 = 'papers/celibate-individual.en.html';
  const breaks = [
    ['ドイツ語の頁の人から項目を外す', 替('site.de.json', at((n) => n['@type'] === 'Person', drop(PERSON)))],
    ['日本語の頁の人から項目を外す', 替('site.json', at((n) => n['@type'] === 'Person', drop(PERSON)))],
    ['英語の要点の頁の断章論から項目を外す', 替('theory-fragmentarian-spiritual-individualism.en.json', at(isDoi(WORKS.Q142184207), drop('Q142184207')))],
    ['論文の頁の独身論から項目を外す', 替(論文, at(isDoi(WORKS.Q142184034), drop('Q142184034')))],
    ['ノートの独身論の項目を、皇帝主義の項目と取り違える', 替('notes.json', at(isDoi(WORKS.Q142184034), (n) => { n.sameAs = n.sameAs.map((u) => (u === WD + 'Q142184034' ? WD + 'Q142184151' : u)); }))],
    ['人の項目を作品に付ける', 替('notes.en.json', at(isDoi(WORKS.Q142184207), (n) => { n.sameAs.push(WD + PERSON); }))],
    ['頁の無い作品の項目を足す', 替('notes.json', at(isDoi('10.5281/zenodo.22055709'), (n) => { n.sameAs.push(WD + 'Q142184237'); }))],
    ['人の項目の番号を一つ変える', 替('site.en.json', at((n) => n['@type'] === 'Person', (n) => { n.sameAs = n.sameAs.map((u) => (u === WD + PERSON ? WD + 'Q139590486' : u)); }))],
    ['予想のサイトの著者から項目を外す', 替(GW, at((n) => n['@type'] === 'Person', drop(PERSON)))],
    ['予想のサイトの著者から ORCID を外す', 替(GW, at((n) => n['@type'] === 'Person', (n) => { n.sameAs = n.sameAs.filter((u) => u !== ORCID); }))],
    ['予想のサイトの頁に人の項目を付ける', 替(GW, at((n) => n['@type'] === 'WebPage', (n) => { n.sameAs = [WD + PERSON]; }))],
  ];
  const missed = breaks.filter(([, d]) => problems(d).length === 0).map(([k]) => k);
  const 散 = strays(Object.assign({}, texts, { 'cv.json': texts['cv.json'] + ' Q142184237' })).length > 0;
  if (!散) missed.push('設定に頁の無い作品の番号を書く');
  ok('壊して確かめる：人の項目を外す（予想のサイトの著者からも）・作品の項目を外す・取り違える・人を作品や頁に付ける・頁の無い作品や違う番号を置くと落ちる（'
     + (breaks.length + 1 - missed.length) + ' / ' + (breaks.length + 1) + '）', Boolean(docs[論文]) && missed.length === 0, missed.join(' / '));
})();

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
