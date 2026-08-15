(async function () {
  const user = await Auth.requireUser();
  if (!user) return;
  DB.init(user);
  await DB.ensureSeeded();

  const COLLECTIONS = ["Rewards", "Consequences"];

  // Flattens every live, in-scope task's Rewards/Consequences into one rankable list.
  function collectRows(collection) {
    const rows = [];
    for (const task of DB.getTasks()) {
      if (task.UtcDone) continue;
      if (!ScopeFilter.isVisible(task.ScopeId)) continue;
      for (const item of task[collection] || []) {
        rows.push({ item, task });
      }
    }
    return rows;
  }

  // Ranked rows carry a UtcLastSorted stamp; the rest wait in the holding area.
  // Score holds the ranking itself — highest first, 0 at the bottom.
  function partitionRows(collection) {
    const rows = collectRows(collection);
    const ranked = rows.filter((r) => r.item.UtcLastSorted);
    const holding = rows.filter((r) => !r.item.UtcLastSorted);

    ranked.sort((a, b) => {
      const sa = typeof a.item.Score === "number" ? a.item.Score : -Infinity;
      const sb = typeof b.item.Score === "number" ? b.item.Score : -Infinity;
      if (sa !== sb) return sb - sa;
      // Stamped but unscored: most recently sorted first.
      return new Date(b.item.UtcLastSorted) - new Date(a.item.UtcLastSorted);
    });

    return { ranked, holding };
  }

  const TRASH_FREE_TASK_ICON = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </svg>`;

  function buildRow({ item, task }, score) {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.draggable = true;
    row.dataset.id = item.Id;
    row.dataset.taskId = task.Id;

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "Drag to re-order";

    const value = document.createElement("span");
    value.className = "rank-value";
    value.textContent = item.Value;

    const taskName = document.createElement("span");
    taskName.className = "rank-task";
    taskName.textContent = task.Name || "(untitled task)";

    const scoreEl = document.createElement("span");
    scoreEl.className = "rank-score-col";
    // Unranked rows deliberately show nothing, so an unscored row can't read as a zero.
    scoreEl.textContent = score === null ? "" : String(score);

    const link = document.createElement("a");
    link.className = "rank-edit";
    link.href = `task-edit.html?id=${encodeURIComponent(task.Id)}&from=ranker2`;
    link.title = `Edit "${task.Name || "task"}"`;
    link.setAttribute("aria-label", `Edit ${task.Name || "task"}`);
    link.draggable = false;
    link.innerHTML = TRASH_FREE_TASK_ICON;
    link.addEventListener("click", (e) => e.stopPropagation());

    row.append(handle, value, taskName, scoreEl, link);
    return row;
  }

  function emptyMessage(text) {
    const div = document.createElement("div");
    div.className = "rank-empty";
    div.textContent = text;
    return div;
  }

  function renderPanel(collection) {
    const { ranked, holding } = partitionRows(collection);
    const rankedZone = document.querySelector(`[data-zone="ranked"][data-collection="${collection}"]`);
    const holdingZone = document.querySelector(`[data-zone="holding"][data-collection="${collection}"]`);

    rankedZone.innerHTML = "";
    holdingZone.innerHTML = "";

    // Top row scores highest, the last ranked row scores 0.
    ranked.forEach((row, i) => rankedZone.appendChild(buildRow(row, ranked.length - 1 - i)));
    holding.forEach((row) => holdingZone.appendChild(buildRow(row, null)));

    if (!ranked.length) rankedZone.appendChild(emptyMessage("Nothing ranked yet — drag a row up from below."));
    if (!holding.length) holdingZone.appendChild(emptyMessage("Everything has been ranked."));
  }

  /* ---------- drag and drop ---------- */

  let draggingEl = null;

  // Which row sits immediately after the pointer, so the dragged row can slot in before it.
  function getRowAfter(zone, y) {
    const rows = Array.from(zone.querySelectorAll(".rank-row:not(.dragging)"));
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = row;
      }
    }
    return closest;
  }

  function finishDrag() {
    if (!draggingEl) return;
    const row = draggingEl;
    draggingEl = null;
    row.classList.remove("dragging");
    document.body.classList.remove("is-dragging");

    const zone = row.closest(".rank-zone");
    if (!zone) return;
    const collection = zone.dataset.collection;
    const nowIso = new Date().toISOString();
    const stampByItemId = new Map(collectRows(collection).map((r) => [r.item.Id, r.item.UtcLastSorted]));

    // One drop shifts everything below it, so re-score the whole ranked list.
    const rankedZone = document.querySelector(`[data-zone="ranked"][data-collection="${collection}"]`);
    const rankedEls = Array.from(rankedZone.querySelectorAll(".rank-row"));
    const updates = rankedEls.map((el, i) => ({
      taskId: el.dataset.taskId,
      collection,
      itemId: el.dataset.id,
      // Only the row that just moved gets a fresh stamp.
      UtcLastSorted: el === row ? nowIso : stampByItemId.get(el.dataset.id) || nowIso,
      Score: rankedEls.length - 1 - i,
    }));

    // Dropped back into the holding area: clear both, pulling it out of scoring.
    if (zone.dataset.zone === "holding") {
      updates.push({
        taskId: row.dataset.taskId,
        collection,
        itemId: row.dataset.id,
        UtcLastSorted: null,
        Score: null,
      });
    }

    DB.applyRankingUpdates(updates);
    renderPanel(collection);
  }

  document.addEventListener("dragstart", (e) => {
    const row = e.target.closest?.(".rank-row");
    if (!row || row.classList.contains("rank-header")) return;
    draggingEl = row;
    row.classList.add("dragging");
    document.body.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag without payload on the transfer.
    e.dataTransfer.setData("text/plain", row.dataset.id);
  });

  document.addEventListener("dragend", finishDrag);

  for (const zone of document.querySelectorAll(".rank-zone")) {
    zone.addEventListener("dragover", (e) => {
      if (!draggingEl || draggingEl.closest(".rank-zone")?.dataset.collection !== zone.dataset.collection) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const after = getRowAfter(zone, e.clientY);
      if (after) zone.insertBefore(draggingEl, after);
      else zone.appendChild(draggingEl);
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      finishDrag();
    });
  }

  /* ---------- tabs ---------- */

  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".tab-btn")) {
        const isActive = other === btn;
        other.classList.toggle("active", isActive);
        other.setAttribute("aria-selected", String(isActive));
      }
      for (const panel of document.querySelectorAll(".tab-panel")) {
        panel.hidden = panel.dataset.panel !== btn.dataset.tab;
      }
    });
  }

  ScopeFilter.onChange(() => COLLECTIONS.forEach(renderPanel));
  await ScopeFilter.load();
})();
