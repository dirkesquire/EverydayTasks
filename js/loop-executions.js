(async function () {
  const user = await Auth.requireUser();
  if (!user) return;
  DB.init(user);
  await DB.ensureSeeded();

  const params = new URLSearchParams(window.location.search);
  const loopId = params.get("id");
  let loop = loopId ? DB.getLoopById(loopId) : null;

  if (!loop) {
    window.location.href = "loop-dashboard.html";
    return;
  }

  const loopNameEl = document.getElementById("loop-name");
  const loopNotesEl = document.getElementById("loop-notes");
  const loopScopeEl = document.getElementById("loop-scope");
  const deleteLoopBtn = document.getElementById("delete-loop-btn");
  const listEl = document.getElementById("executions-list");
  const listEmptyEl = document.getElementById("executions-empty");
  const newExecBtn = document.getElementById("new-execution-btn");
  const noSelectionEl = document.getElementById("no-selection");
  const detailEl = document.getElementById("execution-detail");
  const dateLabelEl = document.getElementById("exec-date-label");
  const timerDisplayEl = document.getElementById("timer-display");
  const timerMetaEl = document.getElementById("timer-meta");
  const startBtn = document.getElementById("start-timer-btn");
  const stopBtn = document.getElementById("stop-timer-btn");
  const execNotesEl = document.getElementById("exec-notes");
  const execNotesNextEl = document.getElementById("exec-notes-next");
  const deleteExecBtn = document.getElementById("delete-exec-btn");
  const deleteExecDialog = document.getElementById("delete-exec-confirm-dialog");
  const deleteExecCancel = document.getElementById("delete-exec-confirm-cancel");
  const deleteExecOk = document.getElementById("delete-exec-confirm-ok");
  const stopTimerDialog = document.getElementById("stop-timer-dialog");
  const stopTimerHoursEl = document.getElementById("stop-timer-hours");
  const stopTimerCancel = document.getElementById("stop-timer-cancel");
  const stopTimerConfirm = document.getElementById("stop-timer-confirm");

  let selectedId = null;
  let tickHandle = null;
  let stoppingId = null;

  function populateLoopFields() {
    loopNameEl.value = loop.ShortName || "";
    loopNotesEl.value = loop.Notes || "";
    loopScopeEl.value = loop.ScopeId || "";
  }

  function populateScopeOptions(scopes) {
    loopScopeEl.innerHTML = '<option value="">(No scope)</option>';
    for (const scope of scopes) {
      const option = document.createElement("option");
      option.value = scope.id;
      option.textContent = scope.name;
      loopScopeEl.appendChild(option);
    }
    // The loop's scope may have been soft-deleted since it was assigned; keep it
    // selectable so saving the form doesn't silently clear it.
    if (loop.ScopeId && !scopes.some((s) => s.id === loop.ScopeId)) {
      const option = document.createElement("option");
      option.value = loop.ScopeId;
      option.textContent = "(deleted scope)";
      loopScopeEl.appendChild(option);
    }
    loopScopeEl.value = loop.ScopeId || "";
  }

  loopNameEl.addEventListener("change", async () => {
    loop.ShortName = loopNameEl.value.trim() || "";
    await DB.upsertLoop(loop);
  });

  loopNotesEl.addEventListener("change", async () => {
    loop.Notes = loopNotesEl.value;
    await DB.upsertLoop(loop);
  });

  loopScopeEl.addEventListener("change", async () => {
    loop.ScopeId = loopScopeEl.value || null;
    await DB.upsertLoop(loop);
  });

  deleteLoopBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${loop.ShortName || "this loop"}" and all its executions? This cannot be undone.`)) return;
    await DB.deleteLoop(loop.Id);
    window.location.href = "loop-dashboard.html";
  });

  function totalSeconds(execution) {
    const base = execution.UtcDurationSeconds || 0;
    if (!execution.UtcStartTime) return base;
    return base + (Date.now() - new Date(execution.UtcStartTime).getTime()) / 1000;
  }

  function formatHours(seconds) {
    return `${(seconds / 3600).toFixed(2)} h`;
  }

  function renderList() {
    const executions = DB.getLoopExecutions({ loopId: loop.Id }).sort(
      (a, b) => new Date(b.UtcDate) - new Date(a.UtcDate)
    );

    listEl.innerHTML = "";
    listEmptyEl.hidden = executions.length > 0;

    for (const execution of executions) {
      const row = document.createElement("div");
      row.className = "exec-row" + (execution.Id === selectedId ? " is-selected" : "");
      row.addEventListener("click", () => selectExecution(execution.Id));

      const leftGroup = document.createElement("div");
      leftGroup.className = "exec-row-left";

      const dateSpan = document.createElement("span");
      dateSpan.textContent = formatDate(execution.UtcDate);
      leftGroup.appendChild(dateSpan);

      if (execution.UtcStartTime) {
        const runningPill = document.createElement("span");
        runningPill.className = "pill pill-running";
        runningPill.textContent = "Started";
        leftGroup.appendChild(runningPill);
      }

      row.appendChild(leftGroup);

      const durationSpan = document.createElement("span");
      durationSpan.className = "exec-row-duration";
      durationSpan.textContent = formatHours(totalSeconds(execution));
      row.appendChild(durationSpan);

      listEl.appendChild(row);
    }
  }

  function stopTicking() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function updateTimerDisplay(execution) {
    timerDisplayEl.textContent = formatHours(totalSeconds(execution));
    if (!execution.UtcStartTime) return;
    const elapsedSeconds = (Date.now() - new Date(execution.UtcStartTime).getTime()) / 1000;
    timerMetaEl.textContent =
      `Started at ${formatTime(execution.UtcStartTime)} · ` +
      `${formatHours(execution.UtcDurationSeconds || 0)} already logged · ` +
      `${formatHours(elapsedSeconds)} elapsed`;
  }

  function renderDetail() {
    const execution = selectedId ? DB.getLoopExecutionById(selectedId) : null;
    stopTicking();

    if (!execution) {
      noSelectionEl.hidden = false;
      detailEl.hidden = true;
      return;
    }

    noSelectionEl.hidden = true;
    detailEl.hidden = false;

    dateLabelEl.textContent = formatDate(execution.UtcDate);
    execNotesEl.value = execution.Notes || "";
    execNotesNextEl.value = execution.NotesForNextLoop || "";

    const isRunning = !!execution.UtcStartTime;
    startBtn.hidden = isRunning;
    stopBtn.hidden = !isRunning;
    timerMetaEl.hidden = !isRunning;

    updateTimerDisplay(execution);
    if (isRunning) {
      tickHandle = setInterval(() => updateTimerDisplay(execution), 1000);
    }
  }

  function selectExecution(id) {
    selectedId = id;
    renderList();
    renderDetail();
  }

  newExecBtn.addEventListener("click", async () => {
    const execution = await DB.createLoopExecution({ LoopId: loop.Id });
    selectExecution(execution.Id);
  });

  startBtn.addEventListener("click", async () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.UtcStartTime = new Date().toISOString();
    await DB.upsertLoopExecution(execution);
    renderList();
    renderDetail();
  });

  stopBtn.addEventListener("click", () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution || !execution.UtcStartTime) return;
    stoppingId = selectedId;
    const elapsedHours = (Date.now() - new Date(execution.UtcStartTime).getTime()) / 1000 / 3600;
    stopTimerHoursEl.value = elapsedHours.toFixed(2);
    stopTimerDialog.showModal();
  });

  stopTimerCancel.addEventListener("click", () => {
    stoppingId = null;
    stopTimerDialog.close();
  });

  stopTimerConfirm.addEventListener("click", async () => {
    const execution = stoppingId ? DB.getLoopExecutionById(stoppingId) : null;
    stopTimerDialog.close();
    if (!execution) return;
    const hoursToAdd = Math.max(0, parseFloat(stopTimerHoursEl.value) || 0);
    execution.UtcDurationSeconds = (execution.UtcDurationSeconds || 0) + hoursToAdd * 3600;
    execution.UtcStartTime = null;
    stoppingId = null;
    await DB.upsertLoopExecution(execution);
    renderList();
    renderDetail();
  });

  execNotesEl.addEventListener("change", async () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.Notes = execNotesEl.value;
    await DB.upsertLoopExecution(execution);
  });

  execNotesNextEl.addEventListener("change", async () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.NotesForNextLoop = execNotesNextEl.value;
    await DB.upsertLoopExecution(execution);
  });

  deleteExecBtn.addEventListener("click", () => {
    if (!selectedId) return;
    deleteExecDialog.showModal();
  });

  deleteExecCancel.addEventListener("click", () => deleteExecDialog.close());

  deleteExecOk.addEventListener("click", async () => {
    deleteExecDialog.close();
    if (!selectedId) return;
    await DB.deleteLoopExecution(selectedId);
    selectedId = null;
    renderList();
    renderDetail();
  });

  populateLoopFields();
  renderList();
  renderDetail();
  ScopeFilter.load().then(populateScopeOptions);
})();
