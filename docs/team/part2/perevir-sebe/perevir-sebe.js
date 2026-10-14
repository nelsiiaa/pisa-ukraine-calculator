/* «Перевір себе» — частина 2 калькулятора PISA: Україна.
 * Без бібліотек. Підключення:
 *   <div id="perevir-sebe"></div>
 *   <script src="perevir-sebe.js"></script>
 *   PerevirSebe.start({ mount: "#perevir-sebe", onDone: () => { ...показати форму калькулятора... } });
 * Після результату калькулятора:
 *   PerevirSebe.showLink({ mount: "#perevir-link", subject: "math", gender: "female", escs: "low", rows });
 *   rows — рядки з data/pisa_ukraine_calculator.csv (поля subject, gender, escs, pct_level2, enough_data).
 */
(function () {
  // Частка учнів України, які НЕ досягають рівня 2 (з брифу; перераховано з мікроданих PISA 2025 — збігається).
  // scie: межу рівня 2 для природничих наук ще треба перевірити в технічному звіті PISA 2025.
  var BELOW_L2 = { read: "45,4", math: "46,0", scie: "34,8" };

  var SUBJ_NAME = { read: "читання", math: "математика", scie: "природничі науки" };
  var SUBJ_GEN = { read: "з читання", math: "з математики", scie: "з природничих наук" };
  var GENDER_NAME = { female: "дівчат", male: "хлопців", all: "усіх учнів" };
  var ESCS_NAME = { low: "з родин нижчого достатку", mid: "з родин середнього достатку", high: "з родин вищого достатку", all: "" };

  // Тексти завдань. Позначка TODO = текст треба взяти/звірити з оригіналом ОЕСР (див. ПРОМПТ, розділ «Джерела»).
  var ITEMS = [
    {
      subject: "read",
      source: "PISA 2009, «The Play's the Thing» (у посібнику ERC — питання P2). Складність 474 бали, рівень 2.",
      stimulusHtml: "<p class='ps-todo'>TODO: уривок п'єси (рядки 1–29 з оригіналу ОЕСР), переклад звірити з оригіналом.</p>",
      question: "«Це вічність, іноді навіть чверть години» (рядки 28–29). Чому, на думку Тураї, чверть години — це вічність?",
      options: [
        "Це довго, щоб чекати від глядачів, що вони сидітимуть спокійно в переповненому театрі.",
        "Здається, що з'ясування ситуації на початку п'єси триває вічно.",
        "Здається, що драматург завжди довго пише початок п'єси.",
        "Здається, що час плине повільно, коли в п'єсі відбувається важлива подія."
      ],
      correct: 1,
      explanation: "Тураї говорить про початок п'єси: глядачам треба пояснити, хто ці персонажі і що відбувається, і на це йде багато часу. Відповідь треба знайти в тексті й пов'язати з контекстом репліки."
    },
    {
      subject: "math",
      source: "PISA 2012, «Charts», питання 5 (PM918Q05). Складність 428 балів, рівень 2.",
      stimulusHtml: "<p>У січні вийшли нові диски гуртів 4U2Rock і The Kicking Kangaroos. У лютому вийшли диски гуртів No One's Darling і The Metalfolkies. Діаграма показує продажі дисків цих гуртів із січня до червня.</p><p class='ps-todo'>TODO: вставити діаграму «Sales of CDs per month» з оригіналу ОЕСР (img/charts.png).</p>",
      question: "Менеджер гурту The Kicking Kangaroos хвилюється, бо продажі їхніх дисків зменшувалися з лютого до червня. Скільки дисків вони приблизно продадуть у липні, якщо спад триватиме так само?",
      options: ["70 дисків", "370 дисків", "670 дисків", "1340 дисків"],
      correct: 1,
      explanation: "Треба знайти на діаграмі стовпчики гурту з лютого до червня, побачити, що щомісяця продажі падають приблизно на однакову величину, і продовжити цей спад ще на один місяць."
    },
    {
      subject: "scie",
      source: "PISA 2006, «Acid Rain», питання 3. Складність 460 балів, рівень 2 (шкала 2006 р.).",
      stimulusHtml: "<p>Вплив кислотного дощу на мармур можна змоделювати, поклавши шматочки мармуру на ніч в оцет. Коли шматочок мармуру кладуть в оцет, утворюються бульбашки газу. Масу сухого шматочка можна виміряти до і після досліду.</p><p class='ps-todo'>TODO: звірити переклад з оригіналом ОЕСР.</p>",
      question: "До того як шматочок мармуру поклали на ніч в оцет, його маса була 2,0 г. Наступного дня його вийняли і висушили. Якою буде маса висушеного шматочка?",
      options: ["Менше ніж 2,0 г", "Рівно 2,0 г", "Від 2,0 до 2,4 г", "Більше ніж 2,4 г"],
      correct: 0,
      explanation: "Бульбашки газу означають, що частина мармуру вступила в реакцію з оцтом і пішла з розчину як газ. Тож шматочок, що залишився, легший за 2,0 г."
    }
  ];

  var DISCLAIMER = "Це демонстрація, а не вимірювання твого рівня: три завдання не можуть показати, якого рівня PISA досягає людина.";
  var LICENSE = "Завдання: © OECD, PISA. Ліцензія CC BY-NC-SA 3.0 IGO. Переклад не є офіційним перекладом ОЕСР; у разі розбіжностей чинним є оригінал.";

  var state = { i: 0, score: 0 };

  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d; }
  function $(sel) { return typeof sel === "string" ? document.querySelector(sel) : sel; }

  function renderItem(root, onDone) {
    var it = ITEMS[state.i];
    var opts = it.options.map(function (o, k) {
      return "<button type='button' class='ps-opt' data-k='" + k + "'>" + String.fromCharCode(65 + k) + ". " + o + "</button>";
    }).join("");
    root.innerHTML =
      "<div class='ps-card'>" +
      "<p class='ps-step'>Завдання " + (state.i + 1) + " з " + ITEMS.length + " · " + SUBJ_NAME[it.subject] + "</p>" +
      "<div class='ps-stim'>" + it.stimulusHtml + "</div>" +
      "<p class='ps-q'><strong>" + it.question + "</strong></p>" +
      "<div class='ps-opts'>" + opts + "</div>" +
      "<div class='ps-feedback' aria-live='polite'></div>" +
      "<p class='ps-src'>Джерело: " + it.source + "</p>" +
      "</div>";
    root.querySelectorAll(".ps-opt").forEach(function (b) {
      b.addEventListener("click", function () { answer(root, it, +b.dataset.k, onDone); });
    });
  }

  function answer(root, it, k, onDone) {
    var ok = k === it.correct;
    if (ok) state.score++;
    root.querySelectorAll(".ps-opt").forEach(function (b) {
      b.disabled = true;
      var j = +b.dataset.k;
      if (j === it.correct) b.classList.add("ps-right");
      else if (j === k) b.classList.add("ps-wrong");
    });
    var fb = root.querySelector(".ps-feedback");
    var last = state.i === ITEMS.length - 1;
    fb.innerHTML =
      "<p><strong>" + (ok ? "Правильно." : "Неправильно. Правильна відповідь: " + String.fromCharCode(65 + it.correct) + ".") + "</strong> " + it.explanation + "</p>" +
      "<p class='ps-stat'>Це завдання базового рівня (рівень 2). Цього рівня " + SUBJ_GEN[it.subject] +
      " не досягають <strong>" + BELOW_L2[it.subject] + "%</strong> українських 15-річних.</p>" +
      "<button type='button' class='ps-next'>" + (last ? "Підсумок" : "Наступне завдання") + "</button>";
    fb.querySelector(".ps-next").addEventListener("click", function () {
      state.i++;
      if (state.i < ITEMS.length) renderItem(root, onDone); else renderSummary(root, onDone);
    });
  }

  function renderSummary(root, onDone) {
    var lead = state.score === ITEMS.length
      ? "Тобі це було легко. А майже половина однолітків не досягає цього рівня з читання і математики:"
      : "Ці завдання — базового рівня. А майже половина однолітків не досягає цього рівня з читання і математики:";
    root.innerHTML =
      "<div class='ps-card'>" +
      "<p class='ps-step'>Правильних відповідей: " + state.score + " з " + ITEMS.length + "</p>" +
      "<p class='ps-q'><strong>" + lead + "</strong></p>" +
      "<ul class='ps-list'>" +
      "<li>читання — " + BELOW_L2.read + "% українських 15-річних;</li>" +
      "<li>математика — " + BELOW_L2.math + "%;</li>" +
      "<li>природничі науки — " + BELOW_L2.scie + "% (приблизно третина).</li>" +
      "</ul>" +
      "<p>Від чого це залежить? Подивися, як результат змінюється зі статтю і достатком родини.</p>" +
      "<button type='button' class='ps-next'>Перейти до калькулятора</button>" +
      "<p class='ps-note'>" + DISCLAIMER + "</p>" +
      "<p class='ps-src'>" + LICENSE + "</p>" +
      "</div>";
    root.querySelector(".ps-next").addEventListener("click", function () { if (onDone) onDone(); });
  }

  function find(rows, s, g, e) {
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.subject === s && r.gender === g && r.escs === e) return r;
    }
    return null;
  }
  function pctText(r) {
    if (!r) return "замало даних";
    if (r.enough_data !== undefined && String(r.enough_data).toLowerCase() !== "true" && String(r.enough_data) !== "1") return "замало даних";
    return String(r.pct_level2).replace(".", ",") + "%";
  }
  function groupName(g, e) { return (GENDER_NAME[g] + " " + ESCS_NAME[e]).trim(); }

  // Речення в кінці калькулятора. «Інша група» = протилежна стать, той самий достаток (рішення команди — підтвердити).
  function linkSentence(o) {
    var mine = find(o.rows, o.subject, o.gender, o.escs);
    var otherG = o.gender === "female" ? "male" : "female";
    var other = find(o.rows, o.subject, otherG, o.escs);
    return "Пам'ятаєш завдання " + SUBJ_GEN[o.subject] + " на початку? Рівня такого завдання досягають " +
      pctText(mine) + " " + groupName(o.gender, o.escs) + " і " + pctText(other) + " " + groupName(otherG, o.escs) + ".";
  }

  window.PerevirSebe = {
    items: ITEMS,
    start: function (opts) {
      state = { i: 0, score: 0 };
      var root = $(opts.mount);
      root.prepend(el("<p class='ps-note'>" + DISCLAIMER + "</p>"));
      var box = document.createElement("div");
      root.appendChild(box);
      renderItem(box, opts.onDone);
    },
    showLink: function (opts) {
      var root = $(opts.mount);
      root.innerHTML = "<p class='ps-link'>" + linkSentence(opts) + "</p>";
    },
    linkSentence: linkSentence,
    parseCsv: function (text) {
      var lines = text.trim().split(/\r?\n/), head = lines.shift().split(",");
      return lines.map(function (l) {
        var v = l.split(","), o = {};
        head.forEach(function (h, i) { o[h.trim()] = (v[i] || "").trim(); });
        return o;
      });
    }
  };
})();
