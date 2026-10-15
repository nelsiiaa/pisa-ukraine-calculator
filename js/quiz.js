/* Частина 2. «Перевір себе»: оприлюднені завдання PISA базового рівня перед калькулятором.
 * Банк завдань — data/quiz_bank.json (зібрала учасниця команди; звірка — docs/team/part2/zvirka_perevir_sebe.md).
 * Щоразу береться випадкове готове (`ready: true`) завдання з кожного предмета; предмет без готових завдань пропускається.
 * Частки «не досягають рівня 2» беруться з таблиці даних, а не вписуються в код. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaQuiz = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  const Q = T.QUIZ;
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const find = (rows, s, g, e) => rows.find(r => r.subject === s && r.gender === g && r.escs === e && (r.track || 'all') === 'all') || null;
  const LAST_KEY = 'pisa-quiz-last';

  /** Частка учнів, які НЕ досягають рівня 2, з рядка «усі учні» таблиці: 54.6 → «45,4». */
  function belowLevel2(rows, subject) {
    const r = find(rows, subject, 'all', 'all');
    return r ? C.comma(100 - C.toNumber(r.pct_level2)) : '—';
  }

  function pctText(r) {
    if (!r || C.toBool(r.enough_data) !== true) return 'замало даних';
    return C.comma(C.toNumber(r.pct_level2)) + '%';
  }

  /** Речення-повернення до тесту після результату калькулятора. «Інша група» = протилежна стать, те саме становище. */
  function linkSentence(rows, subject, gender, escs) {
    const otherG = gender === 'female' ? 'male' : 'female';
    return fill(Q.LINK, {
      subject_from: T.SUBJECT_FROM[subject],
      pct: pctText(find(rows, subject, gender, escs)), group: T.GROUP_GEN[gender][escs],
      pct_other: pctText(find(rows, subject, otherG, escs)), group_other: T.GROUP_GEN[otherG][escs],
    });
  }

  /** Чи готове завдання для показу: позначене ready і має коректну відповідь. */
  function isUsable(it) {
    if (!it || it.ready !== true || !C.SUBJECTS.includes(it.subject) || !it.question) return false;
    if (it.answer_number !== undefined) return Number.isFinite(Number(it.answer_number));
    return Array.isArray(it.options) && Number.isInteger(it.correct) && it.correct >= 0 && it.correct < it.options.length;
  }

  /** По одному випадковому готовому завданню з кожного предмета (читання → математика → природничі науки).
   *  avoid — id попереднього набору: їх беремо лише тоді, коли інших готових немає. */
  function pickItems(bank, random, avoid) {
    random = random || Math.random;
    const skip = new Set(avoid || []);
    const out = [];
    for (const s of C.SUBJECTS) {
      const all = (bank || []).filter(it => it.subject === s && isUsable(it));
      if (!all.length) continue;
      const fresh = all.filter(it => !skip.has(it.id));
      const pool = fresh.length ? fresh : all;
      out.push(pool[Math.floor(random() * pool.length)]);
    }
    return out;
  }

  /** Перевірка числової відповіді: «975», « 975,0 », «27 100 000». */
  function checkNumber(it, input) {
    const v = Number(String(input || '').replace(/[\s ]/g, '').replace(',', '.'));
    if (!Number.isFinite(v) || String(input || '').trim() === '') return null;
    const tol = Number(it.tolerance) || 0;
    const targets = [Number(it.answer_number)].concat((it.accept || []).map(Number));
    return targets.some(t => Math.abs(v - t) <= tol + 1e-9);
  }

  function formatAnswer(it) {
    if (it.answer_number !== undefined) return String(it.answer_number).replace('.', ',') + (it.unit ? ' ' + it.unit : '');
    return String.fromCharCode(65 + it.correct);
  }

  function readLast() {
    try { return JSON.parse(sessionStorage.getItem(LAST_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLast(ids) {
    try { sessionStorage.setItem(LAST_KEY, JSON.stringify(ids)); } catch (e) { /* без збереження */ }
  }

  /** opts: { mount, rows, bank, onDone }. Повертає { subjects } — предмети, які були в тесті (для речення-повернення). */
  function start(opts) {
    const root = opts.mount, rows = opts.rows;
    const items = pickItems(opts.bank, Math.random, readLast());
    saveLast(items.map(it => it.id));
    const state = { i: 0, score: 0 };
    if (!items.length) { if (opts.onDone) opts.onDone(false); return { subjects: [] }; }

    function stimulus(it) {
      let html = it.stimulus_html || ''; // HTML з банку завдань у репозиторії
      // Картинка необов'язкова: готові завдання розв'язуються й без неї, тому відсутній файл просто ховаємо.
      if (it.image) html += `<img class="q-img" src="${esc(it.image)}" alt="${esc(Q.IMAGE_ALT)}" onerror="this.remove()">`;
      return html;
    }

    function controls(it) {
      if (it.answer_number !== undefined) {
        return `<form class="q-num" novalidate>
            <label for="q-num-input" class="sr-only">${esc(Q.NUMBER_LABEL)}</label>
            <input id="q-num-input" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(Q.NUMBER_PLACEHOLDER)}">
            ${it.unit ? `<span class="q-unit">${esc(it.unit)}</span>` : ''}
            <button type="submit" class="btn primary">${esc(Q.CHECK)}</button>
            <p class="hint q-num-hint" hidden></p>
          </form>`;
      }
      return `<div class="q-opts">${it.options.map((o, k) => `<button type="button" class="q-opt" data-k="${k}"><b>${String.fromCharCode(65 + k)}</b><span>${esc(o)}</span></button>`).join('')}</div>`;
    }

    function renderItem() {
      const it = items[state.i];
      root.innerHTML = `
        <div class="card q-card">
          <p class="eyebrow">${esc(fill(Q.STEP, { n: state.i + 1, total: items.length, subject: T.SUBJECT_NAME[it.subject] }))}</p>
          <div class="q-stim">${stimulus(it)}</div>
          <p class="q-question">${esc(it.question)}</p>
          ${controls(it)}
          <div class="q-feedback" aria-live="polite"></div>
          <p class="q-src">${esc(Q.SOURCE)} ${esc(it.source)} <a href="${esc(it.source_url)}" target="_blank" rel="noopener">${esc(Q.ORIGINAL)}</a></p>
        </div>`;
      if (it.answer_number !== undefined) {
        const f = root.querySelector('.q-num'), input = f.querySelector('input'), hint = f.querySelector('.q-num-hint');
        f.addEventListener('submit', e => {
          e.preventDefault();
          const ok = checkNumber(it, input.value);
          if (ok === null) { hint.textContent = Q.NUMBER_INVALID; hint.hidden = false; input.focus(); return; }
          input.disabled = true;
          f.querySelector('button').disabled = true;
          hint.hidden = true;
          input.classList.add(ok ? 'right' : 'wrong');
          answer(it, ok);
        });
        input.focus({ preventScroll: true });
      } else {
        root.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => {
          const k = +b.dataset.k;
          root.querySelectorAll('.q-opt').forEach(x => {
            x.disabled = true;
            const j = +x.dataset.k;
            if (j === it.correct) x.classList.add('right');
            else if (j === k) x.classList.add('wrong');
          });
          answer(it, k === it.correct);
        }));
      }
    }

    function answer(it, ok) {
      if (ok) state.score++;
      const last = state.i === items.length - 1;
      const fb = root.querySelector('.q-feedback');
      fb.innerHTML = `
        <p><b>${ok ? esc(Q.RIGHT) : esc(fill(Q.WRONG, { answer: formatAnswer(it) }))}</b> ${esc(it.explanation)}</p>
        <p class="q-stat">${esc(fill(Q.STAT, { subject_from: T.SUBJECT_FROM[it.subject], pct: belowLevel2(rows, it.subject) }))}</p>
        <button type="button" class="btn primary q-next">${esc(last ? Q.TO_SUMMARY : Q.NEXT)}</button>`;
      fb.querySelector('.q-next').addEventListener('click', () => {
        state.i++;
        if (state.i < items.length) renderItem(); else renderSummary();
      });
      fb.querySelector('.q-next').focus();
    }

    function renderSummary() {
      const lead = state.score === items.length ? Q.LEAD_ALL_RIGHT : Q.LEAD_OTHER;
      root.innerHTML = `
        <div class="card q-card">
          <p class="eyebrow">${esc(fill(Q.SCORE, { n: state.score, total: items.length }))}</p>
          <p class="q-question">${esc(lead)}</p>
          <ul class="q-list">${C.SUBJECTS.map(s => `<li>${esc(fill(Q.LIST[s], { pct: belowLevel2(rows, s) }))}</li>`).join('')}</ul>
          <p>${esc(Q.BRIDGE)}</p>
          <button type="button" class="btn primary q-done">${esc(Q.TO_CALCULATOR)}</button>
        </div>`;
      root.querySelector('.q-done').addEventListener('click', () => opts.onDone && opts.onDone(true));
    }

    renderItem();
    return { subjects: items.map(it => it.subject) };
  }

  return { start, linkSentence, belowLevel2, pickItems, checkNumber, isUsable, formatAnswer };
});
