/* Спільні допоміжні функції для всіх частин калькулятора.
 * Працює і в браузері (window.PisaCommon), і в Node (для тестів). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PisaCommon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Приводить значення до звичайного JS-типу: знімає обгортки (valueOf) і пробіли в рядках. */
  function plain(v) {
    if (v !== null && typeof v === 'object' && typeof v.valueOf === 'function') {
      const u = v.valueOf();
      if (u !== v) v = u;
    }
    return typeof v === 'string' ? v.trim() : v;
  }

  /** Безпечно читає поле рядка: row може бути об'єктом, Map або об'єктом із методом get (як pandas.Series). */
  function field(row, key) {
    try {
      if (row == null) return undefined;
      if (typeof row.get === 'function') {
        const v = row.get(key);
        if (v !== undefined) return plain(v);
      }
      return plain(row[key]);
    } catch (e) {
      return undefined;
    }
  }

  /** enough_data у будь-якому форматі → true / false; невідоме значення → null. */
  function toBool(v) {
    v = plain(v);
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
    }
    return null;
  }

  /** Число з числа або рядка («58.3», « 58,3 »); NaN, якщо не число. */
  function toNumber(v) {
    v = plain(v);
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '') return Number(v.replace(',', '.'));
    return NaN;
  }

  /** Округлення «половина вгору» для невід'ємних чисел: 50.5 → 51, 49.5 → 50. */
  function roundHalfUp(x) {
    return Math.floor(x + 0.5);
  }

  /** Число з комою: 45.4 → «45,4». */
  function comma(x, digits) {
    return x.toFixed(digits === undefined ? 1 : digits).replace('.', ',');
  }

  /** Форма слова «бал» після числа: 1 бал, 2 бали, 5 балів, 21 бал. */
  function pointsWord(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a >= 11 && a <= 14) return 'балів';
    if (b === 1) return 'бал';
    if (b >= 2 && b <= 4) return 'бали';
    return 'балів';
  }

  const SUBJECTS = ['read', 'math', 'scie'];
  const GENDERS = ['female', 'male', 'all'];
  const ESCS = ['low', 'mid', 'high', 'all'];

  return { plain, field, toBool, toNumber, roundHalfUp, comma, pointsWord, SUBJECTS, GENDERS, ESCS };
});
