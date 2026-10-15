/*
 * Частина 6. «Поділитися»: посилання з обраною комбінацією і картка-картинка 1080×1920 (сторіс).
 * Основа — share.js учасниці команди (оригінал, версія 3: docs/team/part6/share.js). Узгоджено з рештою сайту:
 *   - параметри посилання такі самі, як у таблиці даних: ?subject=read&gender=female&escs=low[&track=grade9];
 *   - підписи з js/texts.js (SHARE, CALC), кольори й шрифти — як на сайті;
 *   - на картці та сама шкала (коло / ромб / квадрат), формат «39% (35–44%)» і текст «Що це означає», що й на сторінці.
 * Чисті функції (buildQuery, parseQuery) працюють і в Node — для тестів.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./texts.js'));
  else root.PisaShare = factory(root.PisaTexts);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  // ===== 1. ДОЗВОЛЕНІ ЗНАЧЕННЯ (ті самі, що в data/pisa_ukraine_calculator.csv) =====
  const ALLOWED = {
    subject: ['read', 'math', 'scie'],
    gender: ['female', 'male'],
    escs: ['low', 'mid', 'high'],
    track: ['all', 'grade9', 'general', 'vocational'],
  };
  const REQUIRED = ['subject', 'gender', 'escs'];

  /** Рядок параметрів для посилання; track додається лише якщо обрано тип навчання. */
  function buildQuery(state) {
    const p = new URLSearchParams();
    REQUIRED.forEach(k => p.set(k, state[k]));
    if (state.track && state.track !== 'all') p.set('track', state.track);
    return '?' + p.toString();
  }

  /** Стан із рядка параметрів або null. Невідомі значення ігноруються (захист від сміття в адресі).
   *  allowTrack = false — якщо в даних немає типу навчання, track з посилання не враховується. */
  function parseQuery(search, allowTrack) {
    const p = new URLSearchParams(search || '');
    const state = {};
    for (const k of REQUIRED) {
      const v = p.get(k);
      if (!v || !ALLOWED[k].includes(v)) return null;
      state[k] = v;
    }
    const t = p.get('track');
    state.track = allowTrack !== false && t && ALLOWED.track.includes(t) ? t : 'all';
    return state;
  }

  // ===== 2. ВИГЛЯД КАРТИНКИ (світла тема сайту) =====
  const CARD = {
    width: 1080, height: 1920,
    body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    display: 'Unbounded, "Arial Black", system-ui, sans-serif',
    bg: '#f3f5f8', panel: '#ffffff', ink: '#141a24', ink2: '#4a5464', muted: '#727c8c',
    track: '#e7ebf1', chip: '#e8ecfb',
    colors: { group: '#2747d4', ukraine: '#c98200', oecd: '#6b7480' },
    maxMeaningLines: 8,
  };

  let config = {};
  let statusTimer = null;

  // ===== 3. ПОСИЛАННЯ =====
  function buildLink(state) {
    const url = new URL(window.location.href);
    url.search = buildQuery(state);
    url.hash = '';
    return url.toString();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // Запасний спосіб для старих браузерів
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); } finally { document.body.removeChild(area); }
    });
  }

  // Повне повідомлення (версія 3 учасниці): текст, а з нового рядка активне посилання.
  function shareMessage(link) {
    return (config.shareText || T.SHARE.share_text) + '\n' + link;
  }

  function onLinkClick() {
    const result = getResultOrWarn();
    if (!result) return;
    // За замовчуванням копіюємо текст разом із посиланням; лише посилання — init({ copyWithText: false }).
    const toCopy = config.copyWithText === false ? buildLink(result) : shareMessage(buildLink(result));
    copyText(toCopy).then(
      () => setStatus(T.SHARE.link_copied),
      () => window.prompt(T.SHARE.link_prompt, toCopy) // якщо браузер не дав копіювати — показуємо текст
    );
  }

  // ===== 4. КАРТИНКА =====
  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Позначки як на сайті: коло — твоя група, ромб — Україна, квадрат — ОЕСР
  function marker(ctx, shape, cx, cy, size, color, ring) {
    ctx.save();
    ctx.translate(cx, cy);
    if (shape === 'diamond') ctx.rotate(Math.PI / 4);
    const s = shape === 'diamond' ? size * 0.8 : size;
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = color;
    ctx.fill();
    if (ring) { ctx.lineWidth = ring; ctx.strokeStyle = CARD.panel; ctx.stroke(); }
    ctx.restore();
  }

  function drawCard(r) {
    const W = CARD.width, H = CARD.height, x = 100, contentW = W - 2 * x;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = CARD.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = CARD.panel; roundRect(ctx, 48, 48, W - 96, H - 96, 48); ctx.fill();

    let y = 170;
    ctx.fillStyle = CARD.muted; ctx.font = '600 32px ' + CARD.body;
    ctx.fillText(T.SHARE.card_source.toUpperCase(), x, y);

    // Заголовок
    y += 96;
    ctx.fillStyle = CARD.ink; ctx.font = '700 60px ' + CARD.display;
    wrapText(ctx, T.SHARE.card_title, contentW).forEach(line => { ctx.fillText(line, x, y); y += 76; });

    // Обрані ознаки — «таблетки»
    y += 6;
    const chips = [T.SUBJECT_NAME[r.subject].replace(/^./, c => c.toUpperCase()), T.SHARE.card_gender[r.gender], T.SHARE.card_escs[r.escs]];
    if (r.track && r.track !== 'all') chips.push(T.CALC.track_options[r.track]);
    ctx.font = '600 32px ' + CARD.body;
    let cx = x, cy = y;
    chips.forEach(label => {
      const w = ctx.measureText(label).width + 52;
      if (cx + w > x + contentW) { cx = x; cy += 76; }
      ctx.fillStyle = CARD.chip; roundRect(ctx, cx, cy, w, 60, 30); ctx.fill();
      ctx.fillStyle = CARD.ink; ctx.fillText(label, cx + 26, cy + 41);
      cx += w + 14;
    });
    y = cy + 60;

    // Велика цифра і діапазон («39% (35–44%)»)
    if (r.enoughData) {
      y += 220;
      ctx.fillStyle = CARD.colors.group; ctx.font = '700 210px ' + CARD.display;
      ctx.fillText(Math.round(r.percent) + '%', x - 8, y);
      y += 62;
      ctx.fillStyle = CARD.muted; ctx.font = '500 42px ' + CARD.body;
      ctx.fillText('(' + Math.round(r.low) + '–' + Math.round(r.high) + '%)', x, y);
      y += 62;
      ctx.fillStyle = CARD.ink; ctx.font = '600 40px ' + CARD.body;
      wrapText(ctx, T.SHARE.card_reach, contentW).forEach(line => { ctx.fillText(line, x, y); y += 52; });
    } else {
      y += 150;
      ctx.fillStyle = CARD.ink2; ctx.font = '700 90px ' + CARD.display;
      ctx.fillText(T.CALC.no_data, x, y);
      y += 70;
      ctx.font = '500 36px ' + CARD.body;
      wrapText(ctx, T.CALC.no_data_explain, contentW).forEach(line => { ctx.fillText(line, x, y); y += 48; });
    }
    if (r.track && r.track !== 'all') {
      ctx.fillStyle = CARD.muted; ctx.font = '500 32px ' + CARD.body;
      ctx.fillText(T.CALC.track_note, x, y + 4); y += 48;
    }

    // Шкала порівняння: діапазон групи і три позначки
    y += 48;
    const X = v => x + contentW * Math.min(100, Math.max(0, v)) / 100;
    ctx.fillStyle = CARD.track; roundRect(ctx, x, y - 12, contentW, 24, 12); ctx.fill();
    if (r.enoughData) {
      ctx.globalAlpha = 0.28; ctx.fillStyle = CARD.colors.group;
      roundRect(ctx, X(r.low), y - 12, Math.max(24, X(r.high) - X(r.low)), 24, 12); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Порядок як на сайті: твоя група, усі учні України, середнє ОЕСР
    const points = [
      { label: T.CALC.scale_group, value: r.percent, shape: 'circle', color: CARD.colors.group, show: r.enoughData },
      { label: T.CALC.scale_ukraine, value: r.ukraine, shape: 'diamond', color: CARD.colors.ukraine, show: true },
      { label: T.CALC.scale_oecd, value: r.oecd, shape: 'square', color: CARD.colors.oecd, show: true },
    ].filter(p => p.show);
    points.slice().reverse().forEach(p => marker(ctx, p.shape, X(p.value), y, p.shape === 'circle' ? 46 : 38, p.color, 6)); // група — поверх інших
    y += 56;
    ctx.fillStyle = CARD.muted; ctx.font = '500 28px ' + CARD.body;
    ctx.fillText('0%', x, y); ctx.textAlign = 'center'; ctx.fillText('50%', x + contentW / 2, y);
    ctx.textAlign = 'right'; ctx.fillText('100%', x + contentW, y); ctx.textAlign = 'left';

    // Легенда з тими самими формами
    y += 24;
    points.forEach(p => {
      y += 52;
      marker(ctx, p.shape, x + 14, y - 12, 24, p.color, 0);
      ctx.fillStyle = CARD.ink2; ctx.font = '500 34px ' + CARD.body; ctx.fillText(p.label, x + 46, y);
      ctx.fillStyle = CARD.ink; ctx.font = '700 34px ' + CARD.body; ctx.textAlign = 'right';
      ctx.fillText(Math.round(p.value) + '%', x + contentW, y); ctx.textAlign = 'left';
    });

    // Різниця з Україною (те саме речення, що на сайті)
    if (r.diff) {
      y += 60;
      ctx.fillStyle = CARD.ink; ctx.font = '600 34px ' + CARD.body;
      wrapText(ctx, r.diff, contentW).forEach((line, i) => { if (i) y += 46; ctx.fillText(line, x, y); });
    }

    // Що це означає (текст частини 3; обрізаємо, якщо не вміщається)
    y += 70;
    ctx.fillStyle = CARD.ink; ctx.font = '700 38px ' + CARD.display; ctx.fillText(T.SHARE.card_meaning, x, y);
    y += 10;
    ctx.fillStyle = CARD.ink2; ctx.font = '400 32px ' + CARD.body;
    let lines = wrapText(ctx, r.meaning || '', contentW);
    const maxLines = Math.min(CARD.maxMeaningLines, Math.max(2, Math.floor((H - 190 - y) / 46)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[lines.length - 1].replace(/[\s.,;:]*$/, '');
      while (last.indexOf(' ') !== -1 && ctx.measureText(last + '…').width > contentW) last = last.slice(0, last.lastIndexOf(' ')).replace(/[\s.,;:]*$/, '');
      lines[lines.length - 1] = last + '…';
    }
    lines.forEach(line => { y += 46; ctx.fillText(line, x, y); });

    // Низ: застереження. Адреси сайту на картці немає — посилання йде текстом разом із картинкою (версія 3 учасниці).
    ctx.fillStyle = CARD.muted; ctx.font = '400 28px ' + CARD.body;
    ctx.fillText(T.SHARE.card_disclaimer, x, H - 130);
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Запасний варіант (комп'ютер або браузер без меню «Поділитися»): завантажуємо картинку
  // і копіюємо текст із посиланням, щоб надіслати їх разом.
  function saveAndCopy(blob, fileName, result) {
    downloadBlob(blob, fileName);
    copyText(shareMessage(buildLink(result))).then(
      () => setStatus(T.SHARE.image_saved_copied),
      () => setStatus(T.SHARE.image_saved_nocopy)
    );
  }

  // Шрифти сайту мають завантажитися до малювання, інакше canvas візьме запасні.
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['700 60px Unbounded', '400 32px "IBM Plex Sans"', '600 32px "IBM Plex Sans"', '700 34px "IBM Plex Sans"']
      .map(f => document.fonts.load(f).catch(() => null)));
  }

  function onImageClick() {
    const result = getResultOrWarn();
    if (!result) return;
    const fileName = T.SHARE.file_name;
    setStatus(T.SHARE.image_making);
    fontsReady()
      .then(() => canvasToBlob(drawCard(result)))
      .then(blob => {
        let file = null;
        try { file = new File([blob], fileName, { type: 'image/png' }); } catch (e) { file = null; }
        // Меню «Поділитися» з картинкою є на більшості телефонів
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          // Текст і посилання — підпис до картинки (у Telegram посилання буде активним)
          return navigator.share({ files: [file], title: T.SHARE.share_title, text: shareMessage(buildLink(result)) })
            .then(() => setStatus(T.SHARE.image_done))
            .catch(err => {
              if (err && err.name === 'AbortError') setStatus(''); // людина сама закрила меню
              else saveAndCopy(blob, fileName, result);
            });
        }
        saveAndCopy(blob, fileName, result);
      })
      .catch(() => setStatus(T.SHARE.image_error, true));
  }

  // ===== 5. ДОПОМІЖНЕ =====
  function getResultOrWarn() {
    const result = typeof config.getResult === 'function' ? config.getResult() : null;
    if (!result || !REQUIRED.every(k => ALLOWED[k].includes(result[k]))) {
      setStatus(T.SHARE.no_result, true);
      return null;
    }
    // Правило учасниці: якщо для комбінації замало даних, цифрою ділитися не можна.
    if (result.enoughData === false) {
      setStatus(T.SHARE.no_data_share, true);
      return null;
    }
    return result;
  }

  function setStatus(text, isError) {
    const el = config.statusEl ? document.querySelector(config.statusEl) : null;
    if (!el) return;
    el.textContent = text;
    el.setAttribute('data-error', isError ? 'true' : 'false');
    clearTimeout(statusTimer);
    if (text) statusTimer = setTimeout(() => { el.textContent = ''; }, 5000);
  }

  // ===== 6. ЗАПУСК =====
  // config: { linkButton, imageButton, statusEl, getResult(), onLoadFromLink(state), allowTrack, shareText?, copyWithText? }
  function init(options) {
    config = options || {};
    const linkBtn = document.querySelector(config.linkButton || '#btn-link');
    const imageBtn = document.querySelector(config.imageButton || '#btn-image');
    if (linkBtn) linkBtn.addEventListener('click', onLinkClick);
    if (imageBtn) imageBtn.addEventListener('click', onImageClick);
    // Якщо сторінку відкрили за чиїмось посиланням — одразу показуємо той самий результат
    const state = parseQuery(window.location.search, config.allowTrack);
    if (state && typeof config.onLoadFromLink === 'function') config.onLoadFromLink(state);
  }

  return { init, buildQuery, parseQuery, ALLOWED, _drawCard: drawCard };
});
