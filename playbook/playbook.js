/* Hands-Off Challenge, Brief Card, and Ownership Log.
   Saved only in localStorage. This file does not send what you type.
   Anonymous step counts, if configured, live in shared/labs-counts.js. */
(function () {
  "use strict";

  var KEY = "abl_playbook_m1";
  var CHECK_IDS = [
    "own-intent",
    "own-context",
    "own-constraints",
    "own-done",
    "own-example",
    "own-checked",
    "own-explain",
    "own-logged"
  ];
  var POINTS = {
    "own-intent": 1,
    "own-context": 1,
    "own-constraints": 1,
    "own-done": 1,
    "own-example": 1,
    "own-checked": 2,
    "own-explain": 2,
    "own-logged": 1
  };
  var BRIEF_IDS = [
    "brief-intent",
    "brief-context",
    "brief-constraints",
    "brief-done",
    "brief-examples",
    "brief-before",
    "brief-after"
  ];
  var LOG_FIELDS = [
    ["date", "Date"],
    ["asked", "I asked for"],
    ["changed", "What changed and why"],
    ["checked", "How I checked"],
    ["undo", "Would I undo it"]
  ];
  var CARDS = {
    A: {
      file: "garden.csv",
      mime: "text/csv",
      name: "Card A, the spreadsheet",
      twist: "Also add an \u201cAverage hours per volunteer\u201d cell that ignores blank rows. (Answer: 3.5)"
    },
    B: {
      file: "flyer.txt",
      mime: "text/plain",
      name: "Card B, the flyer",
      twist: "Also make the flyer readable on a phone in 40 words or fewer, keeping every fact."
    },
    C: {
      file: "signup.html",
      mime: "text/html",
      name: "Card C, the web page",
      twist: "Also stop the count at 20 (the garden fits 20 people) and show \u201cWe\u2019re full, thank you!\u201d"
    },
    D: {
      file: "TuneUp.java",
      mime: "text/plain",
      name: "Card D, the Java file",
      twist: "Also add freeTuneUps(int ridesLogged): 2 for 50 or more rides, 1 for 10\u201349, 0 otherwise, plus checks for 9, 10, 49, and 50."
    }
  };

  var activeRound = "1";
  var hydrating = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function emptyRound() {
    return {
      hands: 0,
      intent: false,
      context: false,
      constraints: false,
      done: false,
      example: false,
      checked: false,
      explain: false,
      logged: false,
      caught: false
    };
  }

  function emptyState() {
    return {
      card: "",
      round: "1",
      rounds: { "1": emptyRound(), "2": emptyRound() },
      brief: {
        intent: "",
        context: "",
        constraints: "",
        done: "",
        examples: "",
        before: "",
        after: ""
      },
      log: [emptyLogRow()]
    };
  }

  function emptyLogRow() {
    return { date: "", asked: "", changed: "", checked: "", undo: "" };
  }

  function loadState() {
    var state = emptyState();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return state;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return state;
      if (parsed.card === "A" || parsed.card === "B" || parsed.card === "C" || parsed.card === "D") {
        state.card = parsed.card;
      }
      if (parsed.round === "2") state.round = "2";
      ["1", "2"].forEach(function (round) {
        var src = parsed.rounds && parsed.rounds[round];
        if (!src || typeof src !== "object") return;
        var dest = state.rounds[round];
        if (typeof src.hands === "number" && src.hands >= 0 && Math.floor(src.hands) === src.hands) {
          dest.hands = src.hands;
        }
        ["intent", "context", "constraints", "done", "example", "checked", "explain", "logged", "caught"].forEach(function (key) {
          dest[key] = src[key] === true;
        });
      });
      if (parsed.brief && typeof parsed.brief === "object") {
        ["intent", "context", "constraints", "done", "examples", "before", "after"].forEach(function (key) {
          if (typeof parsed.brief[key] === "string") state.brief[key] = parsed.brief[key];
        });
      }
      if (Array.isArray(parsed.log) && parsed.log.length) {
        state.log = parsed.log.slice(0, 40).map(function (row) {
          var clean = emptyLogRow();
          if (!row || typeof row !== "object") return clean;
          LOG_FIELDS.forEach(function (pair) {
            var key = pair[0];
            if (typeof row[key] === "string") clean[key] = row[key].slice(0, 500);
          });
          return clean;
        });
      }
    } catch (err) {
      return emptyState();
    }
    return state;
  }

  function persist(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      setStatus("Could not save on this device. You can still copy your text. Nothing is sent.");
    }
  }

  function setStatus(message) {
    var el = byId("action-status");
    if (el) el.textContent = message;
  }

  var CARD_COPY = { A: "card-a", B: "card-b", C: "card-c", D: "card-d" };
  var CARD_DOWNLOAD = { A: "download-a", B: "download-b", C: "download-c", D: "download-d" };

  function count(name, detail) {
    try {
      if (window.LabsCount && typeof window.LabsCount.event === "function") window.LabsCount.event(name, detail);
    } catch (err) {
      /* Counts are optional and must never block the activity. */
    }
  }

  function cardText(letter) {
    var el = byId("card-" + letter.toLowerCase() + "-text");
    if (!el) return "";
    return el.textContent.replace(/^\n/, "").replace(/\s+$/, "") + "\n";
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus("Copied. It stays on this device until you paste it somewhere.");
      }).catch(function () {
        fallbackCopy(text);
      });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "copy-fallback";
    document.body.appendChild(area);
    area.focus();
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    setStatus(ok ? "Copied. It stays on this device until you paste it somewhere." : "Select the text and copy it. Nothing is sent.");
  }

  function downloadText(filename, mime, text) {
    var blob = new Blob([text], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    setStatus("Download started for " + filename + ". The file was built in this browser.");
  }

  function selectedCard() {
    var picked = document.querySelector('input[name="bug-card"]:checked');
    return picked ? picked.value : "";
  }

  function readHands() {
    var input = byId("hands");
    if (!input) return 0;
    var raw = String(input.value).trim();
    if (!/^\d+$/.test(raw)) return null;
    return Number(raw);
  }

  function ownerScore() {
    var total = 0;
    CHECK_IDS.forEach(function (id) {
      var box = byId(id);
      if (box && box.checked) total += POINTS[id];
    });
    return total;
  }

  function renderScore() {
    var hands = readHands();
    var checked = byId("own-checked") && byId("own-checked").checked;
    var rankEl = byId("rank-display");
    var ownerEl = byId("owner-display");
    var detailEl = byId("rank-detail");
    var caughtEl = byId("caught-line");
    if (!rankEl || !ownerEl || !detailEl) return;

    var score = ownerScore();
    ownerEl.textContent = score + "/10";

    var rank = "Old Habits";
    var klass = "rank-habits";
    var detail = "Totally normal in round one.";

    if (hands === null) {
      rank = "Enter a whole number";
      klass = "rank-habits";
      detail = "Hands is a whole number, 0 or more. Not sure? Count it.";
    } else if (hands === 0 && !checked) {
      rank = "Eyes Closed";
      klass = "rank-eyes";
      detail = "Not a win. Zero typing without checking isn\u2019t ownership; it\u2019s hoping.";
    } else if (hands === 0) {
      rank = "Golden Hands";
      klass = "rank-golden";
      detail = "Hands is zero, and you checked the result yourself.";
    } else if (hands <= 3) {
      rank = "Twitchy Fingers";
      klass = "rank-twitchy";
      detail = "An honest count teaches more than a fake zero.";
    }

    rankEl.textContent = rank;
    rankEl.className = "rank-name " + klass;
    detailEl.textContent = detail;

    if (caughtEl) {
      var caught = byId("caught-it") && byId("caught-it").checked;
      if (caught) {
        caughtEl.hidden = false;
        caughtEl.textContent = "Caught It. The agent came back almost right, and you caught it before accepting. No points, just bragging rights.";
      } else {
        caughtEl.hidden = true;
        caughtEl.textContent = "";
      }
    }
  }

  function renderTwist() {
    var el = byId("twist-live");
    if (!el) return;
    var card = selectedCard();
    var roundInput = document.querySelector('input[name="round"]:checked');
    var round = roundInput ? roundInput.value : "1";
    if (!card) {
      el.textContent = round === "2"
        ? "Pick a card to see its rematch twist. The twists are also in the table above."
        : "Pick a card. Round 1 has no added twist: fix the bug. Rematch adds the twist for that card.";
      return;
    }
    var meta = CARDS[card];
    if (round === "2") {
      el.textContent = "Rematch, " + meta.name + ". " + meta.twist;
    } else {
      el.textContent = "Round 1, " + meta.name + ". Fix the bug. No added twist yet.";
    }
  }

  function renderPreview() {
    var slot = byId("selected-card-text");
    if (!slot) return;
    var card = selectedCard();
    if (!card) {
      slot.textContent = "Pick a card to show it here. The full text is also in Step 0 above.";
      return;
    }
    slot.textContent = cardText(card).replace(/\s+$/, "");
  }

  function currentStateFromDom() {
    var state = loadState();
    state.card = selectedCard();
    var roundInput = document.querySelector('input[name="round"]:checked');
    state.round = roundInput ? roundInput.value : activeRound;
    state.rounds[activeRound] = roundFromDom();
    state.brief = briefFromDom();
    state.log = logFromDom();
    return state;
  }

  function roundFromDom() {
    var hands = readHands();
    return {
      hands: hands === null ? 0 : hands,
      intent: !!byId("own-intent").checked,
      context: !!byId("own-context").checked,
      constraints: !!byId("own-constraints").checked,
      done: !!byId("own-done").checked,
      example: !!byId("own-example").checked,
      checked: !!byId("own-checked").checked,
      explain: !!byId("own-explain").checked,
      logged: !!byId("own-logged").checked,
      caught: !!byId("caught-it").checked
    };
  }

  function briefFromDom() {
    return {
      intent: byId("brief-intent").value,
      context: byId("brief-context").value,
      constraints: byId("brief-constraints").value,
      done: byId("brief-done").value,
      examples: byId("brief-examples").value,
      before: byId("brief-before").value,
      after: byId("brief-after").value
    };
  }

  function logFromDom() {
    var rows = [];
    var body = byId("log-body");
    if (!body) return [emptyLogRow()];
    Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
      var row = emptyLogRow();
      LOG_FIELDS.forEach(function (pair) {
        var input = tr.querySelector('[data-field="' + pair[0] + '"]');
        row[pair[0]] = input ? input.value : "";
      });
      rows.push(row);
    });
    if (!rows.length) rows.push(emptyLogRow());
    return rows;
  }

  function saveDom() {
    if (hydrating) return;
    persist(currentStateFromDom());
  }

  function applyRound(round) {
    var box = byId("hands");
    var data = loadState().rounds[round] || emptyRound();
    /* Caller passes the round object directly when we already have it. */
    if (applyRound.override) data = applyRound.override;
    if (box) box.value = String(data.hands);
    byId("own-intent").checked = data.intent;
    byId("own-context").checked = data.context;
    byId("own-constraints").checked = data.constraints;
    byId("own-done").checked = data.done;
    byId("own-example").checked = data.example;
    byId("own-checked").checked = data.checked;
    byId("own-explain").checked = data.explain;
    byId("own-logged").checked = data.logged;
    byId("caught-it").checked = data.caught;
  }

  function applyAll(state) {
    hydrating = true;
    activeRound = state.round === "2" ? "2" : "1";
    var cardRadio = state.card ? document.querySelector('input[name="bug-card"][value="' + state.card + '"]') : null;
    document.querySelectorAll('input[name="bug-card"]').forEach(function (radio) {
      radio.checked = false;
    });
    if (cardRadio) cardRadio.checked = true;
    var roundRadio = document.querySelector('input[name="round"][value="' + activeRound + '"]');
    if (roundRadio) roundRadio.checked = true;
    applyRound.override = state.rounds[activeRound];
    applyRound(activeRound);
    applyRound.override = null;
    byId("brief-intent").value = state.brief.intent;
    byId("brief-context").value = state.brief.context;
    byId("brief-constraints").value = state.brief.constraints;
    byId("brief-done").value = state.brief.done;
    byId("brief-examples").value = state.brief.examples;
    byId("brief-before").value = state.brief.before;
    byId("brief-after").value = state.brief.after;
    renderLog(state.log);
    hydrating = false;
    renderScore();
    renderTwist();
    renderPreview();
  }

  function renderLog(rows) {
    var body = byId("log-body");
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);
    (rows && rows.length ? rows : [emptyLogRow()]).forEach(function (row, index) {
      body.appendChild(buildLogRow(row, index));
    });
  }

  function buildLogRow(row, index) {
    var tr = document.createElement("tr");
    LOG_FIELDS.forEach(function (pair) {
      var td = document.createElement("td");
      var input = document.createElement("input");
      input.type = "text";
      input.value = row[pair[0]] || "";
      input.dataset.field = pair[0];
      input.setAttribute("aria-label", pair[1] + ", row " + (index + 1));
      input.autocomplete = "off";
      input.addEventListener("input", saveDom);
      td.appendChild(input);
      tr.appendChild(td);
    });
    var action = document.createElement("td");
    var remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove log row " + (index + 1));
    remove.addEventListener("click", function () {
      var body = byId("log-body");
      if (body.querySelectorAll("tr").length === 1) {
        LOG_FIELDS.forEach(function (pair) {
          var input = tr.querySelector('[data-field="' + pair[0] + '"]');
          if (input) input.value = "";
        });
        saveDom();
        setStatus("Cleared the only log row. The log still has a blank line.");
        return;
      }
      tr.remove();
      renumberLog();
      saveDom();
      var add = byId("btn-add-row");
      if (add) add.focus();
    });
    action.appendChild(remove);
    tr.appendChild(action);
    return tr;
  }

  function renumberLog() {
    var body = byId("log-body");
    Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr, index) {
      LOG_FIELDS.forEach(function (pair) {
        var input = tr.querySelector('[data-field="' + pair[0] + '"]');
        if (input) input.setAttribute("aria-label", pair[1] + ", row " + (index + 1));
      });
      var button = tr.querySelector("button");
      if (button) button.setAttribute("aria-label", "Remove log row " + (index + 1));
    });
  }

  function briefText() {
    var brief = briefFromDom();
    return [
      "Intent: " + brief.intent,
      "Context: " + brief.context,
      "Constraints: " + brief.constraints,
      "Done when: " + brief.done,
      "Examples: " + brief.examples,
      "Before you change anything: " + brief.before,
      "After: " + brief.after
    ].join("\n");
  }

  function logText() {
    var lines = ["Date | I asked for... | What changed (and why) | How I checked | Undo?"];
    logFromDom().forEach(function (row) {
      lines.push([row.date, row.asked, row.changed, row.checked, row.undo].join(" | "));
    });
    return lines.join("\n");
  }

  function resultsText() {
    var hands = readHands();
    var card = selectedCard();
    var round = activeRound === "2" ? "Rematch" : "Round 1";
    var lines = [
      "Hands-Off Challenge",
      "This is self-reported, and nothing is sent anywhere.",
      "Card: " + (card || "none"),
      "Round: " + round,
      "Hands: " + (hands === null ? "" : String(hands)),
      "Owner Score: " + ownerScore() + "/10",
      "Rank: " + (byId("rank-display") ? byId("rank-display").textContent : ""),
      byId("rank-detail") ? byId("rank-detail").textContent : ""
    ];
    if (byId("caught-it") && byId("caught-it").checked) lines.push("Caught It");
    return lines.filter(Boolean).join("\n");
  }

  function onScoreEdit() {
    if (hydrating) return;
    renderScore();
    saveDom();
  }

  function switchRound(next) {
    if (next === activeRound) return;
    var state = loadState();
    state.card = selectedCard();
    state.brief = briefFromDom();
    state.log = logFromDom();
    state.rounds[activeRound] = roundFromDom();
    state.round = next;
    activeRound = next;
    persist(state);
    hydrating = true;
    applyRound.override = state.rounds[next];
    applyRound(next);
    applyRound.override = null;
    hydrating = false;
    renderScore();
    renderTwist();
  }

  function wire() {
    document.querySelectorAll("[data-copy]").forEach(function (button) {
      button.addEventListener("click", function () {
        var letter = button.getAttribute("data-copy");
        copyText(cardText(letter));
        if (CARD_COPY[letter]) count("copy_clicked", CARD_COPY[letter]);
      });
    });
    document.querySelectorAll("[data-download]").forEach(function (button) {
      button.addEventListener("click", function () {
        var letter = button.getAttribute("data-download");
        var meta = CARDS[letter];
        downloadText(meta.file, meta.mime, cardText(letter));
        if (CARD_DOWNLOAD[letter]) count("copy_clicked", CARD_DOWNLOAD[letter]);
      });
    });

    document.querySelectorAll('input[name="bug-card"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        renderPreview();
        renderTwist();
        saveDom();
        if (!hydrating && CARD_COPY[radio.value]) count("card_picked", radio.value.toLowerCase());
      });
    });

    document.querySelectorAll('input[name="round"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (hydrating) return;
        switchRound(radio.value);
        if (radio.value === "1" || radio.value === "2") count("round_picked", radio.value);
      });
    });

    var hands = byId("hands");
    hands.addEventListener("input", onScoreEdit);
    hands.addEventListener("change", onScoreEdit);
    byId("hands-dec").addEventListener("click", function () {
      var n = readHands();
      if (n === null) n = 0;
      hands.value = String(Math.max(0, n - 1));
      onScoreEdit();
    });
    byId("hands-inc").addEventListener("click", function () {
      var n = readHands();
      if (n === null) n = 0;
      hands.value = String(n + 1);
      onScoreEdit();
    });

    CHECK_IDS.forEach(function (id) {
      byId(id).addEventListener("change", onScoreEdit);
    });
    byId("caught-it").addEventListener("change", onScoreEdit);

    byId("btn-copy-card").addEventListener("click", function () {
      var card = selectedCard();
      if (!card) {
        setStatus("Pick a card first.");
        return;
      }
      copyText(cardText(card));
      if (CARD_COPY[card]) count("copy_clicked", CARD_COPY[card]);
    });
    byId("btn-download-card").addEventListener("click", function () {
      var card = selectedCard();
      if (!card) {
        setStatus("Pick a card first.");
        return;
      }
      downloadText(CARDS[card].file, CARDS[card].mime, cardText(card));
      if (CARD_DOWNLOAD[card]) count("copy_clicked", CARD_DOWNLOAD[card]);
    });
    byId("btn-copy-results").addEventListener("click", function () {
      copyText(resultsText());
      count("copy_clicked", "results");
    });

    byId("btn-copy-brief").addEventListener("click", function () {
      copyText(briefText());
      count("copy_clicked", "brief");
    });
    BRIEF_IDS.forEach(function (id) {
      byId(id).addEventListener("input", saveDom);
    });
    byId("btn-clear-brief").addEventListener("click", function () {
      BRIEF_IDS.forEach(function (id) {
        byId(id).value = "";
      });
      saveDom();
      setStatus("Cleared the Brief Card saved on this device.");
      byId("brief-intent").focus();
    });

    byId("btn-add-row").addEventListener("click", function () {
      var body = byId("log-body");
      var row = buildLogRow(emptyLogRow(), body.querySelectorAll("tr").length);
      body.appendChild(row);
      saveDom();
      var first = row.querySelector("input");
      if (first) first.focus();
    });
    byId("btn-copy-log").addEventListener("click", function () {
      copyText(logText());
      count("copy_clicked", "log");
    });
    byId("btn-clear-log").addEventListener("click", function () {
      renderLog([emptyLogRow()]);
      saveDom();
      setStatus("Cleared the Ownership Log saved on this device.");
    });

    var templateBtn = byId("btn-copy-template");
    if (templateBtn) {
      templateBtn.addEventListener("click", function () {
        var pre = byId("page-one-template");
        copyText(pre ? pre.textContent.replace(/^\n/, "").replace(/\s+$/, "") + "\n" : "");
        count("copy_clicked", "template");
      });
    }

    byId("btn-clear-data").addEventListener("click", function () {
      try {
        localStorage.removeItem(KEY);
      } catch (err) {
        /* Still reset the form if storage is blocked. */
      }
      activeRound = "1";
      applyAll(emptyState());
      setStatus("Cleared data saved on this device. Nothing was sent.");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!byId("hands")) return;
    wire();
    applyAll(loadState());
  });
})();
