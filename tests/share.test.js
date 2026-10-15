// Тести частини 6 «Поділитися» (посилання). Запуск: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/share.js');

test('ч.6: посилання з комбінацією має ті самі назви, що й таблиця даних', () => {
  assert.equal(S.buildQuery({ subject: 'read', gender: 'male', escs: 'low', track: 'all' }), '?subject=read&gender=male&escs=low');
  assert.equal(S.buildQuery({ subject: 'scie', gender: 'female', escs: 'high', track: 'vocational' }), '?subject=scie&gender=female&escs=high&track=vocational');
});
test('ч.6: посилання → той самий стан (туди й назад)', () => {
  for (const st of [{ subject: 'math', gender: 'female', escs: 'mid', track: 'all' }, { subject: 'read', gender: 'male', escs: 'high', track: 'grade9' }]) {
    assert.deepEqual(S.parseQuery(S.buildQuery(st), true), st);
  }
});
test('ч.6: неповні або чужі значення в адресі ігноруються', () => {
  assert.equal(S.parseQuery('?subject=read&gender=male', true), null);
  assert.equal(S.parseQuery('?subject=reading&gender=boy&escs=low', true), null); // старі назви з тестової сторінки
  assert.equal(S.parseQuery('?subject=read&gender=male&escs=<script>', true), null);
  assert.equal(S.parseQuery('', true), null);
  assert.deepEqual(S.parseQuery('?subject=read&gender=male&escs=low&track=xyz', true).track, 'all');
});
test('ч.6: якщо в даних немає типу навчання, track з посилання не враховується', () => {
  assert.equal(S.parseQuery('?subject=read&gender=male&escs=low&track=grade9', false).track, 'all');
});
