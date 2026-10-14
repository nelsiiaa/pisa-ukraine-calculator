/* Частина 4. «Що з цим робити»: 2–3 напрями підтримки залежно від комбінації.
 * buildSolutions(row) → { situation, directions: [id...], note }. Ніколи не кидає виняток.
 * Тексти напрямів — у texts.js (DIRECTIONS). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaSolutions = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  const ERROR = () => ({ situation: 'error', directions: [], note: '' });

  /** Вибір ситуації — так само, як у частині 3. */
  function situationOf(row) {
    const subject = C.field(row, 'subject'), gender = C.field(row, 'gender'), escs = C.field(row, 'escs');
    if (!C.SUBJECTS.includes(subject) || !C.GENDERS.includes(gender) || !C.ESCS.includes(escs)) return 'error';
    const enough = C.toBool(C.field(row, 'enough_data'));
    if (enough === null) return 'error';
    if (!enough) return 'no_data';
    const vs = C.field(row, 'vs_ukraine');
    return ['above', 'about', 'below'].includes(vs) ? vs : 'error';
  }

  function buildSolutions(row) {
    try {
      const situation = situationOf(row);
      if (situation === 'error') { console.warn('solutions: некоректний рядок'); return ERROR(); }
      if (situation === 'no_data') return { situation, directions: [], note: T.SOLUTIONS.NO_DATA_NOTE };

      const subject = C.field(row, 'subject'), gender = C.field(row, 'gender'), escs = C.field(row, 'escs');
      const out = [];
      // Шар A: стать + предмет — завжди рівно один напрям.
      if (gender === 'male' && subject === 'read') out.push('read_boys');
      else if (gender === 'female' && subject === 'math') out.push('math_girls');
      else out.push('subject_general_' + subject);
      // Шар B: нижче соціально-економічне становище.
      if (escs === 'low') out.push('targeted_support');
      // Шар C: результат групи нижчий за середній.
      if (situation === 'below') out.push('system_support');
      // Добір до мінімуму двох напрямів.
      if (out.length < 2) out.push('universal_school');
      return { situation, directions: out.slice(0, 3), note: '' };
    } catch (e) {
      console.warn('solutions: помилка', e);
      return ERROR();
    }
  }

  /** id напрямів, у яких не заповнене хоча б одне з полів джерела. */
  function missingSources() {
    return Object.values(T.DIRECTIONS)
      .filter(d => !d.source_title || !d.source_url || !d.source_location)
      .map(d => d.id);
  }

  return { buildSolutions, missingSources, situationOf };
});
