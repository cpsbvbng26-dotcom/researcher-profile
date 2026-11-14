#!/usr/bin/env node
/**
 * 訂正の登録簿の年表を作る（2026-11-14）。
 *
 *   REGISTER_CSV=../self-correction/data/register.csv node build_timeline.js
 *
 * self-correction の data/register.csv（登録簿の生成物）を読み、記録した日（recorded）ごとの件数を
 * register-timeline.json に書く。**このファイルは生成物で、手で直さない。**
 * 登録簿に行が増えたら、ここを回して作り直す。cpsbvbng26-dotcom の check_ecosystem.js が、
 * 兄弟の register.csv から同じ数を出して一字一句を突き合わせる。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.resolve(process.env.REGISTER_CSV || path.join(ROOT, '..', 'self-correction', 'data', 'register.csv'));
const OUT = path.join(ROOT, 'register-timeline.json');

/* RFC 4180 の CSV。引用符の中の改行・カンマ・二重の引用符を扱う。依存を足さない。 */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function timeline(csvText) {
  const [head, ...body] = parseCsv(csvText);
  const ri = head.indexOf('recorded'), ii = head.indexOf('id');
  if (ri < 0 || ii < 0) throw new Error('register.csv に id と recorded の列がありません');
  const by = new Map();
  body.forEach((r) => {
    const d = r[ri];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('recorded が日付ではありません: ' + r[ii] + ' ' + d);
    by.set(d, (by.get(d) || 0) + 1);
  });
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, count]) => ({ date, count }));
}

if (require.main === module) {
  const rows = timeline(fs.readFileSync(SRC, 'utf8'));
  const out = {
    _: '訂正の登録簿（self-correction）に、記録した日ごとに何件を書いたか。build_timeline.js が data/register.csv から作る生成物で、手で直さない。',
    source: 'https://github.com/cpsbvbng26-dotcom/self-correction/blob/main/data/register.csv',
    rows,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log('年表を書きました: ' + path.relative(process.cwd(), OUT) + '（' + rows.length + ' 日、'
    + rows.reduce((n, r) => n + r.count, 0) + ' 件）');
}

module.exports = { parseCsv, timeline };
