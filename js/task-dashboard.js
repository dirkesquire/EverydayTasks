(async function () {
  const user = await Auth.requireUser();
  if (!user) return;
  DB.init(user);
  await DB.ensureSeeded();

  const tbody = document.getElementById("task-tbody");
  const table = document.getElementById("tasks-table");
  const emptyEl = document.getElementById("empty-state");
  const showDoneEl = document.getElementById("show-done");
  const addBtn = document.getElementById("add-task-btn");

  let sortKey = "totalScore";
  let sortDir = -1;

  const COMPARATORS = {
    name: (t) => (t.Name || "").toLowerCase(),
    dueDate: (t) => (t.DueDate ? new Date(t.DueDate).getTime() : null),
    rewardScore: (t) => t.RewardScore || 0,
    consequenceScore: (t) => t.ConsequenceScore || 0,
    urgencyScore: (t) => t.UrgencyScore || 0,
    totalScore: (t) => t.TotalScore || 0,
  };

  function compareValues(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === "string") return a.localeCompare(b);
    return a - b;
  }

  function render() {
    const getValue = COMPARATORS[sortKey];
    const tasks = DB.getTasks()
      .filter((t) => showDoneEl.checked || !t.UtcDone)
      .filter((t) => ScopeFilter.isVisible(t.ScopeId))
      .sort((a, b) => compareValues(getValue(a), getValue(b)) * sortDir);

    tbody.innerHTML = "";
    emptyEl.hidden = tasks.length > 0;
    table.hidden = tasks.length === 0;

    for (const task of tasks) {
      const tr = document.createElement("tr");
      tr.className = "row-clickable" + (task.UtcDone ? " is-done" : "");
      tr.addEventListener("click", () => {
        window.location.href = `task-edit.html?id=${encodeURIComponent(task.Id)}&from=dashboard`;
      });

      const nameTd = document.createElement("td");
      nameTd.textContent = task.Name || "(untitled task)";
      tr.appendChild(nameTd);

      const dueTd = document.createElement("td");
      dueTd.appendChild(renderDateBadge(task.DueDate));
      tr.appendChild(dueTd);

      tr.appendChild(scoreCell(task.RewardScore));
      tr.appendChild(scoreCell(task.ConsequenceScore));
      tr.appendChild(scoreCell(task.UrgencyScore));

      const totalTd = document.createElement("td");
      totalTd.className = "total-score-cell";
      totalTd.textContent = task.TotalScore || 0;
      tr.appendChild(totalTd);

      tbody.appendChild(tr);
    }

    table.querySelectorAll("th.sortable").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === sortKey);
      th.dataset.dir = th.dataset.sort === sortKey ? (sortDir === 1 ? "asc" : "desc") : "";
    });
  }

  function scoreCell(value) {
    const td = document.createElement("td");
    td.textContent = value || 0;
    return td;
  }

  table.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      if (sortKey === th.dataset.sort) {
        sortDir *= -1;
      } else {
        sortKey = th.dataset.sort;
        sortDir = 1;
      }
      render();
    });
  });

  showDoneEl.addEventListener("change", render);
  addBtn.addEventListener("click", () => {
    const task = DB.createTask({ Name: "New task" });
    window.location.href = `task-edit.html?id=${encodeURIComponent(task.Id)}&from=dashboard`;
  });

  ScopeFilter.onChange(render);
  await ScopeFilter.load();
})();
