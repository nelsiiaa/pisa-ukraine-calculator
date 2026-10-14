/* Частина 2. «Перевір себе»: три оприлюднені завдання PISA базового рівня перед калькулятором.
 * Основа — perevir-sebe.js команди; тексти завдань у texts.js (QUIZ.ITEMS).
 * Частки «не досягають рівня 2» беруться з таблиці даних, а не вписуються в код. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./common.js'), require('./texts.js'));
  else root.PisaQuiz = factory(root.PisaCommon, root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (C, T) {
  'use strict';

  const Q = T.QUIZ;
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const find = (rows, s, g, e) => rows.find(r => r.subject === s && r.gender === g && r.escs === e) || null;

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

  function start(opts) {
    const root = opts.mount, rows = opts.rows, items = Q.ITEMS;
    const state = { i: 0, score: 0 };

    function stimulus(it) {
      let html = it.stimulus_html || '';
      if (it.image) {
        html += `<img class="q-img" src="${esc(it.image)}" alt="Діаграма до завдання" onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'q-todo',textContent:'Діаграму до цього завдання можна переглянути в оригіналі ОЕСР (посилання нижче).'}))">`;
      } else if (!it.stimulus_html) {
        html += `<p class="q-todo">Текст до цього завдання можна прочитати в оригіналі (посилання нижче).</p>`;
      }
      return html;
    }

    function renderItem() {
      const it = items[state.i];
      root.innerHTML = `
        <div class="card q-card">
          <p class="eyebrow">Завдання ${state.i + 1} з ${items.length} · ${esc(T.SUBJECT_NAME[it.subject])}</p>
          <div class="q-stim">${stimulus(it)}</div>
          <p class="q-question">${esc(it.question)}</p>
          <div class="q-opts">${it.options.map((o, k) => `<button type="button" class="q-opt" data-k="${k}"><b>${String.fromCharCode(65 + k)}</b><span>${esc(o)}</span></button>`).join('')}</div>
          <div class="q-feedback" aria-live="polite"></div>
          <p class="q-src">Джерело: ${esc(it.source)} <a href="${esc(it.source_url)}" target="_blank" rel="noopener">Оригінал</a></p>
        </div>`;
      root.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => answer(it, +b.dataset.k)));
    }

    function answer(it, k) {
      const ok = k === it.correct;
      if (ok) state.score++;
      root.querySelectorAll('.q-opt').forEach(b => {
        b.disabled = true;
        const j = +b.dataset.k;
        if (j === it.correct) b.classList.add('right');
        else if (j === k) b.classList.add('wrong');
      });
      const last = state.i === items.length - 1;
      const fb = root.querySelector('.q-feedback');
      fb.innerHTML = `
        <p><b>${ok ? 'Правильно.' : 'Неправильно. Правильна відповідь: ' + String.fromCharCode(65 + it.correct) + '.'}</b> ${esc(it.explanation)}</p>
        <p class="q-stat">${esc(fill(Q.STAT, { subject_from: T.SUBJECT_FROM[it.subject], pct: belowLevel2(rows, it.subject) }))}</p>
        <button type="button" class="btn primary q-next">${last ? 'Підсумок' : 'Наступне завдання'}</button>`;
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
          <button type="button" class="btn primary q-done">Перейти до калькулятора</button>
        </div>`;
      root.querySelector('.q-done').addEventListener('click', () => opts.onDone && opts.onDone(true));
    }

    renderItem();
  }

  return { start, linkSentence, belowLevel2 };
});
