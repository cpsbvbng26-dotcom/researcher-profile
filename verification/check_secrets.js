#!/usr/bin/env node
/* 秘密情報と個人の連絡先が、追跡しているファイルに入っていないかを見る（決めごと 9）。
 *
 *   node verification/check_secrets.js
 *   node verification/check_secrets.js --break   # 壊して確かめる
 *
 * 依存なし。git ls-files が返すファイルだけを読む。外へは出ない。
 * 見るもの: 秘密鍵の頭、GitHub・AWS・Slack・Google の鍵の形、メールアドレス、電話番号の形。
 * 許すメールアドレスは下の表だけである。足すときは理由を書く。 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const PATTERNS = [
  ['秘密鍵', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['GitHub の鍵', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['AWS の鍵', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack の鍵', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google の鍵', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['電話番号', /(?<![\d.-])0\d{1,4}-\d{1,4}-\d{4}(?![\d-])/],
];
const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/* 許す宛先。コミットの開示（noreply）と、道具の使い方の見本の宛先だけ。 */
const ALLOWED_MAIL = ['noreply@anthropic.com', 'you@example.com'];
const ALLOWED_MAIL_RE = /@users\.noreply\.github\.com$/;
const TEXT = /\.(md|html|json|js|py|yml|yaml|toml|cff|txt|csv|bib|svg|xml|sh|css)$/i;

function scan(files, readFile) {
  const hits = [];
  for (const f of files) {
    if (!TEXT.test(f) && !/^(LICENSE|CITATION)/.test(path.basename(f))) continue;
    let s;
    try { s = readFile(f); } catch (e) { continue; }
    s.split('\n').forEach((line, i) => {
      for (const [name, re] of PATTERNS) if (re.test(line)) hits.push(f + ':' + (i + 1) + ' ' + name);
      for (const m of line.match(MAIL) || []) {
        if (!ALLOWED_MAIL.includes(m) && !ALLOWED_MAIL_RE.test(m)) hits.push(f + ':' + (i + 1) + ' メールアドレス ' + m);
      }
    });
  }
  return hits;
}

const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter((f) => path.basename(f) !== 'check_secrets.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

if (process.argv.includes('--break')) {
  /* 一つずつ混ぜて、ちょうど一件落ちることを見る。鍵の形は、ここで組み立てる（ファイルには置かない）。 */
  const samples = [
    '-----BEGIN ' + 'PRIVATE KEY-----',
    'gh' + 'p_' + 'a'.repeat(36),
    'AKI' + 'A' + 'B'.repeat(16),
    'xo' + 'xb-' + '1234567890-abc',
    'AI' + 'za' + 'c'.repeat(35),
    '03' + '-1234-5678',
    'someone' + '@' + 'example.org',
  ];
  let bad = 0;
  samples.forEach((s) => {
    const hits = scan(['x.md'], () => 'before\n' + s + '\nafter');
    const okk = hits.length === 1;
    if (!okk) bad++;
    console.log((okk ? '  落ちた    ' : '  落ちない  ') + s.slice(0, 12) + '…');
  });
  const clean = scan(['x.md'], () => '2026-11-11 と 10.5281/zenodo.22058254 と noreply@anthropic.com');
  if (clean.length) { bad++; console.log('  誤って落ちた: 日付・DOI・許した宛先'); }
  console.log(bad ? bad + ' 通りが期待どおりでない。' : (samples.length + 1) + ' 通りとも期待どおり。');
  process.exit(bad ? 1 : 0);
}

const hits = scan(files, read);
if (hits.length) {
  console.log('秘密情報か連絡先の形が ' + hits.length + ' 件あります。');
  hits.slice(0, 30).forEach((h) => console.log('  ' + h));
  process.exit(1);
}
console.log(files.length + ' ファイルに、秘密情報と許していない連絡先は見つかりませんでした。');
