/*
 * share.js: дві кнопки «Поділитися» для калькулятора PISA: Україна
 *
 *   Кнопка 1: копіює посилання, яке відкриває сайт одразу з готовим результатом.
 *   Кнопка 2: створює картинку 1080x1320 (пропорція 1:1,2) з результатом
 *             і відкриває меню «Поділитися» (або завантажує файл, якщо меню немає).
 *
 * Цей файл не залежить від решти сайту. Щоб підключити його, команді треба
 * зробити три речі (див. README.md):
 *   1) підключити файл:  <script src="share.js"></script>
 *   2) додати на сторінку дві кнопки з id="btn-link" та id="btn-image"
 *   3) викликати PisaShare.init({...}) і передати дві функції (getResult, onLoadFromLink)
 */
(function () {
  "use strict";

  // ===== 1. ДОЗВОЛЕНІ ЗНАЧЕННЯ (мають збігатися з формою калькулятора) =====
  // Ліворуч: що пишемо в посилання. Праворуч: підпис для людини.
  // Якщо команда змінить варіанти у формі, змініть їх і тут.
  // Назви значень взято з таблиці команди (data/pisa_ukraine_calculator.csv):
  // стовпці subject, gender, escs.
  var ALLOWED = {
    subject: { read: "Читання", math: "Математика", scie: "Природничі науки" },
    gender: { female: "Дівчина", male: "Хлопець" },
    escs: { low: "Нижче становище родини", mid: "Середнє становище родини", high: "Вище становище родини" }
  };

  // Назви параметрів у посиланні: ?subject=math&gender=female&escs=mid
  var PARAMS = ["subject", "gender", "escs"];

  // Запасні цифри «усі учні України» та «середнє ОЕСР» (частка, що досягає рівня 2).
  // Взято з «Бриф для ШІ». Використовуються, лише якщо getResult() не передав свої.
  var BENCHMARKS = {
    read: { ukraine: 54.6, oecd: 69.0 },
    math: { ukraine: 54.0, oecd: 65.1 },
    scie: { ukraine: 65.2, oecd: 74.3 }
  };

  // ===== 2. ВИГЛЯД КАРТИНКИ =====
  var CARD = {
    width: 1080,
    height: 1320, // пропорція ≈ 1:1,2: Telegram показує такі картинки в чаті без обрізання
    font: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bg: "#EEF2F7",
    panel: "#FFFFFF",
    ink: "#142033",
    muted: "#5B6B80",
    track: "#DDE4EE",
    colors: { group: "#0E8A7D", ukraine: "#34508C", oecd: "#9AA7B8" }
  };

  // Текст, який іде разом із посиланням (його можна змінити в init: shareText)
  var DEFAULT_SHARE_TEXT =
    "Чи залежить освіта від того, хто ти? Є калькулятор на даних PISA 2025, який показує це в цифрах. " +
    "Ось подивись на мої результати, а які вийдуть у тебе?";

  // Додаткові параметри пропускаємо лише з літер, цифр, «-» та «_» (захист від чужого сміття в адресі)
  var SAFE_VALUE = /^[A-Za-z0-9_-]{1,40}$/;

  var config = {};
  var statusTimer = null;

  // Повне повідомлення: текст, а з нового рядка активне посилання
  function shareMessage(link) {
    return (config.shareText || DEFAULT_SHARE_TEXT) + "\n" + link;
  }

  // Формат цифри: за замовчуванням ціле число. Щоб збігалося з сайтом, у init можна
  // передати decimals: 1, тоді буде «54,6».
  function fmt(v) {
    var d = typeof config.decimals === "number" ? config.decimals : 0;
    return Number(v).toFixed(d).replace(".", ",");
  }

  // ===== 3. ПОСИЛАННЯ =====

  // Збирає посилання з вибраних параметрів. Адресу сайту беремо з браузера,
  // тому вписувати її вручну не треба: працюватиме і на GitHub Pages.
  function buildLink(state) {
    var url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    PARAMS.forEach(function (key) {
      url.searchParams.set(key, state[key]);
    });
    // Додаткові параметри сайту (наприклад, track=general), якщо вони є в результаті
    var extra = state.extra || {};
    Object.keys(extra).forEach(function (key) {
      if (SAFE_VALUE.test(key) && SAFE_VALUE.test(String(extra[key]))) {
        url.searchParams.set(key, String(extra[key]));
      }
    });
    return url.toString();
  }

  // Читає параметри з адреси. Повертає об'єкт лише якщо всі три значення правильні.
  // Усе, чого немає в списку ALLOWED, ігноруємо (захист від чужого сміття в адресі).
  function readStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var state = {};
    for (var i = 0; i < PARAMS.length; i++) {
      var key = PARAMS[i];
      var value = params.get(key);
      if (!value || !Object.prototype.hasOwnProperty.call(ALLOWED[key], value)) {
        return null;
      }
      state[key] = value;
    }
    return state;
  }

  // Додаткові параметри, які сайт попросив читати (init: extraParams: ["track"]).
  // Повертаються окремо, щоб не змінювати основний об'єкт з трьома ознаками.
  function readExtraFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var extra = {};
    (config.extraParams || []).forEach(function (key) {
      var v = params.get(key);
      if (v && SAFE_VALUE.test(v)) extra[key] = v;
    });
    return extra;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Запасний спосіб для старих браузерів і для відкриття файлу з диска
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  function onLinkClick() {
    var result = getResultOrWarn();
    if (!result) return;
    var link = buildLink(result);
    // За замовчуванням копіюємо текст разом із посиланням, щоб воно не було «голим».
    // Якщо потрібне лише посилання, у init передайте copyWithText: false.
    var toCopy = config.copyWithText === false ? link : shareMessage(link);
    copyText(toCopy).then(
      function () {
        setStatus("Скопійовано. Вставте в чат: це текст із посиланням.");
      },
      function () {
        // Якщо браузер не дав копіювати, показуємо текст, щоб його можна було взяти вручну
        window.prompt("Скопіюйте текст із посиланням:", toCopy);
      }
    );
  }

  // ===== 4. КАРТИНКА =====

  // Розбиває текст на рядки, щоб він вміщався в задану ширину
  function wrapText(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
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

  // Ділить текст на речення (кінець речення: . ! ? …)
  function splitSentences(text) {
    var parts = String(text).replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g);
    return parts ? parts.map(function (p) { return p.trim(); }) : [];
  }

  // Підбирає розмір шрифту, щоб увесь текст вмістився в задану висоту.
  // Якщо навіть найменший розмір не вміщається, прибирає речення з кінця (ціле речення, не півслова).
  function fitText(ctx, text, maxWidth, maxHeight) {
    var sizes = [30, 28, 26];
    var i, size, step, lines;
    for (i = 0; i < sizes.length; i++) {
      size = sizes[i];
      step = Math.round(size * 1.4);
      ctx.font = "400 " + size + "px " + CARD.font;
      lines = wrapText(ctx, text, maxWidth);
      if (lines.length * step <= maxHeight) return { size: size, step: step, lines: lines };
    }
    size = 26;
    step = Math.round(size * 1.4);
    ctx.font = "400 " + size + "px " + CARD.font;
    var sentences = splitSentences(text);
    while (sentences.length > 1) {
      sentences.pop();
      lines = wrapText(ctx, sentences.join(" "), maxWidth);
      if (lines.length * step <= maxHeight) return { size: size, step: step, lines: lines };
    }
    // Одне довге речення: у крайньому разі скорочуємо за словами з «…»
    lines = wrapText(ctx, sentences[0] || "", maxWidth);
    var maxLines = Math.max(1, Math.floor(maxHeight / step));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1].replace(/[\s.,;:]*$/, "");
      while (last.indexOf(" ") !== -1 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, last.lastIndexOf(" ")).replace(/[\s.,;:]*$/, "");
      }
      lines[maxLines - 1] = last + "…";
    }
    return { size: size, step: step, lines: lines };
  }

  function drawCard(result) {
    var W = CARD.width;
    var H = CARD.height;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";

    // Фон і біла картка
    ctx.fillStyle = CARD.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = CARD.panel;
    roundRect(ctx, 36, 36, W - 72, H - 72, 44);
    ctx.fill();

    var x = 96;
    var contentW = W - 2 * x;
    var y = 118;

    // Підпис джерела
    ctx.fillStyle = CARD.muted;
    ctx.font = "500 28px " + CARD.font;
    ctx.fillText("PISA 2025 · 15-річні в Україні", x, y);

    // Заголовок
    y += 72;
    ctx.fillStyle = CARD.ink;
    // Заголовок: найбільший розмір, при якому він іде в один рядок (без «ти?» окремим рядком)
    var title = "Чи залежить освіта від того, хто ти?";
    var titleSizes = [54, 50, 46, 42];
    var titleSize = 42;
    for (var t = 0; t < titleSizes.length; t++) {
      ctx.font = "700 " + titleSizes[t] + "px " + CARD.font;
      if (ctx.measureText(title).width <= contentW) {
        titleSize = titleSizes[t];
        break;
      }
    }
    ctx.font = "700 " + titleSize + "px " + CARD.font;
    wrapText(ctx, title, contentW).forEach(function (line) {
      ctx.fillText(line, x, y);
      y += Math.round(titleSize * 1.2);
    });

    // Вибрані ознаки: «таблетки». Додаткові ознаки сайту (наприклад, клас) йдуть через result.extraChips
    y += 6;
    var chips = [ALLOWED.subject[result.subject], ALLOWED.gender[result.gender], ALLOWED.escs[result.escs]];
    (result.extraChips || []).forEach(function (c) { chips.push(String(c)); });
    ctx.font = "600 28px " + CARD.font;
    var cx = x;
    var cy = y;
    chips.forEach(function (label) {
      var w = Math.min(contentW, ctx.measureText(label).width + 44);
      if (cx + w > x + contentW) {
        cx = x;
        cy += 70;
      }
      ctx.fillStyle = "#E3ECF7";
      roundRect(ctx, cx, cy, w, 56, 28);
      ctx.fill();
      ctx.fillStyle = CARD.ink;
      ctx.fillText(label, cx + 22, cy + 38);
      cx += w + 14;
    });
    y = cy + 56 + 30;

    // Велика цифра. Якщо вистачає місця, підпис стоїть справа від неї (економить висоту)
    var numText = fmt(result.percent) + "%";
    ctx.font = "800 200px " + CARD.font;
    var numW = ctx.measureText(numText).width;
    var colX = x + numW + 36;
    var colW = x + contentW - colX;
    var side = colW >= 300;
    var top = y;
    ctx.fillStyle = CARD.colors.group;
    ctx.fillText(numText, x - 6, top + 150);

    var capX = side ? colX : x;
    var capW = side ? colW : contentW;
    var capY = side ? top + 40 : top + 150 + 52;
    ctx.fillStyle = CARD.ink;
    ctx.font = "600 30px " + CARD.font;
    wrapText(ctx, "учнів із такими ознаками досягають базового рівня", capW).forEach(function (line) {
      ctx.fillText(line, capX, capY);
      capY += 40;
    });
    if (result.low != null && result.high != null) {
      ctx.fillStyle = CARD.muted;
      ctx.font = "500 28px " + CARD.font;
      ctx.fillText("95% діапазон: " + fmt(result.low) + "–" + fmt(result.high) + "%", capX, capY + 6);
      capY += 44;
    }
    y = Math.max(top + 150 + 20, capY) + 50;

    // Шкала порівняння
    var bench = BENCHMARKS[result.subject] || {};
    var ukraineValue = typeof result.ukraine === "number" ? result.ukraine : bench.ukraine;
    var oecdValue = typeof result.oecd === "number" ? result.oecd : bench.oecd;
    var rows = [
      { label: "Твоя група", value: result.percent, color: CARD.colors.group },
      { label: "Усі учні України", value: ukraineValue, color: CARD.colors.ukraine },
      { label: "Середнє по країнах ОЕСР", value: oecdValue, color: CARD.colors.oecd }
    ].filter(function (r) {
      return typeof r.value === "number" && isFinite(r.value);
    });
    rows.forEach(function (row) {
      ctx.fillStyle = CARD.ink;
      ctx.font = "500 28px " + CARD.font;
      ctx.fillText(row.label, x, y);
      ctx.font = "700 28px " + CARD.font;
      ctx.textAlign = "right";
      ctx.fillText(fmt(row.value) + "%", x + contentW, y);
      ctx.textAlign = "left";
      var barY = y + 14;
      ctx.fillStyle = CARD.track;
      roundRect(ctx, x, barY, contentW, 22, 11);
      ctx.fill();
      var fillW = Math.max(22, (contentW * Math.min(100, Math.max(0, row.value))) / 100);
      ctx.fillStyle = row.color;
      roundRect(ctx, x, barY, fillW, 22, 11);
      ctx.fill();
      y += 78;
    });

    // Що це означає: текст підбирається під вільне місце
    y += 20;
    ctx.fillStyle = CARD.ink;
    ctx.font = "700 36px " + CARD.font;
    ctx.fillText("Що це означає", x, y);
    y += 14;
    var bottomLimit = H - 126; // нижче цієї лінії текст не йде (там застереження)
    var fit = fitText(ctx, result.meaning || "", contentW, bottomLimit - y - 8);
    ctx.fillStyle = CARD.muted;
    ctx.font = "400 " + fit.size + "px " + CARD.font;
    fit.lines.forEach(function (line) {
      y += fit.step;
      ctx.fillText(line, x, y);
    });

    // Низ картинки: застереження (адреси сайту на картинці немає, посилання йде в тексті повідомлення)
    ctx.fillStyle = CARD.muted;
    ctx.font = "400 24px " + CARD.font;
    ctx.fillText("Це середнє для групи учнів, а не прогноз для конкретної людини.", x, H - 78);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error("Не вдалося створити картинку"));
      }, "image/png");
    });
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  // Запасний варіант (комп'ютер або браузер без меню «Поділитися»):
  // завантажуємо картинку і копіюємо текст із посиланням, щоб вставити їх разом
  function saveAndCopy(blob, fileName, result) {
    downloadBlob(blob, fileName);
    copyText(shareMessage(buildLink(result))).then(
      function () {
        setStatus("Картинку завантажено, а текст із посиланням скопійовано. Надішліть їх разом в одному повідомленні.");
      },
      function () {
        setStatus("Картинку завантажено. Посилання скопіюйте кнопкою «Скопіювати посилання».");
      }
    );
  }

  function onImageClick() {
    var result = getResultOrWarn();
    if (!result) return;
    var fileName = "pisa-result.png";
    setStatus("Створюю картинку…");

    canvasToBlob(drawCard(result))
      .then(function (blob) {
        var file;
        try {
          file = new File([blob], fileName, { type: "image/png" });
        } catch (e) {
          file = null;
        }
        // Меню «Поділитися» з картинкою є на більшості телефонів
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator
            // Текст і посилання йдуть одним рядком тексту: у Telegram це підпис до картинки з активним посиланням
            .share({ files: [file], title: "Калькулятор PISA: Україна", text: shareMessage(buildLink(result)) })
            .then(function () {
              setStatus("Готово.");
            })
            .catch(function (err) {
              // Людина сама закрила меню: це не помилка
              if (err && err.name === "AbortError") {
                setStatus("");
              } else {
                saveAndCopy(blob, fileName, result);
              }
            });
        }
        saveAndCopy(blob, fileName, result);
      })
      .catch(function () {
        setStatus("Не вдалося створити картинку. Спробуйте ще раз.", true);
      });
  }

  // ===== 5. ДОПОМІЖНЕ =====

  function getResultOrWarn() {
    var result = typeof config.getResult === "function" ? config.getResult() : null;
    if (!result) {
      setStatus("Спочатку оберіть параметри й натисніть «Показати».", true);
      return null;
    }
    // Якщо в таблиці для цієї комбінації замало учнів (enough_data = false), цифрою ділитися не можна
    if (result.enoughData === false) {
      setStatus("Для цієї комбінації замало даних, щоб поділитися цифрою.", true);
      return null;
    }
    for (var i = 0; i < PARAMS.length; i++) {
      var key = PARAMS[i];
      if (!Object.prototype.hasOwnProperty.call(ALLOWED[key], result[key])) {
        setStatus("Помилка: значення «" + key + "» не збігається зі списком у share.js.", true);
        return null;
      }
    }
    return result;
  }

  function setStatus(text, isError) {
    var el = config.statusEl ? document.querySelector(config.statusEl) : null;
    if (!el) return;
    el.textContent = text;
    el.setAttribute("data-error", isError ? "true" : "false");
    clearTimeout(statusTimer);
    if (text) {
      statusTimer = setTimeout(function () {
        el.textContent = "";
      }, 5000);
    }
  }

  // ===== 6. ЗАПУСК =====
  function init(options) {
    config = options || {};
    var linkBtn = document.querySelector(config.linkButton || "#btn-link");
    var imageBtn = document.querySelector(config.imageButton || "#btn-image");
    if (linkBtn) linkBtn.addEventListener("click", onLinkClick);
    if (imageBtn) imageBtn.addEventListener("click", onImageClick);

    // Якщо сторінку відкрили за чиїмось посиланням, одразу показуємо той самий результат
    var state = readStateFromUrl();
    if (state && typeof config.onLoadFromLink === "function") {
      config.onLoadFromLink(state, readExtraFromUrl());
    }
  }

  window.PisaShare = {
    init: init,
    // Нижче: те, що потрібно для тестів
    _buildLink: buildLink,
    _readStateFromUrl: readStateFromUrl,
    _readExtraFromUrl: readExtraFromUrl,
    _drawCard: drawCard
  };
})();
