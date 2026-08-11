// Thin localStorage-backed data layer, seeded from /data/*.json on first run.
const DB = (() => {
  const KEYS = { users: "tasktracker.users", tasks: "tasktracker.tasks" };

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

  function softDeleteTask(id) {
    const task = getTaskById(id);
    if (!task) return;
    task.UtcDeleted = new Date().toISOString();
    upsertTask(task);
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
    softDeleteTask,
  };
})();
