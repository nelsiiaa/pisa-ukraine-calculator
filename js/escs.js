/* Оцінка рівня достатку (ESCS) з семи простих питань — чиста логіка (тестується в Node).
 * Модель — data/escs_model.json (scripts/escs_model.py):
 *   ESCS ≈ b0 + bP·(роки освіти батьків) + bI·(статус професії) + bH·(речі вдома)
 * Рівень — у яку третину національного розподілу потрапляє оцінка (ті самі межі, що в калькуляторі). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PisaEscs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const QUESTIONS = ['education', 'occupation', 'books', 'cars', 'toilets', 'laptops', 'tvs'];
  const HOME = ['books', 'cars', 'toilets', 'laptops', 'tvs'];
  const LEVELS = ['low', 'mid', 'high'];

  /** answers: { education, occupation, books, cars, toilets, laptops, tvs }; кожна відповідь може бути 'unknown'.
   *  Повертає { complete, escs, level, nearLevel } або { complete: false }, якщо відповіли не на все. */
  function estimate(model, answers) {
    if (!model || !answers || !QUESTIONS.every(q => answers[q] !== undefined && answers[q] !== null && answers[q] !== '')) return { complete: false };
    const pe = model.education[answers.education];
    const hi = model.occupation[answers.occupation];
    let hp = model.home.intercept;
    for (const q of HOME) {
      const v = model.home.items[q][answers[q]];
      if (v === undefined) return { complete: false };
      hp += v;
    }
    if (pe === undefined || hi === undefined) return { complete: false };
    const f = model.formula;
    const escs = f.intercept + f.paredint * pe + f.hisei * hi + f.homepos * hp;
    const [c1, c2] = model.cuts;
    const i = escs <= c1 ? 0 : escs <= c2 ? 1 : 2;
    // Поблизу межі між рівнями оцінка менш надійна — повертаємо сусідній рівень.
    let nearLevel = null;
    if (Math.abs(escs - c1) < model.near_cut) nearLevel = LEVELS[i === 0 ? 1 : 0];
    else if (Math.abs(escs - c2) < model.near_cut) nearLevel = LEVELS[i === 2 ? 1 : 2];
    return { complete: true, escs, level: LEVELS[i], nearLevel };
  }

  return { QUESTIONS, HOME, LEVELS, estimate };
});
