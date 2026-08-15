// Thin localStorage-backed data layer, seeded from /data/*.json on first run.
// Storage keys are scoped per signed-in user (see init()) so multiple Supabase
// accounts on the same browser don't see each other's data.
const DB = (() => {
  let userId = null;
  let userName = null;

  function keys() {
    if (!userId) throw new Error("DB.init(user) must be called before using DB.");
    return {
      tasks: `tasktracker.${userId}.tasks`,
      loops: `tasktracker.${userId}.loops`,
      loopExecutions: `tasktracker.${userId}.loopExecutions`,
    };
  }

  function init(user) {
    userId = user.id;
    userName = user.user_metadata?.name || user.email;
  }

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

  // New signed-in users start with the sample tasks from data/tasks.json, same as the
  // original single-user version of this app. Loops start empty (no seed file for those).
  async function ensureSeeded() {
    const KEYS = keys();
    if (!localStorage.getItem(KEYS.tasks)) {
      const tasks = await fetchJson("data/tasks.json");
      localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
    }
  }

  function getUsers() {
    return userId ? [getCurrentUser()] : [];
  }

  function getCurrentUser() {
    return userId ? { Id: userId, Name: userName } : null;
  }

  function getTasks({ includeDeleted = false } = {}) {
    const tasks = JSON.parse(localStorage.getItem(keys().tasks) || "[]");
    return includeDeleted ? tasks : tasks.filter((t) => !t.UtcDeleted);
  }

  function getTaskById(id) {
    return getTasks({ includeDeleted: true }).find((t) => t.Id === id) || null;
  }

  function saveTasks(tasks) {
    localStorage.setItem(keys().tasks, JSON.stringify(tasks));
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
      RewardScore: 0,
      ConsequenceScore: 0,
      UrgencyScore: 0,
      TotalScore: 0,
      ...partial,
    };
    return upsertTask(task);
  }

  // Highest Score among a task's Rewards/Consequences, ignoring not-yet-ranked
  // items (Score: null). Defaults to 0 when nothing has been ranked yet.
  function maxItemScore(items) {
    const scores = (items || []).map((i) => i.Score).filter((s) => typeof s === "number");
    return scores.length ? Math.max(...scores) : 0;
  }

  function recalculateTaskScores(task) {
    task.RewardScore = maxItemScore(task.Rewards);
    task.ConsequenceScore = maxItemScore(task.Consequences);
    task.TotalScore = task.RewardScore + task.ConsequenceScore + (task.UrgencyScore || 0);
  }

  // Writes UtcLastSorted/Score onto many Rewards/Consequences in a single pass, since one
  // drag re-scores every ranked row. Each update is
  // { taskId, collection: "Rewards"|"Consequences", itemId, UtcLastSorted, Score }.
  // Afterwards, every affected task's RewardScore/ConsequenceScore/TotalScore are recalculated.
  function applyRankingUpdates(updates) {
    const tasks = getTasks({ includeDeleted: true });
    const byTaskId = new Map(tasks.map((t) => [t.Id, t]));
    const affectedTaskIds = new Set();
    for (const update of updates) {
      const task = byTaskId.get(update.taskId);
      if (!task) continue;
      const item = (task[update.collection] || []).find((i) => i.Id === update.itemId);
      if (!item) continue;
      item.UtcLastSorted = update.UtcLastSorted;
      item.Score = update.Score;
      affectedTaskIds.add(task.Id);
    }
    for (const taskId of affectedTaskIds) {
      recalculateTaskScores(byTaskId.get(taskId));
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
    return JSON.parse(localStorage.getItem(keys().loops) || "[]");
  }

  function saveLoops(loops) {
    localStorage.setItem(keys().loops, JSON.stringify(loops));
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
    const executions = JSON.parse(localStorage.getItem(keys().loopExecutions) || "[]");
    return loopId ? executions.filter((e) => e.LoopId === loopId) : executions;
  }

  function saveLoopExecutions(executions) {
    localStorage.setItem(keys().loopExecutions, JSON.stringify(executions));
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
    init,
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
