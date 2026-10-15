// Тести банку «Перевір себе» (частина 2). Запуск: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../js/quiz.js');
const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/quiz_bank.json'), 'utf8'));

test('ч.2 банк: унікальні id, відомі предмети, коректні відповіді', () => {
  assert.equal(new Set(BANK.map(i => i.id)).size, BANK.length);
  for (const it of BANK) {
    assert.ok(['read', 'math', 'scie'].includes(it.subject), it.id);
    assert.ok(it.question && it.source && it.source_url && it.explanation, it.id);
    if (it.answer_number !== undefined) assert.ok(Number.isFinite(Number(it.answer_number)), it.id);
    else assert.ok(Number.isInteger(it.correct) && it.correct >= 0 && it.correct < it.options.length && it.options.length <= 5, it.id);
  }
});
test('ч.2 банк: на сайт потрапляють лише готові завдання', () => {
  const ready = BANK.filter(Q.isUsable).map(i => i.id);
  assert.deepEqual(ready.sort(), BANK.filter(i => i.ready === true).map(i => i.id).sort());
  for (let k = 0; k < 50; k++) for (const it of Q.pickItems(BANK)) assert.equal(it.ready, true);
});
test('ч.2 банк: по одному завданню з предмета; предмет без готових пропускається', () => {
  const picked = Q.pickItems(BANK, () => 0.5);
  const subjects = picked.map(i => i.subject);
  assert.equal(new Set(subjects).size, subjects.length);
  for (const s of ['read', 'math', 'scie']) assert.equal(subjects.includes(s), BANK.some(i => i.subject === s && i.ready));
  assert.deepEqual(Q.pickItems([], Math.random), []);
});
test('ч.2 банк: попередній набір не повторюється, якщо є з чого обрати', () => {
  const first = Q.pickItems(BANK, () => 0).map(i => i.id);
  const second = Q.pickItems(BANK, () => 0, first).map(i => i.id);
  for (const id of second) {
    const s = BANK.find(i => i.id === id).subject;
    const readyCount = BANK.filter(i => i.subject === s && i.ready).length;
    if (readyCount > 1) assert.ok(!first.includes(id), id);
  }
});
test('ч.2 числові відповіді: формати введення й допустимі варіанти', () => {
  const m1 = BANK.find(i => i.id === 'M1');
  assert.equal(Q.checkNumber(m1, '975'), true);
  assert.equal(Q.checkNumber(m1, ' 975,0 '), true);
  assert.equal(Q.checkNumber(m1, '976'), false);
  assert.equal(Q.checkNumber(m1, 'abc'), null);
  assert.equal(Q.checkNumber(m1, ''), null);
  const m2 = BANK.find(i => i.id === 'M2');
  if (m2) { assert.equal(Q.checkNumber(m2, '27,1'), true); assert.equal(Q.checkNumber(m2, '27 100 000'), true); }
  assert.equal(Q.formatAnswer(m1), '975 SGD');
});
