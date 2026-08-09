(async function () {
  await DB.ensureSeeded();

  const CRITERIA = [
    { key: "Importance", label: "Importance" },
    { key: "Urgency", label: "Urgency" },
    { key: "FinancialReward", label: "Financial Reward" },
    { key: "FinancialCost", label: "Financial Cost" },
  ];
  const SCORES_KEY = "tasktracker.rankerScores";

  const matchupArea = document.getElementById("matchup-area");
  const noTasksEl = document.getElementById("no-tasks");
  const progressEl = document.getElementById("ranker-progress");
  const rankingsBody = document.getElementById("rankings-body");
  const resetBtn = document.getElementById("reset-btn");
  const skipBtn = document.getElementById("skip-btn");

  let tasks = [];
  let scores = {};
  let current = null; // { a, b, decided: {criterionKey: 'a'|'b'|'tie'} }
  let comparisonsMade = 0;

  function loadScores() {
    scores = JSON.parse(localStorage.getItem(SCORES_KEY) || "{}");
  }

  function saveScores() {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  }

  function ensureScore(taskId) {
    if (!scores[taskId]) {
      scores[taskId] = { Importance: 0, Urgency: 0, FinancialReward: 0, FinancialCost: 0 };
    }
    return scores[taskId];
  }

  function pickPair() {
    if (tasks.length < 2) return null;
    let a = tasks[Math.floor(Math.random() * tasks.length)];
    let b = tasks[Math.floor(Math.random() * tasks.length)];
    let guard = 0;
    while (b.Id === a.Id && guard++ < 20) {
      b = tasks[Math.floor(Math.random() * tasks.length)];
    }
    return { a, b, decided: {} };
  }

  function taskSummary(task) {
    const div = document.createElement("div");
    div.style.fontSize = "12px";
    div.style.color = "var(--text-muted)";
    const bits = [];
    if (task.Rewards.length) bits.push(`${task.Rewards.length} reward${task.Rewards.length > 1 ? "s" : ""}`);
    if (task.Cost.length) bits.push(`${task.Cost.length} cost${task.Cost.length > 1 ? "s" : ""}`);
    div.textContent = bits.join(" · ") || "No rewards/costs recorded";
    return div;
  }

  function renderMatchup() {
    matchupArea.innerHTML = "";
    if (!current) return;

    const wrap = document.createElement("div");
    wrap.className = "matchup";

    const cardA = buildCard(current.a);
    const vs = document.createElement("div");
    vs.className = "matchup-vs";
    vs.textContent = "VS";
    const cardB = buildCard(current.b);

    wrap.append(cardA, vs, cardB);
    matchupArea.appendChild(wrap);

    const panel = document.createElement("div");
    panel.className = "criteria-panel";
    for (const c of CRITERIA) {
      panel.appendChild(buildCriterionRow(c));
    }
    matchupArea.appendChild(panel);
  }

  function buildCard(task) {
    const card = document.createElement("div");
    card.className = "matchup-card is-clickable";
    card.title = "Click to edit this task";
    card.addEventListener("click", () => {
      window.location.href = `task-edit.html?id=${encodeURIComponent(task.Id)}`;
    });
    const h3 = document.createElement("h3");
    h3.textContent = task.Name || "(untitled task)";
    card.appendChild(h3);
    card.appendChild(renderDateBadge(task.DueDate));
    card.appendChild(taskSummary(task));
    return card;
  }

  function buildCriterionRow(criterion) {
    const row = document.createElement("div");
    row.className = "criteria-row";
    const decision = current.decided[criterion.key];
    if (decision) row.classList.add("decided");

    const label = document.createElement("div");
    label.className = "criteria-label";
    label.textContent = criterion.label;
    row.appendChild(label);

    if (decision) {
      const decidedLabel = document.createElement("div");
      decidedLabel.className = "criteria-decided-label";
      const winnerName =
        decision === "tie" ? "Tied" : decision === "a" ? current.a.Name : current.b.Name;
      decidedLabel.textContent = decision === "tie" ? "Tied" : `${winnerName} wins`;
      row.appendChild(decidedLabel);
      row.appendChild(document.createElement("div"));
      return row;
    }

    const choices = document.createElement("div");
    choices.className = "criteria-choices";

    const btnA = document.createElement("button");
    btnA.textContent = current.a.Name || "Task A";
    btnA.addEventListener("click", () => decideCriterion(criterion.key, "a"));

    const btnTie = document.createElement("button");
    btnTie.className = "tie-btn";
    btnTie.textContent = "Tie";
    btnTie.addEventListener("click", () => decideCriterion(criterion.key, "tie"));

    const btnB = document.createElement("button");
    btnB.textContent = current.b.Name || "Task B";
    btnB.addEventListener("click", () => decideCriterion(criterion.key, "b"));

    choices.append(btnA, btnTie, btnB);
    row.appendChild(choices);
    row.appendChild(document.createElement("div"));
    return row;
  }

  function decideCriterion(criterionKey, choice) {
    current.decided[criterionKey] = choice;
    const scoreA = ensureScore(current.a.Id);
    const scoreB = ensureScore(current.b.Id);
    if (choice === "a") scoreA[criterionKey] += 1;
    else if (choice === "b") scoreB[criterionKey] += 1;
    else {
      scoreA[criterionKey] += 0.5;
      scoreB[criterionKey] += 0.5;
    }
    saveScores();
    renderMatchup();
    renderRankings();

    if (CRITERIA.every((c) => current.decided[c.key])) {
      comparisonsMade += 1;
      setTimeout(nextPair, 500);
    }
  }

  function nextPair() {
    current = pickPair();
    renderMatchup();
    progressEl.textContent = `${comparisonsMade} comparison${comparisonsMade === 1 ? "" : "s"} completed`;
  }

  function renderRankings() {
    const rows = tasks
      .map((task) => {
        const s = ensureScore(task.Id);
        const total = CRITERIA.reduce((sum, c) => sum + s[c.key], 0);
        return { task, s, total };
      })
      .sort((a, b) => b.total - a.total);

    rankingsBody.innerHTML = "";
    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(row.task.Name || "(untitled task)")}</td>
        <td>${row.s.Importance}</td>
        <td>${row.s.Urgency}</td>
        <td>${row.s.FinancialReward}</td>
        <td>${row.s.FinancialCost}</td>
        <td><strong>${row.total}</strong></td>
      `;
      rankingsBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all ranking scores?")) return;
    scores = {};
    saveScores();
    comparisonsMade = 0;
    renderRankings();
    nextPair();
  });

  skipBtn.addEventListener("click", nextPair);

  tasks = DB.getTasks().filter((t) => !t.UtcDone);
  loadScores();

  if (tasks.length < 2) {
    noTasksEl.hidden = false;
  } else {
    nextPair();
    renderRankings();
  }
})();
