// Калькулятор PISA: Україна — збирає всі частини на сторінці.
// Частина 1 (калькулятор) тут; частини 2–5 — у js/*.js, тексти — у js/texts.js.
(function () {
  'use strict';
  const C = window.PisaCommon, T = window.PisaTexts;
  const DEBUG = new URLSearchParams(location.search).get('debug') === '1'; // показує позначки SOURCE_TODO
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const pct0 = x => C.roundHalfUp(x) + '%';
  const $ = id => document.getElementById(id);

  const form = $('calc-form'), showBtn = $('show-btn'), formHint = $('form-hint'), result = $('result'), quiz = $('quiz');
  let DATA = null, quizDone = false;

  const findRow = (s, g, e) => DATA.groups.find(r => r.subject === s && r.gender === g && r.escs === e);
  function selection() {
    const v = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
    return { subject: v('subject'), gender: v('gender'), escs: v('escs') };
  }
  function updateButton() {
    const s = selection();
    const ready = Boolean(s.subject && s.gender && s.escs && DATA);
    showBtn.disabled = !ready;
    formHint.hidden = ready;
  }
  function openCalculator() {
    quiz.hidden = true;
    result.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Частина 1: головна цифра, шкала, різниця з Україною
  function renderMain(subject, gender, escs, row) {
    const ukraine = findRow(subject, 'all', 'all'), oecd = DATA.oecd_average[subject];
    $('res-group').textContent = `${T.GROUP_NOM[gender][escs]} · ${T.SUBJECT_NAME[subject]}`;
    if (!row.enough_data) {
      $('res-pct').textContent = '—';
      $('res-range').textContent = '';
      $('res-sentence').textContent = T.CALC.no_data;
      $('res-diff').textContent = '';
    } else {
      $('res-pct').textContent = pct0(row.pct_level2);
      $('res-range').textContent = fill(T.CALC.range, { low: pct0(row.ci_low), high: pct0(row.ci_high) });
      $('res-sentence').textContent = fill(T.CALC.result_sentence, { pct: pct0(row.pct_level2), subject_from: T.SUBJECT_FROM[subject] });
      $('res-diff').textContent = row.vs_ukraine === 'above' ? fill(T.CALC.diff_above, { diff: C.comma(Math.abs(row.diff_vs_ukraine)) })
        : row.vs_ukraine === 'below' ? fill(T.CALC.diff_below, { diff: C.comma(Math.abs(row.diff_vs_ukraine)) })
        : T.CALC.diff_about;
    }
    const values = [
      { label: T.CALC.scale_group, value: row.enough_data ? row.pct_level2 : null, cls: 'm-group' },
      { label: T.CALC.scale_ukraine, value: ukraine.pct_level2, cls: 'm-ukraine' },
      { label: T.CALC.scale_oecd, value: oecd.pct_level2, cls: 'm-oecd' },
    ];
    const track = $('scale-track');
    track.innerHTML = values.filter(v => v.value != null).map(v => `<span class="marker ${v.cls}" style="left:${v.value}%"></span>`).join('');
    $('scale-legend').innerHTML = values.map(v =>
      `<li><i class="${v.cls}"></i><span>${v.label}</span><b>${v.value == null ? '—' : pct0(v.value)}</b></li>`).join('');
  }

  // ---------- Частина 3
  function renderMeaning(row) {
    $('meaning-text').textContent = window.PisaInterpretation.buildInterpretation(row).text;
  }

  // ---------- Частина 4
  function renderSolutions(row) {
    const res = window.PisaSolutions.buildSolutions(row);
    $('solutions-note').hidden = !res.note;
    $('solutions-note').textContent = res.note;
    $('solutions').innerHTML = res.directions.map(id => {
      const d = T.DIRECTIONS[id];
      const audience = T.SOLUTIONS.AUDIENCE_PREFIX + d.audience.map(a => T.AUDIENCE[a]).join(', ');
      let source = '';
      if (d.source_title && d.source_url) {
        source = `<p class="src"><a href="${d.source_url}" target="_blank" rel="noopener">${fill(T.SOLUTIONS.SOURCE, { source_title: d.source_title, source_location: d.source_location || '' })}</a></p>`;
      } else if (DEBUG) {
        source = '<p class="src todo">SOURCE_TODO</p>';
      }
      return `<article class="solution"><h3>${d.title}</h3><p>${d.text}</p><p class="aud">${audience}</p>${source}</article>`;
    }).join('');
  }

  // ---------- Частина 5: розрив за статтю (те саме становище) і за становищем (та сама стать)
  function renderYears(subject, gender, escs) {
    const Y = window.PisaYears;
    const blocks = [
      { title: T.YEARS.HEADING_GENDER, res: Y.buildGapText(subject, findRow(subject, 'female', escs), findRow(subject, 'male', escs)) },
      { title: T.YEARS.HEADING_ESCS, res: Y.buildGapText(subject, findRow(subject, gender, 'low'), findRow(subject, gender, 'high')) },
    ];
    $('years').innerHTML = blocks.filter(b => b.res.situation !== 'error').map(b =>
      `<div class="gap"><h3>${b.title}</h3><p>${b.res.sentences.join(' ')}</p></div>`).join('');
  }

  function show({ subject, gender, escs }) {
    const row = findRow(subject, gender, escs);
    if (!row) return;
    renderMain(subject, gender, escs, row);
    renderMeaning(row);
    renderYears(subject, gender, escs);
    renderSolutions(row);
    const link = $('quiz-link');
    link.hidden = !quizDone;
    if (quizDone) link.textContent = window.PisaQuiz.linkSentence(DATA.groups, subject, gender, escs);
    form.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('change', updateButton);
  form.addEventListener('submit', e => { e.preventDefault(); if (!showBtn.disabled) show(selection()); });
  $('again-btn').addEventListener('click', openCalculator);
  $('quiz-skip').addEventListener('click', openCalculator);
  $('quiz-disclaimer').textContent = T.QUIZ.DISCLAIMER;
  $('license').textContent = T.QUIZ.LICENSE;

  fetch('data/pisa_ukraine_calculator.json')
    .then(r => r.json())
    .then(d => {
      DATA = d;
      updateButton();
      window.PisaQuiz.start({
        mount: $('quiz-body'), rows: d.groups,
        onDone: () => { quizDone = true; openCalculator(); },
      });
    })
    .catch(() => { $('quiz-body').textContent = 'Не вдалося завантажити дані. Оновіть сторінку.'; });
})();
