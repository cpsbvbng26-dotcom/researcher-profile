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
  const 許す = ['bg', 'card', 'text', 'muted', 'faint', 'line', 'line-soft', 'accent', 'accent-soft', 'accent-wash', 'header-bg'];
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

/* 2026-11-12 の続き（法的なリスクを締めた）。Vercel の無料の枠（Hobby）は、個人の非営利の利用に限られ、
 * 商品や役務の販売の広告を商用の例に挙げる。配っている頁の設定に、受注の場への道と「案件募集」を置かない。
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
