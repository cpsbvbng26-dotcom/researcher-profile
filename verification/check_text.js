/* 文字化けと既知の誤変換を止める。
 *
 *   node verification/check_text.js
 *
 * 依存パッケージなし。
 *
 * このリポジトリ群では、公開文の編集にあたって同じ種類の壊れ方が繰り返し起きている。
 * 見た目が似た別の漢字に置き換わり、意味が通らなくなる。日本語を読まない目視では
 * 気づきにくく、しかも壊れる場所が「捏造は行われていません」のような、いちばん
 * 重い一文であることが多い。
 *
 * 実際に起きたものを表に持ち、push のたびに落とす。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'site', 'pdf', 'venv']);
const EXT = ['.md', '.html', '.cff', '.json', '.js', '.py', '.yml'];

/* 実際に混入したもの。wrong は日本語として成立しない、または文脈で明らかに誤り。 */
const CORRUPTIONS = [
  { wrong: '捨造', right: '捏造', note: '「引用・出典の捏造は行われていません」— 開示文で最も重い一文' },
  { wrong: '取り縹う', right: '取り繕う', note: '「あとから表示だけを取り繕うことはできません」' },
  { wrong: '取り縁う', right: '取り繕う', note: '同上' },
  { wrong: '精締', right: '精緻', note: '「精緻な議論」' },
  { wrong: 'チェックデジット', right: 'チェックディジット', note: 'check digit の表記' }
];

/* 文字化けではなく、実在する字だが、この一連のリポジトリで表記を一つに決めたもの。
 * 誤変換と混ぜると、壊れているのか選んだのかが区別できなくなる。 */
const INCONSISTENT = [
  { wrong: '叙勳', right: '叙勲',
    note: '散文は常用字体。史料そのものの引用（敍勲四等授瑞寶章 など）はこの限りではない' }
];


/* ですます調から である調へ書き換えたとき、五段活用の連用形に「た」「ない」を
 * そのまま繋ぐ壊れ方が起きた。「載りました」→「載りた」、「使いません」→「使いない」。
 * 日本語として成立しないが、漢字は正しいので目視では通り抜ける。
 *
 * 推測で活用を作らない。実際に混入した形だけを表に持つ。 */
const CONJUGATION = [
  { re: /ありなかった/, right: 'なかった', note: '「ありません」からの書き換え' },
  { re: /ありた(?![いくかけ])/, right: 'あった', note: '同上' },
  { re: /なりた(?![いくかけ])/, right: 'なった', note: '「なりました」からの書き換え' },
  { re: /残りた(?![いくかけ])/, right: '残った', note: '「残りました」からの書き換え' },
  { re: /載りた(?![いくかけ])/, right: '載った', note: '「載りました」からの書き換え' },
  { re: /分かりた(?![いくかけ])/, right: '分かった', note: '「分かりました」からの書き換え' },
  { re: /書きた(?![いくかけ])/, right: '書いた', note: '「書きました」からの書き換え' },
  { re: /置きた(?![いくかけ])/, right: '置いた', note: '「置きました」からの書き換え' },
  { re: /拾いた(?![いくかけ])/, right: '拾った', note: '「拾いました」からの書き換え' },
  { re: /行いた(?![いくかけ])/, right: '行った', note: '「行いました」からの書き換え' },
  { re: /使いた(?![いくかけ])/, right: '使った', note: '「使いました」からの書き換え' },
  { re: /使いない/, right: '使わない', note: '「使いません」からの書き換え' },
  { re: /言いない/, right: '言わない', note: '「言いません」からの書き換え' },
  { re: /狂いる/, right: '狂う', note: '「狂います」からの書き換え' },
  { re: /落とする/, right: '落とす', note: '「落とします」からの書き換え' }
];

/* Markdown のバッジ記法の壊れ。![...] の ! が落ちる、括弧が全角になる。 */
const BADGE_BROKEN = /\[!(?!\[)[^\]]*\]\(https?:\/\/[^)]*badge/;

/* 第三者のロゴは載せない方針。バッジは文字と色だけにする。
 * 商標は各社のもので、使用許諾を得ているわけではないため。 */
const BADGE_LOGO = /img\.shields\.io\/badge\/[^)\s"]*[?&]logo=/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return EXT.includes(path.extname(e.name)) ? [full] : [];
  });
}

const files = walk(ROOT);
const hits = [];

files.forEach((file) => {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 表そのものを走査対象から外す（このファイル自身）
    if (rel === path.join('verification', 'check_text.js')) return;

    CORRUPTIONS.forEach((c) => {
      if (line.indexOf(c.wrong) >= 0) {
        hits.push({
          file: rel, line: i + 1, kind: '誤変換',
          msg: '「' + c.wrong + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });

    INCONSISTENT.forEach((c) => {
      if (line.indexOf(c.wrong) >= 0) {
        hits.push({
          file: rel, line: i + 1, kind: '表記の揺れ',
          msg: '「' + c.wrong + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });
    CONJUGATION.forEach((c) => {
      const m = line.match(c.re);
      if (m) {
        hits.push({
          file: rel, line: i + 1, kind: '活用の壊れ',
          msg: '「' + m[0] + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });

    if (BADGE_BROKEN.test(line)) {
      hits.push({
        file: rel, line: i + 1, kind: 'バッジ記法',
        msg: '! または [ が欠けています（[![…](…)](…) の形）',
        text: line.trim().slice(0, 90)
      });
    }
    if (BADGE_LOGO.test(line)) {
      hits.push({
        file: rel, line: i + 1, kind: '第三者のロゴ',
        msg: 'バッジに logo= が入っています。文字と色だけにしてください',
        text: line.trim().slice(0, 90)
      });
    }
  });
});

console.log(files.length + ' ファイルを走査しました。');
if (hits.length) {
  console.log('\n' + hits.length + ' 件見つかりました。\n');
  hits.forEach((h) => {
    console.log('  [' + h.kind + '] ' + h.file + ':' + h.line);
    console.log('    ' + h.msg);
    console.log('    > ' + h.text + '\n');
  });
  process.exit(1);
}
console.log('既知の誤変換・活用の壊れ・表記の揺れ・バッジの壊れ・第三者のロゴは見つかりませんでした。');
