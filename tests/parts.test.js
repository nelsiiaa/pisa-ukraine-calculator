// Тести частин 2–5 (перевірки з промптів команди). Запуск: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const T = require('../js/texts.js');
const { buildInterpretation } = require('../js/interpretation.js');
const { buildSolutions, missingSources } = require('../js/solutions.js');
const { yearsFromPoints, formatYears, buildGapText } = require('../js/years.js');
const Quiz = require('../js/quiz.js');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pisa_ukraine_calculator.json'), 'utf8'));
const SUBJECTS = ['read', 'math', 'scie'], GENDERS = ['female', 'male', 'all'], ESCS = ['low', 'mid', 'high', 'all'];
const FORBIDDEN = ['ESCS', 'plausible', 'інтервал', 'рівень 2', 'через це', 'спричин'];
const FORBIDDEN_SOLUTIONS = FORBIDDEN.concat(['завдяки', 'гарантує', 'призведе']);
const FORBIDDEN_YEARS = FORBIDDEN.concat(['відстають']);
const row = (o) => Object.assign({ subject: 'read', gender: 'female', escs: 'low', pct_level2: 50.2, vs_ukraine: 'below', enough_data: true, mean_score: 400 }, o);
// Заглушка, що імітує pandas.Series (доступ через get) і numpy-значення (valueOf).
const series = (o) => ({ get: (k) => o[k] });
const np = (v) => ({ valueOf: () => v });
const silence = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

// ---------------- Частина 3: «Що це означає»
test('ч.3: 9 комбінацій предмет × ситуація дають 3 речення, no_data — 2', () => {
  for (const s of SUBJECTS) {
    for (const v of ['above', 'about', 'below']) assert.equal(buildInterpretation(row({ subject: s, vs_ukraine: v })).sentences.length, 3);
    const nd = buildInterpretation(row({ subject: s, enough_data: false }));
    assert.equal(nd.situation, 'no_data');
    assert.equal(nd.sentences.length, 2);
    assert.doesNotMatch(nd.text, /[0-9%]/);
  }
});
test('ч.3: 12 комбінацій стать × становище дають правильний підпис групи', () => {
  for (const g of GENDERS) for (const e of ESCS) {
    const r = buildInterpretation(row({ gender: g, escs: e }));
    assert.ok(r.text.includes(T.GROUP_GEN[g][e]), `${g}/${e}`);
  }
});
test('ч.3: enough_data у різних форматах, вхід як dict і як Series', () => {
  for (const v of [true, 'True', '1', 1, ' true ', np(true)]) assert.notEqual(buildInterpretation(row({ enough_data: v })).situation, 'no_data');
  for (const v of [false, 'False', '0', 0, np(false)]) assert.equal(buildInterpretation(row({ enough_data: v })).situation, 'no_data');
  assert.equal(buildInterpretation(series(row({}))).situation, 'below');
});
test('ч.3: невідомі значення, відсутні поля, NaN, поза 0–100 → error без винятку', () => silence(() => {
  for (const bad of [row({ subject: 'art' }), row({ gender: 'x' }), row({ vs_ukraine: 'up' }), row({ pct_level2: NaN }),
    row({ pct_level2: 101 }), row({ pct_level2: -1 }), row({ enough_data: 'maybe' }), {}, null, undefined]) {
    assert.equal(buildInterpretation(bad).situation, 'error');
  }
}));
test('ч.3: округлення «половина вгору»', () => {
  assert.match(buildInterpretation(row({ pct_level2: 50.5 })).text, /51%/);
  assert.match(buildInterpretation(row({ pct_level2: 49.5 })).text, /50%/);
});
test('ч.3: жодних заборонених слів у текстах для всіх рядків таблиці', () => {
  for (const r of DATA.groups) {
    const t = buildInterpretation(r).text;
    assert.notEqual(t, '');
    for (const w of FORBIDDEN) assert.ok(!t.toLowerCase().includes(w.toLowerCase()), w);
  }
});

// ---------------- Частина 4: «Що з цим робити»
test('ч.4: для 36 комбінацій і кожної ситуації 2–3 напрями без дублікатів', () => {
  for (const s of SUBJECTS) for (const g of GENDERS) for (const e of ESCS) for (const v of ['above', 'about', 'below']) {
    const d = buildSolutions(row({ subject: s, gender: g, escs: e, vs_ukraine: v })).directions;
    assert.ok(d.length >= 2 && d.length <= 3, `${s}/${g}/${e}/${v}`);
    assert.equal(new Set(d).size, d.length);
  }
});
test('ч.4: шар A — стать + предмет', () => {
  const a = (s, g) => buildSolutions(row({ subject: s, gender: g, vs_ukraine: 'about', escs: 'mid' })).directions[0];
  assert.equal(a('read', 'male'), 'read_boys');
  assert.equal(a('math', 'female'), 'math_girls');
  assert.equal(a('read', 'female'), 'subject_general_read');
  assert.equal(a('math', 'male'), 'subject_general_math');
  for (const s of SUBJECTS) assert.equal(a(s, 'all'), 'subject_general_' + s);
  for (const g of GENDERS) assert.equal(a('scie', g), 'subject_general_scie');
});
test('ч.4: шари B і C та порядок A, B, C, universal_school', () => {
  for (const e of ESCS) assert.equal(buildSolutions(row({ escs: e })).directions.includes('targeted_support'), e === 'low');
  assert.ok(buildSolutions(row({ vs_ukraine: 'below' })).directions.includes('system_support'));
  for (const v of ['above', 'about']) assert.ok(!buildSolutions(row({ vs_ukraine: v })).directions.includes('system_support'));
  assert.deepEqual(buildSolutions(row({ subject: 'read', gender: 'male', escs: 'low', vs_ukraine: 'below' })).directions, ['read_boys', 'targeted_support', 'system_support']);
  assert.deepEqual(buildSolutions(row({ subject: 'math', gender: 'male', escs: 'high', vs_ukraine: 'above' })).directions, ['subject_general_math', 'universal_school']);
});
test('ч.4: no_data і error дають порожній список; no_data — примітку без цифр', () => silence(() => {
  const nd = buildSolutions(row({ enough_data: '0' }));
  assert.deepEqual(nd.directions, []);
  assert.ok(nd.note.length > 0);
  assert.doesNotMatch(nd.note, /[0-9%]/);
  for (const bad of [row({ vs_ukraine: NaN }), row({ escs: 'x' }), {}, null]) {
    const r = buildSolutions(bad);
    assert.equal(r.situation, 'error');
    assert.deepEqual(r.directions, []);
  }
  assert.equal(buildSolutions(series(row({ enough_data: np(1) }))).situation, 'below');
}));
test('ч.4: тексти напрямів без заборонених слів і без статистики (цифр, %)', () => {
  for (const d of Object.values(T.DIRECTIONS)) {
    const t = d.title + ' ' + d.text;
    for (const w of FORBIDDEN_SOLUTIONS) assert.ok(!t.toLowerCase().includes(w.toLowerCase()), `${d.id}: ${w}`);
    // «15-річні» — вік, а не статистика, тому його виключаємо з перевірки цифр.
    assert.doesNotMatch(t.replace(/15-річн/g, ''), /[0-9%]/, d.id);
  }
});
test('ч.4: missingSources() повертає всі 8 id, поки джерела не заповнені', () => {
  assert.equal(missingSources().length, 8);
});

// ---------------- Частина 5: бали → роки
const yr = (o) => Object.assign({ gender: 'female', escs: 'all', enough_data: true, mean_score: 400 }, o);
test('ч.5: приклади з промпту', () => {
  const gap = (a, b) => buildGapText('read', yr({ mean_score: a }), yr({ gender: 'male', mean_score: b }));
  assert.ok(gap(434.1, 402.4).sentences[0].includes('півтора року'));     // 31,7 → 1,5
  assert.ok(gap(408, 400).sentences[0].includes('пів року'));            // 8,0 → 0,5
  assert.equal(gap(404.9, 400).situation, 'tiny');                        // 4,9
  assert.ok(gap(405, 400).sentences[0].includes('пів року'));            // 5,0 → 0,5
  assert.equal(gap(434.1, 402.4).sentences.length, 3);
  assert.equal(gap(404.9, 400).sentences.length, 2);
});
test('ч.5: format_years для всіх значень', () => {
  const expect = { 0.5: 'пів року', 1: 'один рік', 1.5: 'півтора року', 2: 'два роки', 2.5: 'два з половиною роки', 3: 'три роки',
    3.5: 'три з половиною роки', 4: 'чотири роки', 4.5: 'чотири з половиною роки', 5: "п'ять років", 5.5: "понад п'ять років", 8: "понад п'ять років" };
  for (const [y, s] of Object.entries(expect)) assert.equal(formatYears(Number(y)), s);
  assert.equal(formatYears(0.2), null);
  assert.equal(formatYears(0.25), 'пів року');
  assert.equal(formatYears(0.75), 'один рік');
  assert.equal(yearsFromPoints(-31.7), 1.585);
});
test('ч.5: порядок груп не впливає на текст; «у»/«в»', () => {
  const a = yr({ escs: 'low', mean_score: 420 }), b = yr({ gender: 'all', escs: 'low', mean_score: 400 });
  assert.deepEqual(buildGapText('math', a, b), buildGapText('math', b, a));
  assert.ok(buildGapText('math', a, b).sentences[0].includes('у дівчат з нижчим'));
  assert.ok(buildGapText('math', a, b).sentences[0].includes('в учнів з нижчим'));
  const c = yr({ escs: 'all', mean_score: 440 });
  assert.ok(buildGapText('math', c, b).sentences[0].includes('в усіх дівчат'));
});
test('ч.5: no_data без цифр; помилки → error без винятку', () => {
  const nd = buildGapText('scie', yr({ enough_data: 'False' }), yr({ gender: 'male' }));
  assert.equal(nd.situation, 'no_data');
  assert.equal(nd.sentences.length, 2);
  assert.doesNotMatch(nd.sentences.join(' '), /[0-9%]/);
  for (const [s, a, b] of [['art', yr({}), yr({})], ['read', yr({ mean_score: NaN }), yr({})], ['read', yr({ mean_score: 'abc' }), yr({})],
    ['read', {}, yr({})], ['read', null, yr({})]]) {
    const r = buildGapText(s, a, b);
    assert.equal(r.situation, 'error');
    assert.deepEqual(r.sentences, []);
  }
  assert.equal(buildGapText('read', series(yr({ enough_data: np(true), mean_score: np(430) })), yr({ gender: 'male' })).situation, 'gap');
});
test('ч.5: реальні дані — жодних заборонених слів', () => {
  for (const s of SUBJECTS) for (const e of ESCS) {
    const f = DATA.groups.find(r => r.subject === s && r.gender === 'female' && r.escs === e);
    const m = DATA.groups.find(r => r.subject === s && r.gender === 'male' && r.escs === e);
    const t = buildGapText(s, f, m).sentences.join(' ');
    assert.ok(t.length > 0);
    for (const w of FORBIDDEN_YEARS) assert.ok(!t.toLowerCase().includes(w.toLowerCase()), w);
  }
});

// ---------------- Частина 2: «Перевір себе»
test('ч.2: частки «не досягають рівня 2» з таблиці збігаються з промптом', () => {
  assert.equal(Quiz.belowLevel2(DATA.groups, 'read'), '45,4');
  assert.equal(Quiz.belowLevel2(DATA.groups, 'math'), '46,0');
  assert.equal(Quiz.belowLevel2(DATA.groups, 'scie'), '34,8');
});
test('ч.2: речення-повернення: протилежна стать, те саме становище', () => {
  const s = Quiz.linkSentence(DATA.groups, 'math', 'female', 'low');
  assert.ok(s.startsWith("Пам'ятаєш завдання з математики"));
  assert.ok(s.includes('дівчат з нижчим') && s.includes('хлопців з нижчим'));
  assert.ok(!/розв'язують|не змогли б/.test(s));
});
