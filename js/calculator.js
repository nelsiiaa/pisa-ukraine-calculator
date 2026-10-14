/* Частина 1. Основний калькулятор — чиста логіка без роботи з DOM (тестується в Node).
 * Відображення — в app.js, тексти — CALC у texts.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaCalculator = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  // Середнє ОЕСР, частка на рівні 2+ (просте середнє 38 країн ОЕСР, ті самі мікродані й метод).
  const OECD_PCT = { read: 69.0, math: 65.1, scie: 74.3 };
  // Опубліковані значення «усі учні України» для звірки з CSV.
  const UKRAINE_CHECK = { read: 54.6, math: 54.0, scie: 65.2 };

  const REQUIRED = ['subject', 'gender', 'escs', 'pct_level2', 'ci_low', 'ci_high', 'mean_score', 'diff_vs_ukraine', 'vs_ukraine', 'n_students', 'n_schools', 'enough_data'];
  const NUMERIC = ['pct_level2', 'ci_low', 'ci_high', 'se', 'mean_score', 'mean_se', 'diff_vs_ukraine', 'diff_se', 'n_students', 'n_schools'];

  /** Простий парсер CSV (без лапок у полях) → масив об'єктів із числами й булевими. Кидає помилку, якщо бракує колонок. */
  function parseCsv(text) {
    const lines = String(text).replace(/^﻿/, '').trim().split(/\r?\n/);
    const head = lines.shift().split(',').map(h => h.trim());
    const missing = REQUIRED.filter(c => !head.includes(c));
    if (missing.length) throw new Error('У CSV бракує колонок: ' + missing.join(', '));
    return lines.filter(l => l.trim()).map(line => {
      const v = line.split(','), o = {};
      head.forEach((h, i) => {
        const raw = (v[i] || '').trim();
        o[h] = NUMERIC.includes(h) ? C.toNumber(raw) : h === 'enough_data' ? C.toBool(raw) === true : raw;
      });
      return o;
    });
  }

  const findRow = (rows, s, g, e) => rows.find(r => r.subject === s && r.gender === g && r.escs === e) || null;
  const int = x => C.roundHalfUp(x);

  /** Головна цифра: «58% (54–62%)»; цілі числа, довге тире без пробілів. */
  function formatMain(row) {
    return { pct: int(row.pct_level2) + '%', range: '(' + int(row.ci_low) + '–' + int(row.ci_high) + '%)' };
  }

  /** Речення під цифрою; без даних — лише назва групи й пояснення, без посилання на цифру. */
  function groupSentence(subject, gender, escs, enoughData) {
    const tail = enoughData === false ? T.CALC.no_data_explain : T.CALC.share_sentence;
    return T.CALC.group_sentence
      .replace('{gender}', T.CALC.gender_plural[gender])
      .replace('{escs}', T.CALC.escs_instr[escs])
      .replace('{subject}', T.SUBJECT_NAME[subject]) + ' ' + tail;
  }

  /** Речення про різницю з Україною. N — різниця двох показаних цілих чисел. */
  function diffSentence(row, ukraineRow, warn) {
    const vs = row.vs_ukraine;
    if (vs === 'about') return T.CALC.diff_about;
    const shown = Math.abs(int(row.pct_level2) - int(ukraineRow.pct_level2));
    const expected = int(Math.abs(row.diff_vs_ukraine));
    if (Math.abs(shown - expected) > 1 && warn) warn(`Різниця на екрані (${shown}) і diff_vs_ukraine (${expected}) розходяться більше ніж на 1 в.п.`);
    const n = shown === 0 ? T.CALC.less_than_one : T.CALC.by_n.replace('{n}', shown);
    return (vs === 'above' ? T.CALC.diff_above : T.CALC.diff_below).replace('{n}', n);
  }

  /** Розкладає підписи по рядах так, щоб вони не накладалися: items = [{x, width}] у пікселях; повертає номер ряду для кожного. */
  function assignLanes(items, gap) {
    gap = gap === undefined ? 8 : gap;
    const order = items.map((it, i) => ({ i, left: it.x - it.width / 2, right: it.x + it.width / 2 })).sort((a, b) => a.left - b.left);
    const laneEnds = [], lanes = new Array(items.length);
    for (const it of order) {
      let lane = laneEnds.findIndex(end => it.left >= end + gap);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(-Infinity); }
      laneEnds[lane] = it.right;
      lanes[it.i] = lane;
    }
    return lanes;
  }

  /** Усі 18 комбінацій предмет × стать × достаток. */
  function combinations() {
    const out = [];
    for (const s of ['read', 'math', 'scie']) for (const g of ['female', 'male']) for (const e of ['low', 'mid', 'high']) out.push([s, g, e]);
    return out;
  }

  return { OECD_PCT, UKRAINE_CHECK, parseCsv, findRow, formatMain, groupSentence, diffSentence, assignLanes, combinations };
});
