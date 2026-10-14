/* Частина 5. Переклад різниці в середніх балах двох груп у приблизні роки навчання.
 * Різниця = mean_score групи A − mean_score групи B (поле diff_vs_ukraine не використовується).
 * Функції ніколи не кидають виняток. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaYears = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  const Y = T.YEARS;
  const ERROR = () => ({ situation: 'error', sentences: [] });
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

  /** Кількість років навчання для різниці в балах. */
  function yearsFromPoints(points) {
    const p = C.toNumber(points);
    return Number.isFinite(p) ? Math.abs(p) / Y.POINTS_PER_YEAR : NaN;
  }

  /** Округлення до 0,5 «половина вгору» і мовна форма; null, якщо округлене значення 0. */
  function formatYears(years) {
    if (!Number.isFinite(years)) return null;
    const r = Math.floor(Math.abs(years) * 2 + 0.5) / 2;
    if (r === 0) return null;
    if (r > 5) return Y.OVER_FIVE;
    return Y.FORMS[r] || null;
  }

  /** «у» або «в» перед підписом групи: «в усіх дівчат», «у дівчат з…». */
  function prepFor(label) {
    return /^[уУ]/.test(label) ? 'в' : 'у';
  }

  /** Текст про розрив між двома групами одного предмета. */
  function buildGapText(subject, rowA, rowB) {
    try {
      if (!C.SUBJECTS.includes(subject)) return ERROR();
      const labelOf = row => {
        const g = C.field(row, 'gender'), e = C.field(row, 'escs');
        return C.GENDERS.includes(g) && C.ESCS.includes(e) ? T.GROUP_GEN[g][e] : null;
      };
      const la = labelOf(rowA), lb = labelOf(rowB);
      if (!la || !lb) return ERROR();
      const subject_from = T.SUBJECT_FROM[subject];

      const ea = C.toBool(C.field(rowA, 'enough_data')), eb = C.toBool(C.field(rowB, 'enough_data'));
      if (ea === null || eb === null) return ERROR();
      if (!ea || !eb) return { situation: 'no_data', sentences: Y.NO_DATA.map(s => fill(s, { subject_from })) };

      const ma = C.toNumber(C.field(rowA, 'mean_score')), mb = C.toNumber(C.field(rowB, 'mean_score'));
      if (!Number.isFinite(ma) || !Number.isFinite(mb)) return ERROR();
      const gap = ma - mb;

      if (Math.abs(gap) < 5) {
        const sentences = Y.TINY.map(s => fill(s, { subject_from, prep: prepFor(la), group_a: la, prep2: prepFor(lb), group_b: lb }));
        return { situation: 'tiny', sentences };
      }
      const [high, low] = gap >= 0 ? [la, lb] : [lb, la];
      const points = C.roundHalfUp(Math.abs(gap));
      const sentences = Y.GAP.map(s => fill(s, {
        subject_from, prep: prepFor(high), group_high: high, prep2: prepFor(low), group_low: low,
        years_text: formatYears(yearsFromPoints(gap)),
        points: points + ' ' + C.pointsWord(points),
        points_per_year: Y.POINTS_PER_YEAR,
      }));
      return { situation: 'gap', sentences };
    } catch (e) {
      console.warn('years: помилка', e);
      return ERROR();
    }
  }

  return { yearsFromPoints, formatYears, buildGapText, prepFor };
});
