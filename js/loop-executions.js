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
  const deleteLoopBtn = document.getElementById("delete-loop-btn");
  const listEl = document.getElementById("executions-list");
  const listEmptyEl = document.getElementById("executions-empty");
  const newExecBtn = document.getElementById("new-execution-btn");
  const noSelectionEl = document.getElementById("no-selection");
  const detailEl = document.getElementById("execution-detail");
  const dateLabelEl = document.getElementById("exec-date-label");
  const timerDisplayEl = document.getElementById("timer-display");
  const startBtn = document.getElementById("start-timer-btn");
  const stopBtn = document.getElementById("stop-timer-btn");
  const execNotesEl = document.getElementById("exec-notes");
  const execNotesNextEl = document.getElementById("exec-notes-next");
  const deleteExecBtn = document.getElementById("delete-exec-btn");

  let selectedId = null;
  let tickHandle = null;

  function populateLoopFields() {
    loopNameEl.value = loop.ShortName || "";
    loopNotesEl.value = loop.Notes || "";
  }

  loopNameEl.addEventListener("change", () => {
    loop.ShortName = loopNameEl.value.trim() || "";
    DB.upsertLoop(loop);
  });

  loopNotesEl.addEventListener("change", () => {
    loop.Notes = loopNotesEl.value;
    DB.upsertLoop(loop);
  });

  deleteLoopBtn.addEventListener("click", () => {
    if (!confirm(`Delete "${loop.ShortName || "this loop"}" and all its executions? This cannot be undone.`)) return;
    DB.deleteLoop(loop.Id);
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

      const dateSpan = document.createElement("span");
      dateSpan.textContent = formatDate(execution.UtcDate);
      row.appendChild(dateSpan);

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

    timerDisplayEl.textContent = formatHours(totalSeconds(execution));
    if (isRunning) {
      tickHandle = setInterval(() => {
        timerDisplayEl.textContent = formatHours(totalSeconds(execution));
      }, 1000);
    }
  }

  function selectExecution(id) {
    selectedId = id;
    renderList();
    renderDetail();
  }

  newExecBtn.addEventListener("click", () => {
    const execution = DB.createLoopExecution({ LoopId: loop.Id });
    selectExecution(execution.Id);
  });

  startBtn.addEventListener("click", () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.UtcStartTime = new Date().toISOString();
    DB.upsertLoopExecution(execution);
    renderList();
    renderDetail();
  });

  stopBtn.addEventListener("click", () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution || !execution.UtcStartTime) return;
    const elapsedSeconds = (Date.now() - new Date(execution.UtcStartTime).getTime()) / 1000;
    execution.UtcDurationSeconds = (execution.UtcDurationSeconds || 0) + elapsedSeconds;
    execution.UtcStartTime = null;
    DB.upsertLoopExecution(execution);
    renderList();
    renderDetail();
  });

  execNotesEl.addEventListener("change", () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.Notes = execNotesEl.value;
    DB.upsertLoopExecution(execution);
  });

  execNotesNextEl.addEventListener("change", () => {
    const execution = DB.getLoopExecutionById(selectedId);
    if (!execution) return;
    execution.NotesForNextLoop = execNotesNextEl.value;
    DB.upsertLoopExecution(execution);
  });

  deleteExecBtn.addEventListener("click", () => {
    if (!selectedId) return;
    if (!confirm("Delete this execution? This cannot be undone.")) return;
    DB.deleteLoopExecution(selectedId);
    selectedId = null;
    renderList();
    renderDetail();
  });

  populateLoopFields();
  renderList();
  renderDetail();
})();
