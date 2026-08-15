(async function () {
  const user = await Auth.requireUser();
  if (!user) return;
  DB.init(user);
  await DB.ensureSeeded();

  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("id");
  let task = taskId ? DB.getTaskById(taskId) : null;

  if (!task) {
    task = DB.createTask({ Name: "" });
    const url = new URL(window.location.href);
    url.searchParams.set("id", task.Id);
    window.history.replaceState({}, "", url);
  }

  const form = document.getElementById("task-form");
  const nameEl = document.getElementById("name");
  const dueDateEl = document.getElementById("due-date");
  const doneEl = document.getElementById("done-checkbox");
  const prepValueEl = document.getElementById("prep-value");
  const prepUnitEl = document.getElementById("prep-unit");
  const prepPreviewEl = document.getElementById("prep-preview");
  const notesEl = document.getElementById("notes");
  const remindersListEl = document.getElementById("reminders-list");
  const rewardsListEl = document.getElementById("rewards-list");
  const consequencesListEl = document.getElementById("consequences-list");
  const deleteBtn = document.getElementById("delete-btn");
  const saveBanner = document.getElementById("save-banner");
  const backLink = document.getElementById("back-link");
  const cancelLink = document.getElementById("cancel-link");

  // Came here from a ranker? Send Back/Cancel/Delete there instead of always to the dashboard.
  const BACK_TARGETS = { ranker: "task-ranker.html", ranker2: "task-ranker2.html" };
  const backTarget = BACK_TARGETS[params.get("from")] || "task-dashboard.html";
  backLink.href = backTarget;
  cancelLink.href = backTarget;

  // datetime-local inputs work in local wall-clock time with no timezone,
  // so convert to/from ISO manually rather than via Date's UTC methods.
  function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localInputToIso(value) {
    if (!value) return null;
    return new Date(value).toISOString();
  }

  function populateForm() {
    nameEl.value = task.Name || "";
    dueDateEl.value = isoToLocalInput(task.DueDate);
    doneEl.checked = !!task.UtcDone;
    notesEl.value = task.Notes || "";
    prepValueEl.value = task.PreparationNeeded ? Math.abs(task.PreparationNeeded.value) : "";
    prepUnitEl.value = task.PreparationNeeded ? task.PreparationNeeded.unit : "day";
    updatePrepPreview();

    remindersListEl.innerHTML = "";
    (task.Reminders || []).forEach((iso) => addReminderRow(iso));

    rewardsListEl.innerHTML = "";
    (task.Rewards || []).forEach((r) => addRewardRow(r));

    consequencesListEl.innerHTML = "";
    (task.Consequences || []).forEach((c) => addConsequenceRow(c));
  }

  function updatePrepPreview() {
    const value = parseInt(prepValueEl.value, 10);
    if (!value) {
      prepPreviewEl.textContent = "";
      return;
    }
    prepPreviewEl.textContent = `Start preparing ${formatPreparation({ value: -value, unit: prepUnitEl.value })} due date.`;
  }

  function addReminderRow(iso) {
    const tpl = document.getElementById("reminder-row-template");
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="reminder"]').value = isoToLocalInput(iso);
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    remindersListEl.appendChild(row);
  }

  function addRewardRow(reward) {
    const tpl = document.getElementById("reward-row-template");
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="type"]').value = reward?.RewardType || "other";
    row.querySelector('[data-field="value"]').value = reward?.Value || "";
    row.dataset.id = reward?.Id || DB.uuid();
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    rewardsListEl.appendChild(row);
  }

  function addConsequenceRow(consequence) {
    const tpl = document.getElementById("consequence-row-template");
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="type"]').value = consequence?.Consequence || "other";
    row.querySelector('[data-field="value"]').value = consequence?.Value || "";
    row.dataset.id = consequence?.Id || DB.uuid();
    row.querySelector("[data-remove]").addEventListener("click", () => row.remove());
    consequencesListEl.appendChild(row);
  }

  document.getElementById("add-reminder").addEventListener("click", () => addReminderRow(null));
  document.getElementById("add-reward").addEventListener("click", () => addRewardRow(null));
  document.getElementById("add-consequence").addEventListener("click", () => addConsequenceRow(null));

  // Due date minus the preparation timespan, e.g. due date - 14 days.
  function subtractPreparation(dueLocalValue, value, unit) {
    const d = new Date(dueLocalValue);
    switch (unit) {
      case "hour": d.setHours(d.getHours() - value); break;
      case "day": d.setDate(d.getDate() - value); break;
      case "week": d.setDate(d.getDate() - value * 7); break;
      case "month": d.setMonth(d.getMonth() - value); break;
    }
    return d.toISOString();
  }

  document.getElementById("add-prep-reminder").addEventListener("click", () => {
    if (!dueDateEl.value) {
      alert("Set a due date first.");
      return;
    }
    const prepValue = parseInt(prepValueEl.value, 10);
    if (!prepValue) {
      alert("Set how far ahead preparation is needed first.");
      return;
    }
    addReminderRow(subtractPreparation(dueDateEl.value, prepValue, prepUnitEl.value));
  });
  prepValueEl.addEventListener("input", updatePrepPreview);
  prepUnitEl.addEventListener("change", updatePrepPreview);

  function collectReminders() {
    return Array.from(remindersListEl.querySelectorAll("[data-row]"))
      .map((row) => localInputToIso(row.querySelector('[data-field="reminder"]').value))
      .filter(Boolean);
  }

  // The ranker owns UtcLastSorted/Score, so carry them across from the stored item rather
  // than rebuilding rows from the form alone (which would silently reset every ranking).
  function collectItems(listEl, typeField, existingItems) {
    const rankingById = new Map((existingItems || []).map((item) => [item.Id, item]));
    return Array.from(listEl.querySelectorAll("[data-row]"))
      .map((row) => {
        const id = row.dataset.id || DB.uuid();
        const existing = rankingById.get(id);
        return {
          Id: id,
          [typeField]: row.querySelector('[data-field="type"]').value,
          Value: row.querySelector('[data-field="value"]').value.trim(),
          UtcLastSorted: existing?.UtcLastSorted ?? null,
          Score: existing?.Score ?? null,
        };
      })
      .filter((item) => item.Value);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    task.Name = nameEl.value.trim() || "(untitled task)";
    task.DueDate = localInputToIso(dueDateEl.value);
    task.UtcDone = doneEl.checked ? task.UtcDone || new Date().toISOString() : null;
    task.Notes = notesEl.value;
    const prepValue = parseInt(prepValueEl.value, 10);
    task.PreparationNeeded = prepValue ? { value: -Math.abs(prepValue), unit: prepUnitEl.value } : null;
    task.Reminders = collectReminders();
    task.Rewards = collectItems(rewardsListEl, "RewardType", task.Rewards);
    task.Consequences = collectItems(consequencesListEl, "Consequence", task.Consequences);

    DB.upsertTask(task);
    saveBanner.hidden = false;
    setTimeout(() => (saveBanner.hidden = true), 2000);
  });

  deleteBtn.addEventListener("click", () => {
    if (!confirm(`Delete "${task.Name || "this task"}"? This cannot be undone.`)) return;
    DB.softDeleteTask(task.Id);
    window.location.href = backTarget;
  });

  populateForm();
})();
