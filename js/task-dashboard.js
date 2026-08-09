(async function () {
  await DB.ensureSeeded();

  const listEl = document.getElementById("task-list");
  const emptyEl = document.getElementById("empty-state");
  const showDoneEl = document.getElementById("show-done");
  const addBtn = document.getElementById("add-task-btn");

  function sumRewards(task) {
    const financial = task.Rewards.filter((r) => r.RewardType === "financial").length;
    const other = task.Rewards.length - financial;
    return { financial, other };
  }

  function render() {
    const tasks = DB.getTasks()
      .filter((t) => showDoneEl.checked || !t.UtcDone)
      .sort((a, b) => {
        // Undated tasks sink to the bottom; otherwise earliest due date first.
        if (!a.DueDate && !b.DueDate) return 0;
        if (!a.DueDate) return 1;
        if (!b.DueDate) return -1;
        return new Date(a.DueDate) - new Date(b.DueDate);
      });

    listEl.innerHTML = "";
    emptyEl.hidden = tasks.length > 0;

    for (const task of tasks) {
      const card = document.createElement("div");
      card.className = "task-card" + (task.UtcDone ? " is-done" : "");
      card.addEventListener("click", () => {
        window.location.href = `task-edit.html?id=${encodeURIComponent(task.Id)}`;
      });

      const main = document.createElement("div");
      main.className = "task-main";

      const name = document.createElement("div");
      name.className = "task-name";
      name.textContent = task.Name || "(untitled task)";
      main.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "task-meta";
      const { financial, other } = sumRewards(task);
      if (financial) meta.appendChild(makePill(`${financial} financial reward${financial > 1 ? "s" : ""}`, "financial"));
      if (other) meta.appendChild(makePill(`${other} reward${other > 1 ? "s" : ""}`, "other"));
      if (task.Cost.length) meta.appendChild(makePill(`${task.Cost.length} cost${task.Cost.length > 1 ? "s" : ""}`, "other"));
      if (task.Reminders.length) meta.appendChild(makePill(`${task.Reminders.length} reminder${task.Reminders.length > 1 ? "s" : ""}`, "other"));
      if (task.UtcDone) meta.appendChild(makePill("Done", "financial"));
      main.appendChild(meta);

      card.appendChild(main);

      const side = document.createElement("div");
      side.className = "task-side";
      side.appendChild(renderDateBadge(task.DueDate));
      card.appendChild(side);

      listEl.appendChild(card);
    }
  }

  function makePill(text, kind) {
    const span = document.createElement("span");
    span.className = `pill pill-${kind}`;
    span.textContent = text;
    return span;
  }

  showDoneEl.addEventListener("change", render);
  addBtn.addEventListener("click", () => {
    const task = DB.createTask({ Name: "New task" });
    window.location.href = `task-edit.html?id=${encodeURIComponent(task.Id)}`;
  });

  render();
})();
