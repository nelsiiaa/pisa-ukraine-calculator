// Калькулятор PISA: Україна — збирає всі частини на сторінці.
// Частина 1 (калькулятор): логіка — js/calculator.js, відображення — тут. Частини 2–5 — у js/*.js, тексти — js/texts.js.
//
// КОНТРАКТ ДЛЯ ІНШИХ ЧАСТИН:
//   після показу результату:  document 'pisa:result', detail = { subject, gender, escs, pct, ciLow, ciHigh,
//                                                                  enoughData, ukrainePct, oecdPct, vsUkraine }
//   при поверненні до форми:  document 'pisa:reset'
(function () {
  'use strict';
  const C = window.PisaCommon, T = window.PisaTexts, K = window.PisaCalculator;
  const DEBUG = new URLSearchParams(location.search).get('debug') === '1'; // показує позначки SOURCE_TODO
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const int = x => C.roundHalfUp(x);
  const $ = id => document.getElementById(id);

  const form = $('calc-form'), showBtn = $('show-btn'), formHint = $('form-hint'), result = $('result'), quiz = $('quiz');
  let ROWS = null, quizDone = false, lastScale = null;

  function selection() {
    const v = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
    return { subject: v('subject'), gender: v('gender'), escs: v('escs') };
  }
  function updateButton() {
    const s = selection();
    const ready = Boolean(s.subject && s.gender && s.escs && ROWS);
    showBtn.disabled = !ready;
    formHint.hidden = ready;
  }
  // Повернення до форми. Вибір зберігається; щоб скидати його, додайте сюди рядок: form.reset(); updateButton();
  function openCalculator() {
    const fromResult = !result.hidden;
    quiz.hidden = true;
    result.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.querySelector('input').focus({ preventScroll: true });
    if (fromResult) document.dispatchEvent(new CustomEvent('pisa:reset'));
  }

  // ---------- Частина 1: шкала порівняння
  function renderScale(points) {
    lastScale = points;
    const track = $('scale-track'), top = $('lanes-top'), bottom = $('lanes-bottom');
    const group = points.find(p => p.key === 'group');
    track.innerHTML = (group && group.band ? `<span class="band" style="left:${group.band[0]}%;width:${group.band[1] - group.band[0]}%"></span>` : '')
      + points.map(p => `<span class="marker ${p.shape}" style="left:${p.value}%"></span>`).join('');
    const label = p => `<span class="lbl"><i class="${p.shape}"></i>${p.label} <b>${int(p.value)}%</b></span>`;
    top.innerHTML = points.filter(p => p.key === 'group').map(label).join('');
    bottom.innerHTML = points.filter(p => p.key !== 'group').map(label).join('');
    layoutLanes(top, points.filter(p => p.key === 'group'));
    layoutLanes(bottom, points.filter(p => p.key !== 'group'));
    $('scale-table').tBodies[0].innerHTML = points.map(p =>
      `<tr><th scope="row">${p.label}</th><td>${int(p.value)}%${p.band ? ' ' + fill(T.CALC.range_label, { low: int(p.band[0]), high: int(p.band[1]) }) : ''}</td></tr>`).join('');
  }
  // Розставляє підписи над/під шкалою: позиція за значенням, не виходить за краї, близькі підписи — у різні ряди.
  function layoutLanes(box, points) {
    const W = box.clientWidth, LINE = 26;
    const els = [...box.children];
    const items = els.map((el, i) => {
      const w = el.offsetWidth, x = Math.min(Math.max(points[i].value / 100 * W, w / 2), W - w / 2);
      return { x, width: w };
    });
    const lanes = K.assignLanes(items, 10);
    els.forEach((el, i) => { el.style.left = (items[i].x - items[i].width / 2) + 'px'; el.style.top = (lanes[i] * LINE) + 'px'; });
    box.style.height = ((Math.max(-1, ...lanes) + 1) * LINE) + 'px';
  }
  window.addEventListener('resize', () => { if (lastScale && !result.hidden) renderScale(lastScale); });

  function renderMain(subject, gender, escs, row) {
    const ukraine = K.findRow(ROWS, subject, 'all', 'all'), oecd = K.OECD_PCT[subject];
    $('res-subject').textContent = T.SUBJECT_NAME[subject];
    $('res-sentence').textContent = K.groupSentence(subject, gender, escs, row.enough_data);
    const points = [];
    if (row.enough_data) {
      const m = K.formatMain(row);
      $('res-pct').textContent = m.pct;
      $('res-range').textContent = m.range;
      $('res-diff').textContent = K.diffSentence(row, ukraine, msg => console.warn(msg));
      points.push({ key: 'group', label: T.CALC.scale_group, value: row.pct_level2, band: [row.ci_low, row.ci_high], shape: 's-circle' });
    } else {
      $('res-pct').textContent = T.CALC.no_data;
      $('res-range').textContent = '';
      $('res-diff').textContent = '';
    }
    $('res-pct').classList.toggle('no-data', !row.enough_data);
    points.push({ key: 'ukraine', label: T.CALC.scale_ukraine, value: ukraine.pct_level2, shape: 's-diamond' });
    points.push({ key: 'oecd', label: T.CALC.scale_oecd, value: oecd, shape: 's-square' });
    result.hidden = false; // підписи вимірюються лише у видимому блоці
    renderScale(points);
    document.dispatchEvent(new CustomEvent('pisa:result', { detail: {
      subject, gender, escs, pct: row.pct_level2, ciLow: row.ci_low, ciHigh: row.ci_high, enoughData: row.enough_data,
      ukrainePct: ukraine.pct_level2, oecdPct: oecd, vsUkraine: row.vs_ukraine,
    } }));
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

  // ---------- Частина 5: розрив за статтю (той самий достаток) і за достатком (та сама стать)
  function renderYears(subject, gender, escs) {
    const Y = window.PisaYears;
    const blocks = [
      { title: T.YEARS.HEADING_GENDER, res: Y.buildGapText(subject, K.findRow(ROWS, subject, 'female', escs), K.findRow(ROWS, subject, 'male', escs)) },
      { title: T.YEARS.HEADING_ESCS, res: Y.buildGapText(subject, K.findRow(ROWS, subject, gender, 'low'), K.findRow(ROWS, subject, gender, 'high')) },
    ];
    $('years').innerHTML = blocks.filter(b => b.res.situation !== 'error').map(b =>
      `<div class="gap"><h3>${b.title}</h3><p>${b.res.sentences.join(' ')}</p></div>`).join('');
  }

  function show({ subject, gender, escs }) {
    const row = K.findRow(ROWS, subject, gender, escs);
    if (!row) return;
    form.hidden = true;
    renderMain(subject, gender, escs, row);
    renderMeaning(row);
    renderYears(subject, gender, escs);
    renderSolutions(row);
    const link = $('quiz-link');
    link.hidden = !quizDone;
    if (quizDone) link.textContent = window.PisaQuiz.linkSentence(ROWS, subject, gender, escs);
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('change', updateButton);
  form.addEventListener('submit', e => { e.preventDefault(); if (!showBtn.disabled) show(selection()); });
  $('again-btn').addEventListener('click', openCalculator);
  $('quiz-skip').addEventListener('click', openCalculator);
  $('quiz-disclaimer').textContent = T.QUIZ.DISCLAIMER;
  $('license').textContent = T.QUIZ.LICENSE;
  $('escs-hint').textContent = T.CALC.escs_hint;
  $('data-note').textContent = T.CALC.note;
  $('scale-caption').textContent = T.CALC.scale_caption;

  fetch('data/pisa_ukraine_calculator.csv')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      ROWS = K.parseCsv(text);
      updateButton();
      window.PisaQuiz.start({
        mount: $('quiz-body'), rows: ROWS,
        onDone: () => { quizDone = true; openCalculator(); },
      });
    })
    .catch(err => {
      console.warn(err);
      $('quiz-body').innerHTML = `<p class="note">${T.CALC.load_error}</p>`;
      formHint.textContent = T.CALC.load_error;
    });
})();
