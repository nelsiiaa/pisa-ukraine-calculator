/* Частина 3. «Що це означає»: 2–3 речення без термінів залежно від результату.
 * Чиста функція: buildInterpretation(row) → { situation, sentences, text }. Ніколи не кидає виняток. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaInterpretation = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  const ERROR = () => ({ situation: 'error', sentences: [], text: '' });
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/,(\s*[,.])/g, '$1');

  /** Повертає пояснення для одного рядка таблиці (об'єкт або об'єкт із методом get). */
  function buildInterpretation(row) {
    try {
      const subject = C.field(row, 'subject');
      const gender = C.field(row, 'gender');
      const escs = C.field(row, 'escs');
      if (!C.SUBJECTS.includes(subject) || !C.GENDERS.includes(gender) || !C.ESCS.includes(escs)) {
        console.warn('interpretation: невідомі subject/gender/escs', subject, gender, escs);
        return ERROR();
      }
      const track = C.field(row, 'track');
      const group = T.GROUP_GEN[gender][escs] + (track && track !== 'all' && T.TRACK_SUFFIX[track] ? T.TRACK_SUFFIX[track] : '');
      const enough = C.toBool(C.field(row, 'enough_data'));
      if (enough === null) {
        console.warn('interpretation: невідоме значення enough_data');
        return ERROR();
      }
      if (!enough) {
        const sentences = T.INTERPRETATION.NO_DATA.map(s => fill(s, { group, subject_from: T.SUBJECT_FROM[subject] }));
        return { situation: 'no_data', sentences, text: sentences.join(' ') };
      }
      const situation = C.field(row, 'vs_ukraine');
      if (!['above', 'about', 'below'].includes(situation)) {
        console.warn('interpretation: невідоме значення vs_ukraine', situation);
        return ERROR();
      }
      const pct = C.toNumber(C.field(row, 'pct_level2'));
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        console.warn('interpretation: pct_level2 поза 0–100 або не число', pct);
        return ERROR();
      }
      const sentences = [
        T.INTERPRETATION.LEVEL_DEFINITION[subject],
        fill(T.INTERPRETATION.SITUATION[situation], { group, pct: C.roundHalfUp(pct) }),
        T.INTERPRETATION.NOT_MEANING[situation],
      ];
      return { situation, sentences, text: sentences.join(' ') };
    } catch (e) {
      console.warn('interpretation: помилка', e);
      return ERROR();
    }
  }

  return { buildInterpretation };
});
