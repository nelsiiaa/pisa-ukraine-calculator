/*
 * share.js: дві кнопки «Поділитися» для калькулятора PISA: Україна
 *
 *   Кнопка 1: копіює посилання, яке відкриває сайт одразу з готовим результатом.
 *   Кнопка 2: створює вертикальну картинку 1080x1920 (формат сторіс) з результатом
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
    height: 1920,
    font: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bg: "#EEF2F7",
    panel: "#FFFFFF",
    ink: "#142033",
    muted: "#5B6B80",
    track: "#DDE4EE",
    colors: { group: "#0E8A7D", ukraine: "#34508C", oecd: "#9AA7B8" },
    maxMeaningLines: 7
  };

  var config = {};
  var statusTimer = null;

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
    copyText(link).then(
      function () {
        setStatus("Посилання скопійовано. Надішліть його друзям.");
      },
      function () {
        // Якщо браузер не дав копіювати, показуємо посилання, щоб його можна було взяти вручну
        window.prompt("Скопіюйте посилання:", link);
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

  function siteLabel() {
    if (config.siteLabel) return config.siteLabel;
    if (window.location.protocol === "file:") return "(адреса сайту з'явиться після публікації)";
    return window.location.host + window.location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
  }

  function drawCard(result) {
    var W = CARD.width;
    var H = CARD.height;
    var PAD = 80;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";

    // Фон і біла картка
    ctx.fillStyle = CARD.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = CARD.panel;
    roundRect(ctx, 48, 48, W - 96, H - 96, 48);
    ctx.fill();

    var x = PAD + 20;
    var contentW = W - 2 * x;
    var y = 170;

    // Підпис джерела
    ctx.fillStyle = CARD.muted;
    ctx.font = "500 34px " + CARD.font;
    ctx.fillText("PISA 2025 · 15-річні в Україні", x, y);

    // Заголовок
    y += 100;
    ctx.fillStyle = CARD.ink;
    ctx.font = "700 68px " + CARD.font;
    wrapText(ctx, "Чи залежить освіта від того, хто ти?", contentW).forEach(function (line) {
      ctx.fillText(line, x, y);
      y += 82;
    });

    // Вибрані ознаки: три «таблетки»
    y += 10;
    var chips = [ALLOWED.subject[result.subject], ALLOWED.gender[result.gender], ALLOWED.escs[result.escs]];
    ctx.font = "600 34px " + CARD.font;
    var cx = x;
    var cy = y;
    chips.forEach(function (label) {
      var w = ctx.measureText(label).width + 56;
      if (cx + w > x + contentW) {
        cx = x;
        cy += 82;
      }
      ctx.fillStyle = "#E3ECF7";
      roundRect(ctx, cx, cy, w, 64, 32);
      ctx.fill();
      ctx.fillStyle = CARD.ink;
      ctx.fillText(label, cx + 28, cy + 44);
      cx += w + 16;
    });
    y = cy + 64;

    // Велика цифра
    y += 270;
    ctx.fillStyle = CARD.colors.group;
    ctx.font = "800 300px " + CARD.font;
    ctx.fillText(fmt(result.percent) + "%", x - 6, y);

    y += 92;
    ctx.fillStyle = CARD.ink;
    ctx.font = "600 42px " + CARD.font;
    wrapText(ctx, "учнів із такими ознаками досягають базового рівня", contentW).forEach(function (line) {
      ctx.fillText(line, x, y);
      y += 54;
    });
    if (result.low != null && result.high != null) {
      ctx.fillStyle = CARD.muted;
      ctx.font = "500 36px " + CARD.font;
      ctx.fillText("95% діапазон: " + fmt(result.low) + "–" + fmt(result.high) + "%", x, y + 6);
      y += 60;
    }

    // Шкала порівняння
    y += 50;
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
      ctx.font = "500 32px " + CARD.font;
      ctx.fillText(row.label, x, y);
      var valueText = fmt(row.value) + "%";
      ctx.font = "700 32px " + CARD.font;
      ctx.textAlign = "right";
      ctx.fillText(valueText, x + contentW, y);
      ctx.textAlign = "left";
      var barY = y + 18;
      ctx.fillStyle = CARD.track;
      roundRect(ctx, x, barY, contentW, 26, 13);
      ctx.fill();
      var fillW = Math.max(26, (contentW * Math.min(100, Math.max(0, row.value))) / 100);
      ctx.fillStyle = row.color;
      roundRect(ctx, x, barY, fillW, 26, 13);
      ctx.fill();
      y += 100;
    });

    // Що це означає
    y += 20;
    ctx.fillStyle = CARD.ink;
    ctx.font = "700 40px " + CARD.font;
    ctx.fillText("Що це означає", x, y);
    y += 20;
    ctx.fillStyle = CARD.muted;
    ctx.font = "400 34px " + CARD.font;
    var lines = wrapText(ctx, result.meaning || "", contentW);
    // Скільки рядків реально вміщається над нижнім підписом (кожен рядок займає 48 px)
    var spaceLeft = H - 235 - y;
    var maxLines = Math.min(CARD.maxMeaningLines, Math.max(2, Math.floor(spaceLeft / 48)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[lines.length - 1].replace(/[\s.,;:]*$/, "");
      // Скорочуємо останній рядок за словами, поки він із «…» не вміститься в ширину
      while (last.indexOf(" ") !== -1 && ctx.measureText(last + "…").width > contentW) {
        last = last.slice(0, last.lastIndexOf(" ")).replace(/[\s.,;:]*$/, "");
      }
      lines[lines.length - 1] = last + "…";
    }
    lines.forEach(function (line) {
      y += 48;
      ctx.fillText(line, x, y);
    });

    // Низ картинки: застереження й адреса сайту
    ctx.fillStyle = CARD.muted;
    ctx.font = "400 28px " + CARD.font;
    ctx.fillText("Це середнє для групи учнів, а не прогноз для конкретної людини.", x, H - 190);
    ctx.fillStyle = CARD.ink;
    ctx.font = "700 36px " + CARD.font;
    ctx.fillText(siteLabel(), x, H - 130);

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
            .share({ files: [file], title: "Калькулятор PISA: Україна", text: buildLink(result) })
            .then(function () {
              setStatus("Готово.");
            })
            .catch(function (err) {
              // Людина сама закрила меню: це не помилка
              if (err && err.name === "AbortError") {
                setStatus("");
              } else {
                downloadBlob(blob, fileName);
                setStatus("Картинку завантажено у файли.");
              }
            });
        }
        downloadBlob(blob, fileName);
        setStatus("Картинку завантажено.");
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
      config.onLoadFromLink(state);
    }
  }

  window.PisaShare = {
    init: init,
    // Нижче: те, що потрібно для тестів
    _buildLink: buildLink,
    _readStateFromUrl: readStateFromUrl,
    _drawCard: drawCard
  };
})();
