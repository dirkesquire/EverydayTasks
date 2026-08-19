// Data layer backed by Supabase tables (task/loop/loop_execution), each RLS-scoped to
// auth.uid() so multiple accounts never see each other's rows. Reads are served from an
// in-memory cache populated by load()/ensureSeeded(); writes go through Supabase first and
// only update the cache once they succeed, so callers can treat getters as synchronous.
const DB = (() => {
  let userId = null;
  let tasks = [];
  let loops = [];
  let loopExecutions = [];
  let loadPromise = null;

  function init(user) {
    userId = user.id;
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

  // --- Row <-> app-object mapping (tables are snake_case, app objects stay PascalCase) ---

  function rowToTask(row) {
    return {
      Id: row.id,
      Name: row.name,
      DueDate: row.due_date,
      PreparationNeeded: row.preparation_needed,
      Reminders: row.reminders || [],
      Rewards: row.rewards || [],
      Consequences: row.consequences || [],
      Notes: row.notes || "",
      ScopeId: row.scope_id,
      UtcDone: row.utc_done,
      UtcCreated: row.utc_created,
      UtcDeleted: row.utc_deleted,
      RewardScore: row.reward_score || 0,
      ConsequenceScore: row.consequence_score || 0,
      UrgencyScore: row.urgency_score || 0,
      TotalScore: row.total_score || 0,
    };
  }

  function taskToRow(task) {
    return {
      id: task.Id,
      name: task.Name || "",
      due_date: task.DueDate,
      preparation_needed: task.PreparationNeeded,
      reminders: task.Reminders || [],
      rewards: task.Rewards || [],
      consequences: task.Consequences || [],
      notes: task.Notes || "",
      scope_id: task.ScopeId,
      utc_done: task.UtcDone,
      utc_created: task.UtcCreated,
      utc_deleted: task.UtcDeleted,
      reward_score: task.RewardScore || 0,
      consequence_score: task.ConsequenceScore || 0,
      urgency_score: task.UrgencyScore || 0,
      total_score: task.TotalScore || 0,
    };
  }

  function rowToLoop(row) {
    return {
      Id: row.id,
      ShortName: row.short_name || "",
      Notes: row.notes || "",
      ScopeId: row.scope_id,
      Sequence: row.sequence || 0,
    };
  }

  function loopToRow(loop) {
    return {
      id: loop.Id,
      short_name: loop.ShortName || "",
      notes: loop.Notes || "",
      scope_id: loop.ScopeId,
      sequence: loop.Sequence || 0,
    };
  }

  function rowToExecution(row) {
    return {
      Id: row.id,
      LoopId: row.loop_id,
      UtcDate: row.utc_date,
      UtcStartTime: row.utc_start_time,
      UtcDurationSeconds: row.utc_duration_seconds || 0,
      Notes: row.notes || "",
      NotesForNextLoop: row.notes_for_next_loop || "",
    };
  }

  function executionToRow(execution) {
    return {
      id: execution.Id,
      loop_id: execution.LoopId,
      utc_date: execution.UtcDate,
      utc_start_time: execution.UtcStartTime,
      utc_duration_seconds: execution.UtcDurationSeconds || 0,
      notes: execution.Notes || "",
      notes_for_next_loop: execution.NotesForNextLoop || "",
    };
  }

  // Loads all three tables once per session; subsequent calls reuse the same in-flight
  // or settled promise so pages that call it repeatedly don't re-fetch.
  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const [taskRes, loopRes, execRes] = await Promise.all([
        supabaseClient.from("task").select("*"),
        supabaseClient.from("loop").select("*").order("sequence", { ascending: true }),
        supabaseClient.from("loop_execution").select("*"),
      ]);
      if (taskRes.error) throw taskRes.error;
      if (loopRes.error) throw loopRes.error;
      if (execRes.error) throw execRes.error;
      tasks = taskRes.data.map(rowToTask);
      loops = loopRes.data.map(rowToLoop);
      loopExecutions = execRes.data.map(rowToExecution);
    })();
    return loadPromise;
  }

  // New signed-in users start with the sample tasks from data/tasks.json, same as the
  // original single-user version of this app. Loops start empty (no seed file for those).
  async function ensureSeeded() {
    await load();
    if (tasks.length) return;
    const seedTasks = await fetchJson("data/tasks.json");
    const rows = seedTasks.map((t) => taskToRow({ ...t, Id: t.Id || uuid() }));
    const { data, error } = await supabaseClient.from("task").insert(rows).select();
    if (error) {
      console.error("Failed to seed tasks", error);
      return;
    }
    tasks = data.map(rowToTask);
  }

  function getTasks({ includeDeleted = false } = {}) {
    return includeDeleted ? tasks : tasks.filter((t) => !t.UtcDeleted);
  }

  function getTaskById(id) {
    return getTasks({ includeDeleted: true }).find((t) => t.Id === id) || null;
  }

  async function upsertTask(task) {
    const { data, error } = await supabaseClient.from("task").upsert(taskToRow(task)).select().single();
    if (error) {
      alert("Failed to save task: " + error.message);
      throw error;
    }
    const updated = rowToTask(data);
    const idx = tasks.findIndex((t) => t.Id === updated.Id);
    if (idx >= 0) tasks[idx] = updated;
    else tasks.push(updated);
    return updated;
  }

  async function createTask(partial) {
    const task = {
      Id: uuid(),
      Name: "",
      DueDate: null,
      PreparationNeeded: null,
      Reminders: [],
      Rewards: [],
      Consequences: [],
      Notes: "",
      ScopeId: null,
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
  // Afterwards, every affected task's RewardScore/ConsequenceScore/TotalScore are recalculated
  // and the affected tasks are upserted to Supabase in one batch.
  async function applyRankingUpdates(updates) {
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
    if (!affectedTaskIds.size) return;
    for (const taskId of affectedTaskIds) {
      recalculateTaskScores(byTaskId.get(taskId));
    }
    const rows = Array.from(affectedTaskIds, (id) => taskToRow(byTaskId.get(id)));
    const { data, error } = await supabaseClient.from("task").upsert(rows).select();
    if (error) {
      alert("Failed to save ranking: " + error.message);
      throw error;
    }
    const updatedById = new Map(data.map((row) => [row.id, rowToTask(row)]));
    tasks = tasks.map((t) => updatedById.get(t.Id) || t);
  }

  async function softDeleteTask(id) {
    const task = getTaskById(id);
    if (!task) return;
    task.UtcDeleted = new Date().toISOString();
    await upsertTask(task);
  }

  // --- Loops ---

  function getLoops() {
    return loops;
  }

  function getLoopById(id) {
    return loops.find((l) => l.Id === id) || null;
  }

  async function upsertLoop(loop) {
    const { data, error } = await supabaseClient.from("loop").upsert(loopToRow(loop)).select().single();
    if (error) {
      alert("Failed to save loop: " + error.message);
      throw error;
    }
    const updated = rowToLoop(data);
    const idx = loops.findIndex((l) => l.Id === updated.Id);
    if (idx >= 0) loops[idx] = updated;
    else loops.push(updated);
    return updated;
  }

  async function createLoop(partial) {
    const maxSequence = loops.reduce((max, l) => Math.max(max, l.Sequence || 0), 0);
    const loop = {
      Id: uuid(),
      ShortName: "",
      Notes: "",
      ScopeId: null,
      Sequence: maxSequence + 1,
      ...partial,
    };
    return upsertLoop(loop);
  }

  // The loop_execution rows cascade-delete in the database via their FK to loop, so this
  // only needs to remove the local cache entries once the loop row itself is gone.
  async function deleteLoop(id) {
    const { error } = await supabaseClient.from("loop").delete().eq("id", id);
    if (error) {
      alert("Failed to delete loop: " + error.message);
      throw error;
    }
    loops = loops.filter((l) => l.Id !== id);
    loopExecutions = loopExecutions.filter((e) => e.LoopId !== id);
  }

  // --- Loop executions ---

  function getLoopExecutions({ loopId } = {}) {
    return loopId ? loopExecutions.filter((e) => e.LoopId === loopId) : loopExecutions;
  }

  function getLoopExecutionById(id) {
    return loopExecutions.find((e) => e.Id === id) || null;
  }

  async function upsertLoopExecution(execution) {
    const { data, error } = await supabaseClient
      .from("loop_execution")
      .upsert(executionToRow(execution))
      .select()
      .single();
    if (error) {
      alert("Failed to save loop execution: " + error.message);
      throw error;
    }
    const updated = rowToExecution(data);
    const idx = loopExecutions.findIndex((e) => e.Id === updated.Id);
    if (idx >= 0) loopExecutions[idx] = updated;
    else loopExecutions.push(updated);
    return updated;
  }

  async function createLoopExecution(partial) {
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

  async function deleteLoopExecution(id) {
    const { error } = await supabaseClient.from("loop_execution").delete().eq("id", id);
    if (error) {
      alert("Failed to delete loop execution: " + error.message);
      throw error;
    }
    loopExecutions = loopExecutions.filter((e) => e.Id !== id);
  }

  // Loops joined with their most recent execution (by UtcDate), for the dashboard list.
  function getLoopsWithLastExecution() {
    return getLoops().map((loop) => {
      const forLoop = getLoopExecutions({ loopId: loop.Id });
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
    load,
    ensureSeeded,
    getTasks,
    getTaskById,
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
