// Thin localStorage-backed data layer, seeded from /data/*.json on first run.
const DB = (() => {
  const KEYS = {
    users: "tasktracker.users",
    tasks: "tasktracker.tasks",
    loops: "tasktracker.loops",
    loopExecutions: "tasktracker.loopExecutions",
  };

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function ensureSeeded() {
    if (!localStorage.getItem(KEYS.users) || !localStorage.getItem(KEYS.tasks)) {
      const [users, tasks] = await Promise.all([
        fetchJson("data/users.json"),
        fetchJson("data/tasks.json"),
      ]);
      if (!localStorage.getItem(KEYS.users)) localStorage.setItem(KEYS.users, JSON.stringify(users));
      if (!localStorage.getItem(KEYS.tasks)) localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
    }
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem(KEYS.users) || "[]");
  }

  function getCurrentUser() {
    return getUsers()[0] || null;
  }

  function getTasks({ includeDeleted = false } = {}) {
    const tasks = JSON.parse(localStorage.getItem(KEYS.tasks) || "[]");
    return includeDeleted ? tasks : tasks.filter((t) => !t.UtcDeleted);
  }

  function getTaskById(id) {
    return getTasks({ includeDeleted: true }).find((t) => t.Id === id) || null;
  }

  function saveTasks(tasks) {
    localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
  }

  function upsertTask(task) {
    const tasks = getTasks({ includeDeleted: true });
    const idx = tasks.findIndex((t) => t.Id === task.Id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.push(task);
    saveTasks(tasks);
    return task;
  }

  function createTask(partial) {
    const user = getCurrentUser();
    const task = {
      Id: uuid(),
      Name: "",
      DueDate: null,
      PreparationNeeded: null,
      Reminders: [],
      Rewards: [],
      Consequences: [],
      Notes: "",
      UserId: user ? user.Id : null,
      UtcDone: null,
      UtcCreated: new Date().toISOString(),
      UtcDeleted: null,
      ...partial,
    };
    return upsertTask(task);
  }

  // Writes UtcLastSorted/Score onto many Rewards/Consequences in a single pass, since one
  // drag re-scores every ranked row. Each update is
  // { taskId, collection: "Rewards"|"Consequences", itemId, UtcLastSorted, Score }.
  function applyRankingUpdates(updates) {
    const tasks = getTasks({ includeDeleted: true });
    const byTaskId = new Map(tasks.map((t) => [t.Id, t]));
    for (const update of updates) {
      const task = byTaskId.get(update.taskId);
      if (!task) continue;
      const item = (task[update.collection] || []).find((i) => i.Id === update.itemId);
      if (!item) continue;
      item.UtcLastSorted = update.UtcLastSorted;
      item.Score = update.Score;
    }
    saveTasks(tasks);
  }

  function softDeleteTask(id) {
    const task = getTaskById(id);
    if (!task) return;
    task.UtcDeleted = new Date().toISOString();
    upsertTask(task);
  }

  // --- Loops ---

  function getLoops() {
    return JSON.parse(localStorage.getItem(KEYS.loops) || "[]");
  }

  function saveLoops(loops) {
    localStorage.setItem(KEYS.loops, JSON.stringify(loops));
  }

  function getLoopById(id) {
    return getLoops().find((l) => l.Id === id) || null;
  }

  function upsertLoop(loop) {
    const loops = getLoops();
    const idx = loops.findIndex((l) => l.Id === loop.Id);
    if (idx >= 0) loops[idx] = loop;
    else loops.push(loop);
    saveLoops(loops);
    return loop;
  }

  function createLoop(partial) {
    const loops = getLoops();
    const maxSequence = loops.reduce((max, l) => Math.max(max, l.Sequence || 0), 0);
    const loop = {
      Id: uuid(),
      ShortName: "New loop",
      Notes: "",
      Sequence: maxSequence + 1,
      ...partial,
    };
    return upsertLoop(loop);
  }

  function deleteLoop(id) {
    saveLoops(getLoops().filter((l) => l.Id !== id));
    saveLoopExecutions(getLoopExecutions().filter((e) => e.LoopId !== id));
  }

  // --- Loop executions ---

  function getLoopExecutions({ loopId } = {}) {
    const executions = JSON.parse(localStorage.getItem(KEYS.loopExecutions) || "[]");
    return loopId ? executions.filter((e) => e.LoopId === loopId) : executions;
  }

  function saveLoopExecutions(executions) {
    localStorage.setItem(KEYS.loopExecutions, JSON.stringify(executions));
  }

  function getLoopExecutionById(id) {
    return getLoopExecutions().find((e) => e.Id === id) || null;
  }

  function upsertLoopExecution(execution) {
    const executions = getLoopExecutions();
    const idx = executions.findIndex((e) => e.Id === execution.Id);
    if (idx >= 0) executions[idx] = execution;
    else executions.push(execution);
    saveLoopExecutions(executions);
    return execution;
  }

  function createLoopExecution(partial) {
    const execution = {
      Id: uuid(),
      LoopId: null,
      UtcDate: new Date().toISOString(),
      UtcStartTime: null,
      UtcDurationSeconds: 0,
      Notes: "",
      NotesForNextLoop: "",
      ...partial,
    };
    return upsertLoopExecution(execution);
  }

  function deleteLoopExecution(id) {
    saveLoopExecutions(getLoopExecutions().filter((e) => e.Id !== id));
  }

  // Loops joined with their most recent execution (by UtcDate), for the dashboard list.
  function getLoopsWithLastExecution() {
    const executions = getLoopExecutions();
    return getLoops().map((loop) => {
      const forLoop = executions.filter((e) => e.LoopId === loop.Id);
      const last = forLoop.reduce(
        (latest, e) => (!latest || new Date(e.UtcDate) > new Date(latest.UtcDate) ? e : latest),
        null
      );
      return { ...loop, lastExecution: last };
    });
  }

  return {
    uuid,
    ensureSeeded,
    getUsers,
    getCurrentUser,
    getTasks,
    getTaskById,
    saveTasks,
    upsertTask,
    createTask,
    applyRankingUpdates,
    softDeleteTask,
    getLoops,
    getLoopById,
    upsertLoop,
    createLoop,
    deleteLoop,
    getLoopExecutions,
    getLoopExecutionById,
    upsertLoopExecution,
    createLoopExecution,
    deleteLoopExecution,
    getLoopsWithLastExecution,
  };
})();
