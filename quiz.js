(function () {
  "use strict";

  const WRONG_KEY = "literatureFinalWrongQuestions";
  const state = window.__literatureQuizState || {
    mode: "all",
    topic: "all",
    query: "",
    index: 0,
    selected: {},
    answered: {},
    order: [],
    randomIds: [],
    wrongIds: new Set()
  };
  window.__literatureQuizState = state;

  try {
    state.wrongIds = new Set(JSON.parse(localStorage.getItem(WRONG_KEY) || "[]"));
  } catch {
    state.wrongIds = new Set();
  }

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const saveWrong = () => {
    try {
      localStorage.setItem(WRONG_KEY, JSON.stringify([...state.wrongIds]));
    } catch {
      // Practice remains usable even if storage is disabled by the browser.
    }
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const searchableText = (item) => [
    item.question,
    item.topic,
    item.work || "",
    item.explanation,
    ...item.options.map((option) => option.text)
  ].join(" ").toLowerCase();

  const baseFiltered = () => {
    const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
    return bank.filter((item) => {
      const topicMatch = state.topic === "all" || item.topic === state.topic;
      const queryMatch = !state.query || searchableText(item).includes(state.query);
      return topicMatch && queryMatch;
    });
  };

  const currentQuestions = () => {
    let questions = baseFiltered();
    if (state.mode === "multiple") questions = questions.filter((item) => item.type === "multiple");
    if (state.mode === "truefalse") questions = questions.filter((item) => item.type === "truefalse");
    if (state.mode === "wrong") questions = questions.filter((item) => state.wrongIds.has(item.id));
    if (state.mode === "random") {
      if (!state.randomIds.length) state.randomIds = shuffle(questions.map((item) => item.id)).slice(0, 20);
      const randomRank = new Map(state.randomIds.map((id, index) => [id, index]));
      questions = questions.filter((item) => randomRank.has(item.id))
        .sort((a, b) => randomRank.get(a.id) - randomRank.get(b.id));
    } else if (state.order.length) {
      const rank = new Map(state.order.map((id, index) => [id, index]));
      questions.sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
    }
    return questions;
  };

  const updateStats = () => {
    const records = Object.values(state.answered);
    const answered = records.length;
    const correct = records.filter((record) => record.correct).length;
    const wrong = answered - correct;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    document.getElementById("quizAnswered").textContent = answered;
    document.getElementById("quizCorrect").textContent = correct;
    document.getElementById("quizWrong").textContent = wrong;
    document.getElementById("quizAccuracy").textContent = `${accuracy}%`;
  };

  const render = () => {
    const area = document.getElementById("quizQuestionArea");
    if (!area) return;
    const questions = currentQuestions();
    if (state.index >= questions.length) state.index = Math.max(0, questions.length - 1);
    const prev = document.getElementById("quizPrev");
    const next = document.getElementById("quizNext");
    prev.disabled = state.index <= 0;
    next.disabled = !questions.length || state.index >= questions.length - 1;

    if (!questions.length) {
      area.innerHTML = '<div class="quiz-empty">当前筛选条件下没有题目。请更换筛选条件，或先完成一些错题。</div>';
      updateStats();
      return;
    }

    const item = questions[state.index];
    const record = state.answered[item.id];
    const selected = record ? record.selected : state.selected[item.id];
    const typeName = item.type === "multiple" ? "Multiple Choice 单选" : "True or False 判断";
    const options = item.options.map((option) => {
      const classes = ["quiz-option"];
      if (selected === option.label) classes.push("selected");
      if (record && option.label === item.answer) classes.push("correct");
      if (record && option.label === selected && selected !== item.answer) classes.push("wrong");
      return `<button type="button" class="${classes.join(" ")}" data-option="${option.label}" ${record ? "disabled" : ""}>
        <span class="quiz-option-label">${option.label}</span><span>${escapeHtml(option.text)}</span>
      </button>`;
    }).join("");

    const feedback = record
      ? `<div class="quiz-feedback show ${record.correct ? "correct" : "wrong"}">
          <b>${record.correct ? "✓ Correct 回答正确" : `✗ Wrong 回答错误；正确答案：${item.answer}`}</b>
          <p>${escapeHtml(item.explanation)}</p>
        </div>`
      : '<div class="quiz-feedback"></div>';

    area.innerHTML = `<article class="quiz-card">
      <div class="quiz-meta">
        <span class="tag ${item.type === "multiple" ? "answer" : "mix"}">${typeName}</span>
        <span class="tag work">${escapeHtml(item.topic)}</span>
        ${item.work ? `<span class="quiz-work">${escapeHtml(item.work)}</span>` : ""}
        <span class="quiz-count">Question ${state.index + 1} / ${questions.length} · ${item.id}</span>
      </div>
      <div class="quiz-question">${escapeHtml(item.question)}</div>
      <div class="quiz-options">${options}</div>
      <div class="quiz-card-actions">
        <button type="button" id="quizCheck" ${selected && !record ? "" : "disabled"}>Check Answer 检查答案</button>
      </div>
      ${feedback}
    </article>`;

    area.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selected[item.id] = button.dataset.option;
        render();
      });
    });

    const check = document.getElementById("quizCheck");
    if (check) {
      check.addEventListener("click", () => {
        const choice = state.selected[item.id];
        if (!choice) return;
        const correct = choice === item.answer;
        state.answered[item.id] = { selected: choice, correct };
        if (correct) state.wrongIds.delete(item.id);
        else state.wrongIds.add(item.id);
        saveWrong();
        render();
      });
    }
    updateStats();
  };

  const setMode = (mode) => {
    state.mode = mode;
    state.index = 0;
    state.randomIds = mode === "random" ? shuffle(baseFiltered().map((item) => item.id)).slice(0, 20) : [];
    document.querySelectorAll("[data-quiz-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.quizMode === mode);
    });
    render();
  };

  window.initQuiz = function initQuiz() {
    const app = document.getElementById("quizApp");
    if (!app || app.dataset.initialized === "true") return;
    app.dataset.initialized = "true";
    if (!Array.isArray(window.QUESTION_BANK)) {
      document.getElementById("quizQuestionArea").innerHTML = '<div class="quiz-empty">题库加载失败，请检查 assets/questions.js。</div>';
      return;
    }

    const multipleCount = window.QUESTION_BANK.filter((item) => item.type === "multiple").length;
    const tfCount = window.QUESTION_BANK.filter((item) => item.type === "truefalse").length;
    document.getElementById("quizBankSummary").textContent =
      `共 ${window.QUESTION_BANK.length} 题（单选 ${multipleCount}，判断 ${tfCount}）`;

    document.querySelectorAll("[data-quiz-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.quizMode === state.mode);
      button.addEventListener("click", () => setMode(button.dataset.quizMode));
    });

    const topic = document.getElementById("quizTopic");
    topic.value = state.topic;
    topic.addEventListener("change", () => {
      state.topic = topic.value;
      state.index = 0;
      state.randomIds = [];
      render();
    });

    const search = document.getElementById("quizSearch");
    search.value = state.query;
    search.addEventListener("input", () => {
      state.query = search.value.trim().toLowerCase();
      state.index = 0;
      state.randomIds = [];
      render();
    });

    document.getElementById("quizPrev").addEventListener("click", () => {
      if (state.index > 0) state.index -= 1;
      render();
    });
    document.getElementById("quizNext").addEventListener("click", () => {
      if (state.index < currentQuestions().length - 1) state.index += 1;
      render();
    });
    document.getElementById("quizShuffle").addEventListener("click", () => {
      const ids = currentQuestions().map((item) => item.id);
      if (state.mode === "random") state.randomIds = shuffle(ids);
      else state.order = shuffle(ids);
      state.index = 0;
      render();
    });
    document.getElementById("quizReset").addEventListener("click", () => {
      state.selected = {};
      state.answered = {};
      state.index = 0;
      state.order = [];
      state.randomIds = state.mode === "random"
        ? shuffle(baseFiltered().map((item) => item.id)).slice(0, 20)
        : [];
      render();
    });
    document.getElementById("quizClearWrong").addEventListener("click", () => {
      state.wrongIds.clear();
      saveWrong();
      state.index = 0;
      render();
    });
    render();
  };

  window.initQuiz();
}());
