// Тести помічника «Визнач свій рівень». Запуск: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../js/escs.js');
const T = require('../js/texts.js');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/escs_model.json'), 'utf8'));

const all = (v) => Object.fromEntries(E.QUESTIONS.map(q => [q, v]));
const low = { education: 'basic', occupation: 'isco9', books: '0-10', cars: '0', toilets: '1', laptops: '0', tvs: '1-2' };
const high = { education: 'university', occupation: 'isco2', books: '200+', cars: '2', toilets: '2', laptops: '3-5', tvs: '3-5' };

test('помічник: неповні відповіді — без оцінки', () => {
  assert.equal(E.estimate(M, { ...low, tvs: '' }).complete, false);
  assert.equal(E.estimate(M, {}).complete, false);
  assert.equal(E.estimate(null, low).complete, false);
});
test('помічник: формула відтворює ESCS = b0 + bP·роки + bI·статус + bH·речі', () => {
  const r = E.estimate(M, low), f = M.formula, h = M.home;
  const hp = h.intercept + E.HOME.reduce((s, q) => s + h.items[q][low[q]], 0);
  assert.ok(Math.abs(r.escs - (f.intercept + f.paredint * M.education.basic + f.hisei * M.occupation.isco9 + f.homepos * hp)) < 1e-9);
});
test('помічник: типові родини дають очікувані рівні', () => {
  assert.equal(E.estimate(M, low).level, 'low');
  assert.equal(E.estimate(M, high).level, 'high');
});
test('помічник: «Не знаю» на всі питання — середній рівень', () => {
  const r = E.estimate(M, all('unknown'));
  assert.equal(r.complete, true);
  assert.equal(r.level, 'mid');
});
test('помічник: поблизу межі повертає сусідній рівень', () => {
  for (const [lvl, c] of [['low', M.cuts[0] - 0.05], ['mid', M.cuts[0] + 0.05], ['mid', M.cuts[1] - 0.05], ['high', M.cuts[1] + 0.05]]) {
    const m = JSON.parse(JSON.stringify(M));
    // зсуваємо вільний член так, щоб оцінка для «low» дорівнювала c
    m.formula.intercept += c - E.estimate(M, low).escs;
    const r = E.estimate(m, low);
    assert.equal(r.level, lvl);
    assert.ok(r.nearLevel && r.nearLevel !== lvl);
  }
});
test('помічник: кожна відповідь у текстах має значення в моделі і навпаки', () => {
  const Q = T.CALC.escs_questions;
  for (const q of E.QUESTIONS) {
    const modelKeys = q === 'education' ? Object.keys(M.education) : q === 'occupation' ? Object.keys(M.occupation) : Object.keys(M.home.items[q]);
    assert.deepEqual(Object.keys(Q[q].options).sort(), modelKeys.sort(), q);
  }
});
test('помічник: точність моделі на даних — не нижче 80%', () => {
  assert.ok(M.validation.accuracy >= 0.8);
  assert.ok(M.validation.off_by_two < 0.01);
  for (const [i, c] of M.cuts.entries()) assert.ok(Math.abs(c - [-0.68, 0.19][i]) < 0.01); // ті самі межі, що в калькуляторі
});
