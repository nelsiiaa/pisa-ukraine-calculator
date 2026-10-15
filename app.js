// Калькулятор PISA: Україна — збирає всі частини на сторінці.
// Частина 1 (калькулятор): логіка — js/calculator.js, відображення — тут. Частини 2–5 — у js/*.js, тексти — js/texts.js.
//
// КОНТРАКТ ДЛЯ ІНШИХ ЧАСТИН:
//   після показу результату:  document 'pisa:result', detail = { subject, gender, escs, track, pct, ciLow, ciHigh,
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
  let quizSkippedByLink = false;
  let ROWS = null, quizDone = false, lastScale = null, LAST = null; // LAST — показаний результат (для частини 6)

  function selection() {
    const v = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
    return { subject: v('subject'), gender: v('gender'), escs: v('escs'), track: v('track') || 'all' };
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
    if (fromResult) { LAST = null; document.dispatchEvent(new CustomEvent('pisa:reset')); }
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

  function renderMain(subject, gender, escs, track, row) {
    // «Усі учні України» — завжди без типу навчання, навіть якщо його обрано.
    const ukraine = K.findRow(ROWS, subject, 'all', 'all', 'all'), oecd = K.OECD_PCT[subject];
    $('res-subject').textContent = T.SUBJECT_NAME[subject];
    $('res-sentence').textContent = K.groupSentence(subject, gender, escs, row.enough_data, track);
    $('res-track-note').hidden = track === 'all';
    $('res-track-note').textContent = T.CALC.track_note;
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
      subject, gender, escs, track, pct: row.pct_level2, ciLow: row.ci_low, ciHigh: row.ci_high, enoughData: row.enough_data,
      ukrainePct: ukraine.pct_level2, oecdPct: oecd, vsUkraine: row.vs_ukraine,
    } }));
  }

  // ---------- Частина 3: визначення з іконкою · 100 крапок · статус · застереження
  const I = window.PisaIcons;
  function renderMeaning(row, subject) {
    const res = window.PisaInterpretation.buildInterpretation(row);
    const box = $('meaning-text');
    if (!['above', 'about', 'below'].includes(res.situation)) {
      box.innerHTML = res.sentences.length ? `<p class="caution">${I.info}<span>${res.text}</span></p>` : '';
      return;
    }
    const n = int(row.pct_level2), M = T.INTERPRETATION;
    const dots = Array.from({ length: 100 }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('');
    box.innerHTML = `
      <div class="mean-def"><span class="icon-badge">${I[subject]}</span>
        <div><p class="mini">${M.DEF_LABEL}</p><p>${res.sentences[0]}</p></div></div>
      <div class="mean-group">
        <div class="dots" role="img" aria-label="${fill(M.DOTS_ARIA, { n })}">${dots}</div>
        <div class="mean-side">
          <p class="dots-cap">${fill(M.DOTS_CAPTION, { n: `<b>${n}</b>` })}</p>
          <span class="status st-${res.situation}">${M.STATUS[res.situation]}</span>
          <p>${res.sentences[1]}</p>
        </div>
      </div>
      <p class="caution">${I.info}<span>${res.sentences[2]}</span></p>`;
  }

  // ---------- Частина 4: картки з іконкою, причиною й адресатами
  function renderSolutions(row) {
    const res = window.PisaSolutions.buildSolutions(row), S = T.SOLUTIONS;
    $('solutions-note').hidden = !res.note;
    $('solutions-note').textContent = res.note;
    $('solutions').innerHTML = res.directions.map(id => {
      const d = T.DIRECTIONS[id];
      let source = '';
      if (d.source_title && d.source_url) {
        source = `<p class="src"><a href="${d.source_url}" target="_blank" rel="noopener">${fill(S.SOURCE, { source_title: d.source_title, source_location: d.source_location || '' })}</a></p>`;
      } else if (DEBUG) {
        source = '<p class="src todo">SOURCE_TODO</p>';
      }
      const aud = d.audience.map(a => `<li class="aud-${a}">${T.AUDIENCE[a]}</li>`).join('');
      return `<article class="solution">
          <header class="sol-head">
            <span class="icon-badge">${I[S.ICON[id]] || ''}</span>
            <div><p class="sol-why">${S.REASON[id] || ''}</p><h3>${d.title}</h3></div>
          </header>
          <p>${d.text}</p>
          <ul class="aud" aria-label="${S.AUDIENCE_PREFIX.replace(':', '').trim()}">${aud}</ul>
          ${source}
        </article>`;
    }).join('');
  }

  // ---------- Частина 5: розрив за статтю (той самий достаток) і за достатком (та сама стать)
  function renderYears(subject, gender, escs, track) {
    const Y = window.PisaYears;
    const blocks = [
      { title: T.YEARS.HEADING_GENDER, res: Y.buildGapText(subject, K.findRow(ROWS, subject, 'female', escs, track), K.findRow(ROWS, subject, 'male', escs, track)) },
      { title: T.YEARS.HEADING_ESCS, res: Y.buildGapText(subject, K.findRow(ROWS, subject, gender, 'low', track), K.findRow(ROWS, subject, gender, 'high', track)) },
    ];
    $('years').innerHTML = blocks.filter(b => b.res.situation !== 'error').map(b =>
      `<div class="gap"><h3>${b.title}</h3><p>${b.res.sentences.join(' ')}</p></div>`).join('');
  }

  function show({ subject, gender, escs, track }) {
    const row = K.findRow(ROWS, subject, gender, escs, track);
    if (!row) return;
    const ukraine = K.findRow(ROWS, subject, 'all', 'all', 'all');
    LAST = { subject, gender, escs, track, enoughData: row.enough_data, percent: row.pct_level2, low: row.ci_low, high: row.ci_high,
      ukraine: ukraine.pct_level2, oecd: K.OECD_PCT[subject],
      diff: row.enough_data ? K.diffSentence(row, ukraine) : '',
      // На картку — речення про групу (застереження вже є внизу картки, визначення рівня не вміщається)
      meaning: (it => (it.sentences.length === 3 ? [it.sentences[1]] : it.sentences).join(' '))(window.PisaInterpretation.buildInterpretation(row)) };
    form.hidden = true;
    renderMain(subject, gender, escs, track, row);
    renderMeaning(row, subject);
    renderYears(subject, gender, escs, track);
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
  $('escs-helper-summary').textContent = T.CALC.escs_helper_summary;
  $('escs-helper-intro').textContent = T.CALC.escs_helper_intro;
  $('track-legend').textContent = T.CALC.track_legend;
  $('track-hint').textContent = T.CALC.track_hint;

  // ---------- Помічник «Визнач свій рівень»: 7 питань → оцінка ESCS → автоматичний вибір рівня
  let ESCS_MODEL = null;
  function setupEscsHelper(model) {
    ESCS_MODEL = model;
    const Q = T.CALC.escs_questions;
    $('escs-questions').innerHTML = window.PisaEscs.QUESTIONS.map(q => {
      const def = Q[q], name = 'escsq-' + q;
      const control = def.select
        ? `<select id="${name}" name="${name}"><option value="">${T.CALC.escs_select_placeholder}</option>${Object.entries(def.options).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`
        : `<div class="chips chips-sm" role="radiogroup" aria-labelledby="${name}-label">${Object.entries(def.options).map(([v, l]) =>
            `<label><input type="radio" name="${name}" value="${v}"><span>${l}</span></label>`).join('')}</div>`;
      return `<div class="escs-q"><p class="escs-q-label" id="${name}-label">${def.select ? `<label for="${name}">${def.label}</label>` : def.label}</p>${def.hint ? `<p class="hint">${def.hint}</p>` : ''}${control}</div>`;
    }).join('');
    $('escs-helper').hidden = false;
    $('escs-questions').addEventListener('change', e => { e.stopPropagation(); updateEscsEstimate(); });
    updateEscsEstimate();
  }
  function escsAnswers() {
    const a = {};
    for (const q of window.PisaEscs.QUESTIONS) {
      const el = form.querySelector(`select[name="escsq-${q}"]`) || form.querySelector(`input[name="escsq-${q}"]:checked`);
      a[q] = el ? el.value : '';
    }
    return a;
  }
  function updateEscsEstimate() {
    const res = window.PisaEscs.estimate(ESCS_MODEL, escsAnswers()), box = $('escs-estimate'), N = T.CALC.escs_level_name;
    if (!res.complete) { box.innerHTML = `<p class="hint">${T.CALC.escs_incomplete}</p>`; return; }
    const msg = res.nearLevel
      ? fill(T.CALC.escs_result_near, { level: N[res.level], other: N[res.nearLevel] })
      : fill(T.CALC.escs_result, { level: N[res.level] });
    const n = Math.round(ESCS_MODEL.validation.accuracy * 10);
    box.innerHTML = `<p class="escs-result"><b>${msg}</b></p><p class="hint">${fill(T.CALC.escs_reliability, { n })}</p>`;
    const radio = form.querySelector(`input[name="escs"][value="${res.level}"]`);
    if (radio && !radio.checked) { radio.checked = true; updateButton(); }
  }

  // ---------- Частина 6: поділитися (js/share.js)
  function setupShare() {
    $('btn-link').textContent = T.SHARE.link_button;
    $('btn-image').textContent = T.SHARE.image_button;
    window.PisaShare.init({
      linkButton: '#btn-link', imageButton: '#btn-image', statusEl: '#share-status',
      allowTrack: K.hasTrack(ROWS),
      getResult: () => LAST,
      // Відкрили за чиїмось посиланням: пропускаємо тест, підставляємо вибір у форму й показуємо результат.
      onLoadFromLink: state => {
        for (const [name, value] of Object.entries(state)) {
          const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
          if (input) input.checked = true;
        }
        quizSkippedByLink = true;
        quiz.hidden = true;
        updateButton();
        show(state);
      },
    });
  }

  // Поле «Де ти вчишся?» — лише якщо в таблиці є рядки з типом навчання. За замовчуванням «Не вказувати».
  function setupTrackField() {
    if (!K.hasTrack(ROWS)) return;
    $('track-chips').innerHTML = ['all', ...K.TRACKS].map(t =>
      `<label><input type="radio" name="track" value="${t}"${t === 'all' ? ' checked' : ''}><span>${T.CALC.track_options[t]}</span></label>`).join('');
    $('track-field').hidden = false;
  }
  $('data-note').textContent = T.CALC.note;
  $('scale-caption').textContent = T.CALC.scale_caption;

  // Модель для помічника необов'язкова: якщо не завантажилась, помічник просто не показується.
  fetch('data/escs_model.json').then(r => (r.ok ? r.json() : null)).then(m => { if (m) setupEscsHelper(m); }).catch(() => {});

  fetch('data/pisa_ukraine_calculator.csv')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      ROWS = K.parseCsv(text);
      setupTrackField();
      updateButton();
      setupShare();
      if (quizSkippedByLink) return;
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
