// Тести частини 1 «Основний калькулятор» (перевірки з промпту). Запуск: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../js/calculator.js');

const ROWS = K.parseCsv(fs.readFileSync(path.join(__dirname, '../data/pisa_ukraine_calculator.csv'), 'utf8'));
const row = o => Object.assign({ subject: 'read', gender: 'male', escs: 'low', pct_level2: 39.3, ci_low: 34.9, ci_high: 43.7, diff_vs_ukraine: -15.3, vs_ukraine: 'below', enough_data: true }, o);
const ua = o => Object.assign({ subject: 'read', gender: 'all', escs: 'all', pct_level2: 54.6 }, o);

test('ч.1: усі 18 комбінацій є в CSV, без undefined', () => {
  assert.equal(K.combinations().length, 18);
  for (const [s, g, e] of K.combinations()) {
    const r = K.findRow(ROWS, s, g, e);
    assert.ok(r, `${s}/${g}/${e}`);
    for (const f of ['pct_level2', 'ci_low', 'ci_high', 'diff_vs_ukraine']) assert.ok(Number.isFinite(r[f]), `${s}/${g}/${e}.${f}`);
    assert.ok(['above', 'below', 'about'].includes(r.vs_ukraine));
    assert.equal(typeof r.enough_data, 'boolean');
  }
});

test('ч.1: «усі учні України» з CSV збігаються з опублікованими (54,6 / 54,0 / 65,2)', () => {
  for (const s of ['read', 'math', 'scie']) assert.ok(Math.abs(K.findRow(ROWS, s, 'all', 'all').pct_level2 - K.UKRAINE_CHECK[s]) < 0.05, s);
});

test('ч.1: формат головної цифри «58% (54–62%)»', () => {
  assert.deepEqual(K.formatMain(row({ pct_level2: 58.4, ci_low: 54.2, ci_high: 61.5 })), { pct: '58%', range: '(54–62%)' });
  assert.deepEqual(K.formatMain(row({ pct_level2: 50.5, ci_low: 46.5, ci_high: 54.4 })), { pct: '51%', range: '(47–54%)' });
});

test('ч.1: речення під цифрою', () => {
  assert.equal(K.groupSentence('read', 'male', 'low').split('.')[0], 'Це група: хлопці з нижчим достатком родини, предмет — читання');
  assert.ok(K.groupSentence('math', 'female', 'mid').includes('дівчата з середнім достатком родини, предмет — математика'));
  assert.ok(K.groupSentence('scie', 'male', 'high').includes('(рівень 2 PISA)'));
  const nd = K.groupSentence('read', 'male', 'low', false);
  assert.ok(nd.includes('надто мало учнів') && !nd.includes('частка'));
});

test('ч.1: три речення різниці та «менше ніж на 1 в.п.»', () => {
  assert.equal(K.diffSentence(row(), ua()), 'Ця група на 16 в.п. нижче за середнє по Україні.'); // 39 і 55 на екрані
  assert.equal(K.diffSentence(row({ pct_level2: 75.6, diff_vs_ukraine: 21.0, vs_ukraine: 'above' }), ua()), 'Ця група на 21 в.п. вище за середнє по Україні.');
  assert.equal(K.diffSentence(row({ vs_ukraine: 'about' }), ua()), 'Результат цієї групи близький до середнього по Україні: різниця в межах похибки.');
  assert.equal(K.diffSentence(row({ pct_level2: 54.9, diff_vs_ukraine: 0.6, vs_ukraine: 'above' }), ua()), 'Ця група менше ніж на 1 в.п. вище за середнє по Україні.');
});

test('ч.1: N збігається з round(|diff_vs_ukraine|) для всіх рядків (розбіжність ≤ 1)', () => {
  const warnings = [];
  for (const [s, g, e] of K.combinations()) K.diffSentence(K.findRow(ROWS, s, g, e), K.findRow(ROWS, s, 'all', 'all'), m => warnings.push(m));
  assert.deepEqual(warnings, []);
  const w = [];
  K.diffSentence(row({ diff_vs_ukraine: -5 }), ua(), m => w.push(m));
  assert.equal(w.length, 1);
});

test('ч.1: enough_data = false — у CSV парситься як false', () => {
  const csv = 'subject,gender,escs,pct_level2,ci_low,ci_high,mean_score,diff_vs_ukraine,vs_ukraine,n_students,n_schools,enough_data\nread,male,low,40,30,50,400,-14,below,12,3,False';
  const r = K.parseCsv(csv)[0];
  assert.equal(r.enough_data, false);
  assert.equal(r.pct_level2, 40);
});

test('ч.1: CSV без потрібних колонок — зрозуміла помилка', () => {
  assert.throws(() => K.parseCsv('subject,gender\nread,male'), /бракує колонок/);
});

test('ч.1: підписи на відстані 1 п.п. не накладаються', () => {
  const W = 328; // ширина шкали на телефоні 360 px
  const items = [54, 55].map(v => ({ x: v / 100 * W, width: 140 }));
  const lanes = K.assignLanes(items, 10);
  assert.notEqual(lanes[0], lanes[1]);
  // далекі підписи лишаються в одному ряду
  assert.deepEqual(K.assignLanes([10, 90].map(v => ({ x: v / 100 * W, width: 100 })), 10), [0, 0]);
});
