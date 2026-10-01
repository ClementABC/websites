/* Quiz Danse — site statique (Vercel).
   Élève : chapitres → prénom → une question par écran → Merci !
   Prof : code → résultats + réglages (config dans l'onglet Config de la Sheet).

   RÈGLE DE MATHIEU : l'élève ne voit JAMAIS les réponses.
   Ni score, ni correction, ni explications — juste « Merci ! ».
   Les réponses et les explications n'existent que dans l'espace prof. */

(function () {
  "use strict";

  /* ---------------- utilitaires ---------------- */
  var app = document.getElementById("app");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function plural(n, one, many) {
    return n > 1 ? many : one;
  }

  function fmtDateTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return ""; }
  }

  function pct(score, max) {
    if (!max || max <= 0) return null;
    return Math.round((100 * score) / max);
  }

  var LETTERS = ["A", "B", "C", "D"];
  var GRADED = ["qcm", "vrai_faux", "classement"];

  var TYPE_INFO = {
    qcm: { label: "QCM", hint: "Choisis la bonne réponse." },
    vrai_faux: { label: "Vrai / Faux", hint: "Vrai ou faux ?" },
    curseur: { label: "Échelle", hint: "Déplace le curseur selon ton ressenti." },
    classement: { label: "Classement", hint: "Touche les cartes dans le bon ordre." },
    texte: { label: "Réponse libre", hint: "Écris ta réponse en quelques mots." }
  };

  /* ---------------- configuration ---------------- */
  var CFG = (window.QUIZ_CONFIG || {});
  var BACKEND_URL = String(CFG.backend_url || "").trim();
  var SHEET_URL = String(CFG.sheet_url || "").trim();
  var CONFIGURED = BACKEND_URL.length > 0 && BACKEND_URL.indexOf("COLLE_TON_URL_ICI") < 0;

  /* ---------------- client backend ----------------
     JSONP via balise <script> : Apps Script ne renvoie pas d'en-têtes
     CORS, donc fetch() cross-origin ne peut pas lire la réponse (les
     redirections 302 deviennent opaques). Les balises <script> suivent
     les 302 vers script.googleusercontent.com sans CORS. */
  function callBackend(action, args, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!CONFIGURED) { reject(new Error("not_configured")); return; }
      var done = false;
      var cbName = "quizCb" + Date.now().toString(36) +
        Math.floor(Math.random() * 1296).toString(36);
      var script = document.createElement("script");
      var timer = setTimeout(function () {
        if (!done) { done = true; cleanup(); reject(new Error("timeout")); }
      }, timeoutMs || 45000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = function (data) {
        if (done) return;
        done = true; cleanup();
        if (data && data.error && !data.ok) { reject(new Error(data.error)); return; }
        resolve(data);
      };

      script.onerror = function () {
        if (!done) { done = true; cleanup(); reject(new Error("network")); }
      };

      var url = BACKEND_URL +
        (BACKEND_URL.indexOf("?") >= 0 ? "&" : "?") +
        "action=" + encodeURIComponent(action) +
        "&args=" + encodeURIComponent(JSON.stringify(args || {})) +
        "&callback=" + encodeURIComponent(cbName);
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function backendErrorMessage(err) {
    if (!err) return "Le backend ne répond pas.";
    if (err.message === "not_configured") return "not_configured";
    if (err.message === "timeout") return "Le serveur met trop longtemps à répondre. Réessaie.";
    return "Impossible de joindre le serveur. Vérifie ta connexion.";
  }

  /* ---------------- état global ---------------- */
  var teacherCode = ""; // en mémoire uniquement, jamais persisté
  var configCache = null; // { chapters_open, chapter_titles }

  function getConfig(force) {
    if (configCache && !force) return Promise.resolve(configCache);
    return callBackend("get_config", {}).then(function (res) {
      configCache = {
        chapters_open: Array.isArray(res.chapters_open) ? res.chapters_open : [1],
        chapter_titles: res.chapter_titles || {}
      };
      return configCache;
    });
  }

  function chapters() {
    var cfg = configCache || { chapters_open: [1], chapter_titles: {} };
    var list = [];
    for (var n = 1; n <= 7; n++) {
      list.push({
        numero: n,
        title: cfg.chapter_titles[String(n)] || ("Chapitre " + n),
        open: cfg.chapters_open.indexOf(n) >= 0
      });
    }
    return list;
  }

  function chapterByNumero(n) {
    var all = chapters();
    for (var i = 0; i < all.length; i++) if (all[i].numero === n) return all[i];
    return null;
  }

  function scrollTop() { window.scrollTo(0, 0); }

  /* ---------------- petits composants ---------------- */
  function spinner(label) {
    app.innerHTML =
      '<div class="loading" role="status">' +
      '<div class="spinner" aria-hidden="true"></div>' +
      "<p class='lead'>" + esc(label) + "</p></div>";
    scrollTop();
  }

  function notice(variant, title, bodyHtml) {
    return (
      '<div class="notice ' + variant + '" role="alert">' +
      "<h2>" + esc(title) + "</h2>" + bodyHtml + "</div>"
    );
  }

  function setNav(current) {
    var links = document.querySelectorAll(".navlink");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-nav") === current) {
        links[i].setAttribute("aria-current", "page");
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
  }

  /* ---------------- QUIZ : sélecteur de chapitres ---------------- */
  var quiz = { chapter: null, questions: [], name: "", index: 0, answers: {}, rankOrder: [], rankItems: [], shuffles: {} };

  function viewQuizHome() {
    setNav("quiz");
    if (!CONFIGURED) {
      app.innerHTML =
        '<div class="section">' +
        '<div style="text-align:center;margin-bottom:1rem"><span class="brand-dot" style="width:3.5rem;height:3.5rem;font-size:1.6rem" aria-hidden="true">♪</span></div>' +
        notice("info", "Le quiz n'est pas encore branché",
          "<p>La Google Sheet des questions n'est pas encore reliée à ce site.</p>") +
        "<p class='lead'>Si tu es prof : ouvre l'espace prof pour brancher la Sheet.</p>" +
        '<p><a class="btn btn-secondary" href="#/prof">Ouvrir l\'espace prof</a></p>' +
        "</div>";
      scrollTop();
      return;
    }
    spinner("Le quiz se prépare…");
    getConfig(true).then(function () {
      var list = chapters();
      var html =
        '<div class="section">' +
        "<h1>Choisis ton chapitre</h1>" +
        "<p class='lead'>Un chapitre, un quiz. Les chapitres fermés s'ouvriront après le cours en classe.</p>" +
        '<div class="chapter-list" role="list" aria-label="Les 7 chapitres">';
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        html += '<div role="listitem">';
        if (c.open) {
          html +=
            '<button class="chapter-btn" data-chapter="' + c.numero + '" aria-label="Faire le quiz : ' + esc(c.title) + '">' +
            '<span class="chapter-num" aria-hidden="true">' + c.numero + "</span>" +
            '<span><span class="chapter-title">' + esc(c.title) + "</span>" +
            '<span class="chapter-sub">Ouvert — touche pour faire le quiz</span></span>' +
            "</button>";
        } else {
          html +=
            '<button class="chapter-btn" disabled aria-label="' + esc(c.title) + ' : pas encore disponible">' +
            '<span class="chapter-num" aria-hidden="true">' + c.numero + "</span>" +
            '<span><span class="chapter-title">' + esc(c.title) + "</span>" +
            '<span class="chapter-sub">🔒 Pas encore disponible</span></span>' +
            "</button>";
        }
        html += "</div>";
      }
      html += "</div>" +
        '<p><button class="btn btn-secondary" id="refresh-chapters">Vérifier les chapitres ouverts</button></p>' +
        "</div>";
      app.innerHTML = html;
      scrollTop();
      var btns = app.querySelectorAll("[data-chapter]");
      for (var j = 0; j < btns.length; j++) {
        btns[j].addEventListener("click", function () {
          enterChapter(parseInt(this.getAttribute("data-chapter"), 10));
        });
      }
      document.getElementById("refresh-chapters").addEventListener("click", viewQuizHome);
    }).catch(function () {
      app.innerHTML = '<div class="section">' +
        notice("error", "Le quiz ne répond pas",
          "<p>Impossible de charger les chapitres. Vérifie ta connexion.</p>") +
        '<p><button class="btn btn-primary" id="retry">Revenir aux chapitres</button></p></div>';
      scrollTop();
      document.getElementById("retry").addEventListener("click", viewQuizHome);
    });
  }

  function enterChapter(numero) {
    var c = chapterByNumero(numero);
    if (!c || !c.open) {
      app.innerHTML = '<div class="section">' +
        notice("info", "Ce chapitre est fermé", "<p>Ce chapitre n'est pas encore disponible.</p>") +
        '<p><button class="btn btn-primary" id="back">Revenir aux chapitres</button></p></div>';
      scrollTop();
      document.getElementById("back").addEventListener("click", viewQuizHome);
      return;
    }
    quiz.chapter = c;
    quiz.questions = [];
    quiz.name = "";
    quiz.index = 0;
    quiz.answers = {};
    quiz.rankOrder = [];
    quiz.rankItems = [];
    quiz.shuffles = {};
    spinner("Le quiz se prépare…");
    callBackend("get_questions", { chapitre: numero }).then(function (res) {
      if (res.chapter_closed) {
        viewChapterClosed(c);
        return;
      }
      var qs = res.questions || [];
      if (qs.length === 0) { viewEmpty(c); return; }
      quiz.questions = qs;
      viewStart();
    }).catch(function (err) {
      var msg = backendErrorMessage(err);
      if (msg === "not_configured") { viewQuizHome(); return; }
      if (err && err.message === "Ce chapitre est fermé.") { viewChapterClosed(c); return; }
      app.innerHTML = '<div class="section">' +
        notice("error", "Le quiz ne répond pas", "<p>" + esc(msg) + "</p>") +
        '<p><button class="btn btn-primary" id="back">Revenir aux chapitres</button></p></div>';
      scrollTop();
      document.getElementById("back").addEventListener("click", viewQuizHome);
    });
  }

  function viewChapterClosed(c) {
    app.innerHTML = '<div class="section">' +
      notice("info", "Ce chapitre est fermé", "<p>" + esc(c ? c.title : "Le chapitre") + " n'est pas encore disponible.</p>") +
      '<p><button class="btn btn-primary" id="back">Revenir aux chapitres</button></p></div>';
    scrollTop();
    document.getElementById("back").addEventListener("click", viewQuizHome);
  }

  function viewEmpty(c) {
    app.innerHTML = '<div class="section">' +
      notice("info", "Encore un peu de patience",
        "<p>" + esc(c ? c.title : "Ce chapitre") + " n'a pas encore de questions. Mathieu les prépare !</p>") +
      '<p><button class="btn btn-primary" id="back">Choisir un autre chapitre</button></p>' +
      '<p><button class="btn btn-secondary" id="recheck">Vérifier à nouveau</button></p></div>';
    scrollTop();
    document.getElementById("back").addEventListener("click", viewQuizHome);
    document.getElementById("recheck").addEventListener("click", function () { enterChapter(c.numero); });
  }

  /* ---------------- QUIZ : écran de démarrage (prénom) ---------------- */
  function viewStart() {
    var c = quiz.chapter;
    var n = quiz.questions.length;
    app.innerHTML =
      '<div class="section">' +
      "<h1>" + esc(c.title) + "</h1>" +
      "<p class='lead'>" + n + " " + plural(n, "question", "questions") + " de plusieurs sortes : " +
      "QCM, vrai/faux, échelles, classements et réponses libres. Prends ton temps : il n'y a pas de limite.</p>" +
      '<div class="field">' +
      '<label for="student-name">Ton prénom</label>' +
      '<input id="student-name" class="textinput" type="text" maxlength="60" autocomplete="given-name" placeholder="Écris ton prénom…">' +
      '<p class="fielderr" id="name-error" role="alert" hidden></p>' +
      "</div>" +
      '<p><button class="btn btn-primary btn-block" id="start-quiz">Commencer le quiz</button></p>' +
      "<p class='muted'>Mathieu regardera tes réponses plus tard.</p>" +
      "</div>";
    scrollTop();
    var input = document.getElementById("student-name");
    input.focus();
    document.getElementById("start-quiz").addEventListener("click", function () {
      var v = input.value.trim();
      var err = document.getElementById("name-error");
      if (!v) {
        err.textContent = "Écris ton prénom pour commencer.";
        err.hidden = false;
        input.focus();
        return;
      }
      quiz.name = v;
      quiz.index = 0;
      viewQuestion();
    });
  }

  /* ---------------- QUIZ : une question par écran ---------------- */
  function sliderMid(q) {
    if (q.slider) return Math.round((q.slider.min + q.slider.max) / 2);
    return 5;
  }

  function reponseFor(q) {
    if (q.type === "curseur") {
      var v = quiz.answers[q.id];
      return v !== undefined ? String(v) : String(sliderMid(q));
    }
    if (q.type === "classement") {
      return quiz.rankOrder.length === q.choices.length ? quiz.rankOrder.join(",") : "";
    }
    var a = quiz.answers[q.id];
    return a !== undefined ? String(a) : "";
  }

  function canProceed(q) {
    var r = reponseFor(q).trim().toUpperCase();
    if (q.type === "qcm") return LETTERS.indexOf(r) >= 0;
    if (q.type === "vrai_faux") return r === "V" || r === "F";
    if (q.type === "curseur") return reponseFor(q).trim().length > 0;
    if (q.type === "texte") return reponseFor(q).trim().length > 0;
    if (q.type === "classement") return quiz.rankOrder.length === q.choices.length;
    return false;
  }

  function hintFor(q) {
    if (q.type === "classement") return "Classe toutes les cartes pour continuer.";
    if (q.type === "texte") return "Écris ta réponse pour continuer.";
    return "Choisis une réponse pour continuer.";
  }

  function ensureRankBoard(q) {
    var items = quiz.shuffles[q.id];
    if (!items) {
      items = q.choices.map(function (text, i) {
        return { letter: LETTERS[i] || "?", text: text };
      });
      // mélange stable par question
      for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
      }
      quiz.shuffles[q.id] = items;
    }
    quiz.rankItems = items;
    var saved = quiz.answers[q.id];
    quiz.rankOrder = saved ? String(saved).split(",").map(function (l) { return l.trim().toUpperCase(); }).filter(Boolean) : [];
  }

  function viewQuestion() {
    var q = quiz.questions[quiz.index];
    if (!q) { spinner("Question introuvable…"); return; }
    if (q.type === "classement") ensureRankBoard(q);
    var info = TYPE_INFO[q.type] || TYPE_INFO.qcm;
    var isLast = quiz.index === quiz.questions.length - 1;
    var ready = canProceed(q);
    var c = quiz.chapter;

    var html =
      '<div class="section">' +
      "<p class='muted' style='font-weight:700'>" + esc(c.title) + "</p>" +
      '<div class="progress" role="progressbar" aria-valuenow="' + (quiz.index + 1) + '" aria-valuemax="' + quiz.questions.length + '" aria-label="Progression">' +
      '<div class="progress-label">Question ' + (quiz.index + 1) + " sur " + quiz.questions.length + "</div>" +
      '<div class="progress-track"><div class="progress-fill" style="width:' + Math.round(100 * (quiz.index + 1) / quiz.questions.length) + '%"></div></div>' +
      "</div>" +
      '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:0.5rem">' +
      '<span class="type-tag">' + esc(info.label) + "</span>" +
      "<h2>" + esc(q.question) + "</h2>" +
      "<p class='lead'>" + esc(info.hint) + "</p>" +
      "</div>";

    /* ----- qcm ----- */
    if (q.type === "qcm") {
      html += '<div class="answers" role="radiogroup" aria-label="' + esc(q.question) + '">';
      for (var i = 0; i < q.choices.length; i++) {
        var letter = LETTERS[i] || "?";
        var sel = (quiz.answers[q.id] || "").toUpperCase() === letter;
        html +=
          '<button class="answer-btn" role="radio" aria-checked="' + sel + '" data-pick="' + letter + '">' +
          '<span class="answer-letter" aria-hidden="true">' + letter + "</span>" +
          '<span class="answer-text">' + esc(q.choices[i]) + "</span>" +
          (sel ? '<span class="answer-check" aria-hidden="true">✓</span>' : "") +
          "</button>";
      }
      html += "</div>";
    }

    /* ----- vrai_faux ----- */
    if (q.type === "vrai_faux") {
      html += '<div class="vf-grid" role="radiogroup" aria-label="' + esc(q.question) + '">';
      var opts = [{ letter: "V", text: "Vrai" }, { letter: "F", text: "Faux" }];
      for (var k = 0; k < opts.length; k++) {
        var s2 = (quiz.answers[q.id] || "").toUpperCase() === opts[k].letter;
        html +=
          '<button class="vf-btn" role="radio" aria-checked="' + s2 + '" data-pick="' + opts[k].letter + '">' +
          '<span class="answer-letter" aria-hidden="true">' + opts[k].letter + "</span><br>" + opts[k].text +
          "</button>";
      }
      html += "</div>";
    }

    /* ----- curseur ----- */
    if (q.type === "curseur") {
      var s = q.slider || { min: 0, max: 10, labelLeft: "", labelRight: "" };
      html +=
        '<div class="slider-box">' +
        '<p class="slider-value" id="slider-val" aria-live="polite">' + esc(reponseFor(q)) +
        ' <span class="of">/ ' + esc(String(s.max)) + "</span></p>" +
        '<input type="range" id="slider" aria-label="' + esc(q.question) + '" min="' + s.min + '" max="' + s.max + '" step="1" value="' + esc(reponseFor(q)) + '">' +
        '<div class="slider-labels"><span>' + esc(s.labelLeft || "") + "</span><span>" + esc(s.labelRight || "") + "</span></div>" +
        "</div>";
    }

    /* ----- classement ----- */
    if (q.type === "classement") {
      html += '<div class="rank-board">';
      for (var m = 0; m < quiz.rankItems.length; m++) {
        var it = quiz.rankItems[m];
        var pos = quiz.rankOrder.indexOf(it.letter);
        var used = pos >= 0;
        html +=
          '<button class="answer-btn rank-card' + (used ? " used" : "") + '" aria-pressed="' + used + '" data-rank="' + it.letter + '">' +
          '<span class="answer-letter" aria-hidden="true">' + (used ? (pos + 1) : "·") + "</span>" +
          '<span class="answer-text">' + esc(it.text) + "</span>" +
          "</button>";
      }
      html += "</div>";
      html +=
        '<div class="rank-order"><p style="font-weight:700;color:var(--softink)">Ton ordre :</p>';
      if (quiz.rankOrder.length === 0) {
        html += "<p class='muted'>Touche les cartes ci-dessus, une par une.</p>";
      } else {
        html += "<div>";
        for (var o = 0; o < quiz.rankOrder.length; o++) {
          var li = LETTERS.indexOf(quiz.rankOrder[o]);
          var txt = li >= 0 ? (q.choices[li] || quiz.rankOrder[o]) : quiz.rankOrder[o];
          html +=
            '<button class="rank-order-item" data-unrank="' + quiz.rankOrder[o] + '" title="Retirer">' +
            '<span class="rank-num" aria-hidden="true">' + (o + 1) + "</span>" +
            '<span style="font-weight:700">' + esc(txt) + "</span>" +
            '<span class="rank-remove">retirer</span>' +
            "</button>";
        }
        html += "</div>";
      }
      html += "</div>";
    }

    /* ----- texte ----- */
    if (q.type === "texte") {
      html +=
        '<textarea class="textinput" id="freetext" aria-label="' + esc(q.question) + '" maxlength="500" rows="3" placeholder="Écris ta réponse en quelques mots…">' +
        esc(quiz.answers[q.id] || "") + "</textarea>";
    }

    /* ----- barre d'action ----- */
    html +=
      '<div class="actionbar"><div class="actionbar-row">' +
      '<button class="btn btn-secondary" id="q-back"' + (quiz.index === 0 ? " disabled" : "") + ">Retour</button>" +
      '<button class="btn btn-primary" id="q-next"' + (ready ? "" : " disabled") + ">" +
      (isLast ? "Envoyer mes réponses" : "Question suivante") + "</button>" +
      "</div>" +
      (ready ? "" : '<p class="actionbar-hint">' + esc(hintFor(q)) + "</p>") +
      "</div></div>";

    app.innerHTML = html;
    scrollTop();

    // interactions
    var picks = app.querySelectorAll("[data-pick]");
    for (var p = 0; p < picks.length; p++) {
      picks[p].addEventListener("click", function () {
        quiz.answers[q.id] = this.getAttribute("data-pick");
        viewQuestion();
      });
    }
    var slider = document.getElementById("slider");
    if (slider) {
      slider.addEventListener("input", function () {
        quiz.answers[q.id] = this.value;
        document.getElementById("slider-val").innerHTML =
          esc(this.value) + ' <span class="of">/ ' + esc(String((q.slider || {}).max || 10)) + "</span>";
        var next = document.getElementById("q-next");
        next.disabled = false;
        var hint = app.querySelector(".actionbar-hint");
        if (hint) hint.remove();
      });
    }
    var ranks = app.querySelectorAll("[data-rank]");
    for (var r = 0; r < ranks.length; r++) {
      ranks[r].addEventListener("click", function () { toggleRank(q, this.getAttribute("data-rank")); });
    }
    var unranks = app.querySelectorAll("[data-unrank]");
    for (var u = 0; u < unranks.length; u++) {
      unranks[u].addEventListener("click", function () { toggleRank(q, this.getAttribute("data-unrank")); });
    }
    var ft = document.getElementById("freetext");
    if (ft) {
      ft.addEventListener("input", function () {
        quiz.answers[q.id] = this.value;
        var next2 = document.getElementById("q-next");
        var ok = this.value.trim().length > 0;
        next2.disabled = !ok;
        var hint2 = app.querySelector(".actionbar-hint");
        if (ok && hint2) hint2.remove();
        else if (!ok && !hint2) {
          var p2 = document.createElement("p");
          p2.className = "actionbar-hint";
          p2.textContent = hintFor(q);
          document.querySelector(".actionbar").appendChild(p2);
        }
      });
    }
    document.getElementById("q-back").addEventListener("click", function () {
      if (quiz.index > 0) { quiz.index--; viewQuestion(); }
    });
    document.getElementById("q-next").addEventListener("click", function () {
      if (!canProceed(q)) return;
      if (isLast) { submitQuiz(); }
      else { quiz.index++; viewQuestion(); }
    });
  }

  function toggleRank(q, letter) {
    var idx = quiz.rankOrder.indexOf(letter);
    if (idx >= 0) quiz.rankOrder.splice(idx, 1);
    else quiz.rankOrder.push(letter);
    quiz.answers[q.id] = quiz.rankOrder.join(",");
    viewQuestion();
  }

  function submitQuiz() {
    spinner("Envoi en cours…");
    var payload = quiz.questions.map(function (q) {
      return { question_id: q.id, reponse: reponseFor(q) };
    });
    callBackend("submit_quiz", {
      student_name: quiz.name,
      chapitre: quiz.chapter.numero,
      answers: payload
    }).then(function (res) {
      if (res && res.ok) {
        // RÈGLE DE MATHIEU : juste un merci. Pas de score, pas de correction.
        viewDone();
      } else {
        viewSubmitFailed("L'envoi a échoué.", false);
      }
    }).catch(function (err) {
      var closed = err && (err.message === "Ce chapitre est fermé." || (err.chapter_closed === true));
      viewSubmitFailed(closed ? "Ce chapitre a été fermé." : backendErrorMessage(err), !!closed);
    });
  }

  function viewSubmitFailed(message, closed) {
    var html = '<div class="section">' +
      notice("error", "L'envoi a échoué",
        "<p>" + esc(message) + "</p>" +
        (closed ? "" : "<p>Tes réponses sont gardées : tu peux réessayer sans tout refaire.</p>")) +
      "<p>";
    if (closed) {
      html += '<button class="btn btn-primary" id="sf-back">Choisir un autre chapitre</button>';
    } else {
      html += '<button class="btn btn-primary" id="sf-retry">Réessayer</button></p><p>' +
        '<button class="btn btn-secondary" id="sf-review">Revoir mes réponses</button>';
    }
    html += "</p></div>";
    app.innerHTML = html;
    scrollTop();
    if (closed) {
      document.getElementById("sf-back").addEventListener("click", viewQuizHome);
    } else {
      document.getElementById("sf-retry").addEventListener("click", submitQuiz);
      document.getElementById("sf-review").addEventListener("click", viewQuestion);
    }
  }

  /* ---------------- QUIZ : merci (et rien d'autre) ---------------- */
  function viewDone() {
    app.innerHTML =
      '<div class="thanks">' +
      "<h1>Merci !</h1>" +
      "<p class='lead'>Ton quiz est terminé.</p>" +
      '<p style="margin-top:1.5rem"><button class="btn btn-secondary" id="done-back">Faire un autre quiz</button></p>' +
      "</div>";
    scrollTop();
    document.getElementById("done-back").addEventListener("click", viewQuizHome);
  }

  /* ---------------- ESPACE PROF : verrou ---------------- */
  function viewProf() {
    setNav("prof");
    if (!CONFIGURED) {
      app.innerHTML = '<div class="section"><h1>Espace prof</h1>' +
        notice("info", "Le site n'est pas encore branché",
          "<p>Colle l'adresse de l'application web dans <b>config.js</b>, puis recharge cette page.</p>") +
        "</div>";
      scrollTop();
      return;
    }
    spinner("L'espace prof s'ouvre…");
    callBackend("verify_teacher_code", { code: teacherCode }).then(function (res) {
      if (res && res.ok && teacherCode) { viewProfMain(); return; }
      if (res && res.code_set === false) { viewCreateCode(); return; }
      viewUnlock();
    }).catch(function () {
      viewUnlock();
    });
  }

  function viewUnlock() {
    app.innerHTML = '<div class="section"><h1>Espace prof</h1>' +
      '<form id="unlock-form">' +
      "<p class='lead'>Tape ton code pour voir les notes des élèves.</p>" +
      '<div class="field"><label for="teacher-code">Code prof</label>' +
      '<input id="teacher-code" class="textinput" type="text" maxlength="32" autocomplete="off">' +
      '<p class="fielderr" id="unlock-error" role="alert" hidden></p></div>' +
      '<p><button class="btn btn-primary btn-block" type="submit" id="unlock-btn">Déverrouiller</button></p>' +
      "<p class='muted small'>Code oublié ? Clement peut le réinitialiser dans la Sheet (onglet Config).</p>" +
      "</form></div>";
    scrollTop();
    var input = document.getElementById("teacher-code");
    input.focus();
    document.getElementById("unlock-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = input.value.trim();
      var err = document.getElementById("unlock-error");
      if (!code) { err.textContent = "Tape ton code."; err.hidden = false; return; }
      var btn = document.getElementById("unlock-btn");
      btn.disabled = true; btn.textContent = "Vérification…";
      err.hidden = true;
      callBackend("verify_teacher_code", { code: code }).then(function (res) {
        if (res && res.ok) {
          teacherCode = code;
          viewProfMain();
        } else {
          err.textContent = "Ce code n'est pas bon. Réessaie.";
          err.hidden = false;
          btn.disabled = false; btn.textContent = "Déverrouiller";
        }
      }).catch(function () {
        err.textContent = "Impossible de vérifier le code.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = "Déverrouiller";
      });
    });
  }

  function viewCreateCode() {
    app.innerHTML = '<div class="section"><h1>Espace prof</h1>' +
      '<form id="create-form">' +
      "<p class='lead'>Crée un code pour cet espace. Seuls ceux qui le connaissent verront les notes des élèves.</p>" +
      '<div class="field"><label for="new-code">Nouveau code</label>' +
      '<input id="new-code" class="textinput" type="text" maxlength="32" autocomplete="off">' + "</div>" +
      '<div class="field"><label for="new-code-confirm">Confirmation du code</label>' +
      '<input id="new-code-confirm" class="textinput" type="text" maxlength="32" autocomplete="off">' +
      '<p class="fielderr" id="create-error" role="alert" hidden></p></div>' +
      '<p><button class="btn btn-primary btn-block" type="submit" id="create-btn">Créer le code</button></p>' +
      "</form></div>";
    scrollTop();
    document.getElementById("create-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var c1 = document.getElementById("new-code").value.trim();
      var c2 = document.getElementById("new-code-confirm").value.trim();
      var err = document.getElementById("create-error");
      if (c1.length < 4) { err.textContent = "Choisis un code d'au moins 4 caractères."; err.hidden = false; return; }
      if (c1 !== c2) { err.textContent = "Les deux codes ne correspondent pas."; err.hidden = false; return; }
      var btn = document.getElementById("create-btn");
      btn.disabled = true; btn.textContent = "Création…";
      err.hidden = true;
      callBackend("set_config", { new_code: c1 }).then(function (res) {
        if (res && res.ok) {
          teacherCode = c1;
          viewProfMain();
        } else {
          err.textContent = (res && res.error) || "Impossible de créer le code.";
          err.hidden = false;
          btn.disabled = false; btn.textContent = "Créer le code";
        }
      }).catch(function () {
        err.textContent = "Impossible de créer le code.";
        err.hidden = false;
        btn.disabled = false; btn.textContent = "Créer le code";
      });
    });
  }

  function viewProfMain() {
    var html = '<div class="section">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:1rem">' +
      "<h1>Espace prof</h1>" +
      '<button class="btn btn-secondary" id="lock-btn" style="min-height:2.75rem;font-size:1.05rem;padding:0.5rem 1rem">🔒 Verrouiller</button>' +
      "</div>" +
      '<div class="tabs" role="tablist" aria-label="Espace prof">' +
      '<button class="tab" role="tab" id="tab-results" aria-selected="true">Résultats</button>' +
      '<button class="tab" role="tab" id="tab-settings" aria-selected="false">Réglages</button>' +
      "</div>" +
      '<div id="prof-body"></div>' +
      "</div>";
    app.innerHTML = html;
    scrollTop();
    document.getElementById("lock-btn").addEventListener("click", function () {
      teacherCode = "";
      viewUnlock();
    });
    document.getElementById("tab-results").addEventListener("click", function () {
      document.getElementById("tab-results").setAttribute("aria-selected", "true");
      document.getElementById("tab-settings").setAttribute("aria-selected", "false");
      viewDashboard();
    });
    document.getElementById("tab-settings").addEventListener("click", function () {
      document.getElementById("tab-results").setAttribute("aria-selected", "false");
      document.getElementById("tab-settings").setAttribute("aria-selected", "true");
      viewSettings();
    });
    viewDashboard();
  }

  /* ---------------- ESPACE PROF : tableau de bord ---------------- */
  function reponseDisplay(q, raw) {
    if (!q) return esc(raw);
    if (q.type === "qcm") {
      var li = LETTERS.indexOf(String(raw).toUpperCase());
      var txt = li >= 0 ? (q.choices[li] || "") : "";
      return esc(String(raw).toUpperCase()) + (txt ? " — " + esc(txt) : "");
    }
    if (q.type === "vrai_faux") {
      var v = String(raw).toUpperCase();
      return v === "V" ? "Vrai" : (v === "F" ? "Faux" : esc(raw));
    }
    if (q.type === "classement") {
      var parts = String(raw).split(",").map(function (l) { return l.trim().toUpperCase(); }).filter(Boolean);
      return parts.map(function (l, i) {
        var li2 = LETTERS.indexOf(l);
        var t = li2 >= 0 ? (q.choices[li2] || l) : l;
        return (i + 1) + ". " + t;
      }).map(esc).join("<br>");
    }
    return esc(raw);
  }

  function markBadge(q, isCorrect) {
    if (!q || GRADED.indexOf(q.type) < 0) {
      return '<span class="pill neutral">Réponse enregistrée</span>';
    }
    return isCorrect
      ? '<span class="pill good">✓ Bonne réponse</span>'
      : '<span class="pill bad">✗ Ratée</span>';
  }

  function viewDashboard() {
    var body = document.getElementById("prof-body");
    body.innerHTML = '<div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><p class="lead">Les résultats arrivent…</p></div>';
    Promise.all([callBackend("get_teacher_results", {}), getConfig(true)]).then(function (pair) {
      var res = pair[0];
      var sessions = res.sessions || [];
      var stats = res.question_stats || [];
      var qref = {};
      (res.questions || []).forEach(function (q) { qref[q.question_id] = q; });
      var list = chapters();

      var doneAll = sessions.filter(function (s) { return s.completed_at && s.max_score > 0; });
      var avgAll = null;
      if (doneAll.length) {
        var tot = doneAll.reduce(function (a, s) { return a + s.total_score / s.max_score; }, 0);
        avgAll = Math.round(100 * tot / doneAll.length);
      }

      var html =
        '<div style="text-align:right;margin-bottom:1rem">' +
        '<button class="btn btn-secondary" id="refresh-results" style="min-height:2.75rem;font-size:1.05rem;padding:0.5rem 1rem">↻ Actualiser</button></div>' +
        '<section class="section"><h2>Vue d\'ensemble</h2>' +
        '<div class="stat-hero"><p style="font-weight:700;color:var(--softink)">Note moyenne des élèves</p>' +
        '<p class="num">' + (avgAll !== null ? avgAll + " %" : "—") + "</p>" +
        "<p class='muted'>" + (doneAll.length ? "sur " + doneAll.length + " " + plural(doneAll.length, "quiz terminé", "quiz terminés") : "aucun quiz terminé pour l'instant") + "</p></div>" +
        '<div class="stat-grid">' +
        '<div class="stat-cell"><p class="num">' + sessions.length + "</p><p class='lbl'>" + plural(sessions.length, "élève", "élèves") + "</p></div>" +
        '<div class="stat-cell"><p class="num">' + doneAll.length + "</p><p class='lbl'>" + plural(doneAll.length, "quiz terminé", "quiz terminés") + "</p></div>" +
        '<div class="stat-cell"><p class="num">' + stats.length + "</p><p class='lbl'>" + plural(stats.length, "question", "questions") + "</p></div>" +
        "</div>" +
        '<div class="card"><p style="font-weight:700;color:var(--softink)">Par chapitre</p>';
      for (var gi = 0; gi < list.length; gi++) {
        var ch = list[gi];
        var gsess = sessions.filter(function (s) { return s.chapitre === ch.numero; });
        var gdone = gsess.filter(function (s) { return s.completed_at && s.max_score > 0; });
        var gavg = null;
        if (gdone.length) {
          var gt = gdone.reduce(function (a, s) { return a + s.total_score / s.max_score; }, 0);
          gavg = Math.round(100 * gt / gdone.length);
        }
        var gstats = stats.filter(function (st) { return st.chapitre === ch.numero; });
        html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;border-top:2px solid var(--line);padding:0.6rem 0' + (gi === 0 ? ";border-top:none;padding-top:0" : "") + '">' +
          '<span style="font-weight:700;font-size:1.15rem">' + esc(ch.title) + "</span>" +
          '<span class="badge ' + (ch.open ? "open" : "closed") + '">' + (ch.open ? "Ouvert" : "Fermé") + "</span>" +
          '<span class="muted small" style="margin-left:auto">' + gsess.length + " " + plural(gsess.length, "élève", "élèves") + " · " +
          gdone.length + " terminé" + (gdone.length > 1 ? "s" : "") + " · " +
          gstats.length + " " + plural(gstats.length, "question", "questions") +
          (gavg !== null ? " · moyenne " + gavg + " %" : "") + "</span></div>";
      }
      html += "</div></section>";

      // Élèves par chapitre
      html += '<section class="section"><h2>Les élèves</h2>';
      if (sessions.length === 0) {
        html += notice("info", "Personne pour l'instant", "<p>Aucun élève n'a encore répondu à un quiz.</p>");
      } else {
        for (var ci = 0; ci < list.length; ci++) {
          var c2 = list[ci];
          var cs = sessions.filter(function (s) { return s.chapitre === c2.numero; });
          if (!cs.length) continue;
          html += "<h3>" + esc(c2.title) + ' <span class="badge ' + (c2.open ? "open" : "closed") + '">' + (c2.open ? "Ouvert" : "Fermé") + "</span></h3>";
          for (var si = 0; si < cs.length; si++) {
            var s = cs[si];
            var p = pct(s.total_score, s.max_score);
            var date = s.completed_at || s.started_at;
            html +=
              '<article class="session"><button class="session-head" data-session="' + s.id + '" aria-expanded="false">' +
              '<span class="session-name"><span class="n">' + esc(s.student_name || "Sans nom") + "</span>" +
              '<span class="d">' + esc(fmtDateTime(date)) + "</span></span>" +
              (s.completed_at ? "" : '<span class="pill neutral">Interrompu</span>') +
              '<span class="session-score">' + s.total_score + "/" + s.max_score + "</span>" +
              '<span aria-hidden="true">▾</span>' +
              "</button>" +
              '<div class="session-body" data-session-body="' + s.id + '" hidden>' +
              "<p>" + (p !== null ? "<b>" + p + " %</b>" : "—") + " — " + s.total_score + " bonnes réponses sur " + s.max_score + ".</p>";
            if (!s.answers || !s.answers.length) {
              html += "<p class='muted'>Cet élève n'a laissé aucune réponse.</p>";
            } else {
              for (var ai = 0; ai < s.answers.length; ai++) {
                var a = s.answers[ai];
                var qq = qref[a.question_id];
                var raw = "";
                try { raw = String(JSON.parse(a.answer_json || "{}").reponse || ""); } catch (e) { raw = ""; }
                var tlabel = qq ? ((TYPE_INFO[qq.type] || {}).label || "") : "";
                html += '<div class="qblock">' +
                  "<p style='font-weight:700;font-size:1.15rem'>" + esc(qq ? qq.question : ("Question n° " + a.question_id)) +
                  (tlabel ? ' <span class="badge">' + esc(tlabel) + "</span>" : "") + "</p>" +
                  "<p><b>Réponse :</b> " + reponseDisplay(qq, raw) + "</p>" +
                  "<p>" + markBadge(qq, a.is_correct) + "</p>" +
                  "</div>";
              }
            }
            html += "</div></article>";
          }
        }
      }
      html += "</section>";

      // Questions par chapitre (bonnes réponses + explications — prof uniquement)
      html += '<section class="section"><h2>Les questions</h2>';
      if (stats.length === 0) {
        html += notice("info", "Encore rien à montrer", "<p>Les questions arriveront ici avec les premières réponses.</p>");
      } else {
        for (var qi = 0; qi < list.length; qi++) {
          var c3 = list[qi];
          var cstats = stats.filter(function (st) { return st.chapitre === c3.numero; });
          if (!cstats.length) continue;
          html += "<h3>" + esc(c3.title) + ' <span class="badge">' + cstats.length + " " + plural(cstats.length, "question", "questions") + "</span></h3>";
          for (var ti = 0; ti < cstats.length; ti++) {
            var st = cstats[ti];
            var qr = qref[st.question_id];
            var graded = qr ? GRADED.indexOf(qr.type) >= 0 : true;
            var tlabel2 = qr ? ((TYPE_INFO[qr.type] || {}).label || "") : "";
            html += '<article class="card" style="margin-bottom:0.8rem">' +
              "<p style='font-weight:700;font-size:1.15rem'>" + esc(qr ? qr.question : ("Question n° " + st.question_id)) +
              ' <span class="muted small">(n° ' + st.question_id + (tlabel2 ? " · " + esc(tlabel2) : "") + ")</span></p>";
            if (graded) {
              html += st.nb_reponses > 0 && st.taux_reussite !== null
                ? "<p><b style='color:var(--gold)'>" + st.taux_reussite + " %</b> de réussite — " + st.nb_reussites + " " + plural(st.nb_reussites || 0, "élève a réussi", "élèves ont réussi") + " sur " + st.nb_reponses + ".</p>"
                : "<p class='muted'>Pas encore de réponse.</p>";
            } else {
              html += st.nb_reponses > 0
                ? "<p class='muted'>" + st.nb_reponses + " " + plural(st.nb_reponses, "réponse enregistrée", "réponses enregistrées") + " (pas de note pour ce type).</p>"
                : "<p class='muted'>Pas encore de réponse.</p>";
            }
            if (qr && qr.bonne_reponse) {
              html += "<p><b>" + (qr.type === "texte" ? "Réponse modèle" : "Bonne réponse") + " :</b> " + reponseDisplay(qr, qr.bonne_reponse) + "</p>";
            }
            if (qr && qr.explication) {
              html += "<p class='muted'>" + esc(qr.explication) + "</p>";
            }
            html += "</article>";
          }
        }
      }
      html += "</section>";

      if (SHEET_URL) {
        html += '<p><a class="sheetlink" href="' + esc(SHEET_URL) + '" target="_blank" rel="noreferrer">📊 Ouvrir la Google Sheet</a></p>';
      }

      body.innerHTML = html;
      document.getElementById("refresh-results").addEventListener("click", viewDashboard);
      var heads = body.querySelectorAll("[data-session]");
      for (var h = 0; h < heads.length; h++) {
        heads[h].addEventListener("click", function () {
          var id = this.getAttribute("data-session");
          var panel = body.querySelector('[data-session-body="' + id + '"]');
          var open = panel.hidden;
          panel.hidden = !open;
          this.setAttribute("aria-expanded", String(open));
        });
      }
    }).catch(function (err) {
      body.innerHTML = notice("error", "Les résultats ne répondent pas",
        "<p>" + esc(backendErrorMessage(err)) + "</p>") +
        '<p><button class="btn btn-secondary" id="retry-results">Réessayer</button></p>';
      document.getElementById("retry-results").addEventListener("click", viewDashboard);
    });
  }

  /* ---------------- ESPACE PROF : réglages ---------------- */
  function viewSettings() {
    var body = document.getElementById("prof-body");
    body.innerHTML = '<div class="loading" role="status"><div class="spinner" aria-hidden="true"></div><p class="lead">Les réglages se chargent…</p></div>';
    getConfig(true).then(function () {
      var list = chapters();
      var openCount = list.filter(function (c) { return c.open; }).length;

      var html = '<div class="section"><h2>Le branchement</h2>' +
        "<p class='lead'>Le site lit ta Sheet à cette adresse :</p>" +
        '<p class="card" style="word-break:break-all;font-size:1.05rem">' + esc(BACKEND_URL) + "</p>" +
        '<p class="muted small">Pour changer d\'adresse, modifie le fichier <b>config.js</b> du site et redéploie.</p>' +
        '<p><button class="btn btn-secondary" id="test-backend">Tester la connexion</button></p>' +
        '<p role="status" id="test-msg"></p></div>';

      html += '<div class="section"><h2>Les 7 chapitres</h2>' +
        "<p class='lead'>Ouvre un chapitre quand tu l'as fait en classe : les élèves ne voient que les chapitres <b>ouverts</b>. Tu peux aussi renommer chaque chapitre. <b>" +
        openCount + " " + plural(openCount, "ouvert", "ouverts") + " pour l'instant.</b></p>" +
        '<p role="status" id="chapters-msg"></p><div id="chapter-rows">';
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        html +=
          '<div class="chapter-row">' +
          '<span class="chapter-num" aria-hidden="true">' + c.numero + "</span>" +
          '<div style="flex:1;min-width:0">' +
          '<label for="chapter-title-' + c.numero + '" class="muted small" style="position:absolute;left:-9999px">Titre du chapitre ' + c.numero + "</label>" +
          '<input id="chapter-title-' + c.numero + '" class="title-input" type="text" maxlength="60" value="' + esc(c.title) + '" data-title="' + c.numero + '">' +
          "<p class='muted small' data-chapter-sub='" + c.numero + "'>" + (c.open ? "Les élèves peuvent le faire." : "Les élèves le voient comme « Pas encore disponible ».") + "</p>" +
          "</div>" +
          '<button class="switch" role="switch" aria-checked="' + c.open + '" aria-label="' + esc(c.title) + " : " + (c.open ? "ouvert" : "fermé") + " — toucher pour " + (c.open ? "fermer" : "ouvrir") + '" data-toggle="' + c.numero + '"><span class="knob" aria-hidden="true"></span></button>' +
          "</div>";
      }
      html += "</div></div>";

      html += '<div class="section"><h2>Le code prof</h2>' +
        '<div class="field"><label for="old-code">Ancien code</label>' +
        '<input id="old-code" class="textinput" type="text" maxlength="32" autocomplete="off"></div>' +
        '<div class="field"><label for="new-code">Nouveau code</label>' +
        '<input id="new-code" class="textinput" type="text" maxlength="32" autocomplete="off"></div>' +
        '<p role="status" id="code-msg"></p>' +
        '<p><button class="btn btn-secondary" id="change-code">Changer le code</button></p>' +
        "<p class='muted small'>Astuce : un mot simple que tu n'oublieras pas, comme le surnom de ton cours.</p></div>";

      body.innerHTML = html;

      // Test backend
      document.getElementById("test-backend").addEventListener("click", function () {
        var msg = document.getElementById("test-msg");
        msg.innerHTML = "<span class='muted'>Test en cours…</span>";
        callBackend("get_config", {}, 15000).then(function (data) {
          msg.innerHTML = data && (data.chapters_open || data.ok)
            ? "<span class='fieldok'>Connecté. Le quiz peut charger les chapitres.</span>"
            : "<span class='fielderr'>Le test a échoué.</span>";
        }).catch(function () {
          msg.innerHTML = "<span class='fielderr'>Le test a échoué.</span>";
        });
      });

      // Toggles
      function refreshMsg(ok, text) {
        var m = document.getElementById("chapters-msg");
        m.innerHTML = "<span class='" + (ok ? "fieldok" : "fielderr") + "'>" + esc(text) + "</span>";
      }
      var toggles = body.querySelectorAll("[data-toggle]");
      for (var t = 0; t < toggles.length; t++) {
        toggles[t].addEventListener("click", function () {
          var numero = parseInt(this.getAttribute("data-toggle"), 10);
          var ch = chapterByNumero(numero);
          var next = !ch.open;
          var btn = this;
          btn.disabled = true;
          var open = chapters().filter(function (x) { return x.open; }).map(function (x) { return x.numero; });
          if (next) { if (open.indexOf(numero) < 0) open.push(numero); }
          else { open = open.filter(function (x) { return x !== numero; }); }
          callBackend("set_config", { code: teacherCode, chapters_open: open }).then(function (res) {
            if (res && res.ok) {
              return getConfig(true).then(viewSettings).then(function () {
                var m2 = document.getElementById("chapters-msg");
                if (m2) m2.innerHTML = "<span class='fieldok'>" + esc(next
                  ? "« " + ch.title + " » est ouvert : les élèves peuvent le faire."
                  : "« " + ch.title + " » est fermé : les élèves le verront comme « Pas encore disponible ».") + "</span>";
              });
            }
            refreshMsg(false, (res && res.error) || "L'enregistrement a échoué.");
            btn.disabled = false;
          }).catch(function () {
            refreshMsg(false, "L'enregistrement a échoué. Réessaie.");
            btn.disabled = false;
          });
        });
      }

      // Renommage (au blur)
      var inputs = body.querySelectorAll("[data-title]");
      for (var n = 0; n < inputs.length; n++) {
        inputs[n].addEventListener("blur", function () {
          var numero = parseInt(this.getAttribute("data-title"), 10);
          var ch = chapterByNumero(numero);
          var next = this.value.trim();
          if (!next) { this.value = ch.title; return; }
          if (next === ch.title) return;
          var titles = {};
          for (var k = 1; k <= 7; k++) {
            titles[String(k)] = k === numero ? next : chapterByNumero(k).title;
          }
          callBackend("set_config", { code: teacherCode, chapter_titles: titles }).then(function (res) {
            if (res && res.ok) {
              return getConfig(true).then(viewSettings).then(function () {
                var m3 = document.getElementById("chapters-msg");
                if (m3) m3.innerHTML = "<span class='fieldok'>" + esc("Chapitre " + numero + " renommé en « " + next + " ».") + "</span>";
              });
            }
            refreshMsg(false, (res && res.error) || "L'enregistrement a échoué.");
          }).catch(function () {
            refreshMsg(false, "L'enregistrement a échoué. Réessaie.");
          });
        });
      }

      // Changement de code
      document.getElementById("change-code").addEventListener("click", function () {
        var oldC = document.getElementById("old-code").value.trim();
        var newC = document.getElementById("new-code").value.trim();
        var msg = document.getElementById("code-msg");
        if (!oldC || newC.length < 4) {
          msg.innerHTML = "<span class='fielderr'>Tape l'ancien code et un nouveau code d'au moins 4 caractères.</span>";
          return;
        }
        msg.innerHTML = "<span class='muted'>Changement en cours…</span>";
        callBackend("set_config", { code: oldC, new_code: newC }).then(function (res) {
          if (res && res.ok) {
            teacherCode = newC;
            document.getElementById("old-code").value = "";
            document.getElementById("new-code").value = "";
            msg.innerHTML = "<span class='fieldok'>Le code est changé.</span>";
          } else {
            msg.innerHTML = "<span class='fielderr'>" + esc((res && res.error) || "Le changement a échoué.") + "</span>";
          }
        }).catch(function () {
          msg.innerHTML = "<span class='fielderr'>Le changement a échoué.</span>";
        });
      });
    }).catch(function (err) {
      body.innerHTML = notice("error", "Les réglages ne répondent pas",
        "<p>" + esc(backendErrorMessage(err)) + "</p>");
    });
  }

  /* ---------------- routeur ---------------- */
  function route() {
    var h = window.location.hash || "#/";
    if (h === "#/prof" || h.indexOf("#/prof") === 0) { viewProf(); }
    else { viewQuizHome(); }
  }

  window.addEventListener("hashchange", route);

  /* ---------------- démarrage ---------------- */
  route();
})();
