// Shared cache of non-deleted scopes, used by scope-picker.js (the header widget), the
// task/loop dashboards (filtering by active scope), and the task/loop edit pages
// (choosing a scope). Keeping one fetch + one in-memory list avoids each page/widget
// re-querying Supabase independently and drifting out of sync with itself.
const ScopeFilter = (() => {
  let scopes = [];
  let loaded = false;
  let loadPromise = null;
  const listeners = new Set();

  function notify() {
    for (const cb of listeners) cb(scopes);
  }

  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const { data, error } = await supabaseClient
        .from("scope")
        .select("*")
        .is("utc_deleted", null)
        .order("sequence", { ascending: true });
      if (error) {
        console.error("Failed to load scopes", error);
        scopes = [];
      } else {
        scopes = data || [];
      }
      loaded = true;
      notify();
      return scopes;
    })();
    return loadPromise;
  }

  // Fires immediately with the current list if already loaded, then again on every change.
  function onChange(cb) {
    listeners.add(cb);
    if (loaded) cb(scopes);
    return () => listeners.delete(cb);
  }

  function getScopes() {
    return scopes;
  }

  async function setActive(scopeId, isActive) {
    const { error } = await supabaseClient.from("scope").update({ is_active: isActive }).eq("id", scopeId);
    if (error) throw error;
    const scope = scopes.find((s) => s.id === scopeId);
    if (scope) scope.is_active = isActive;
    notify();
  }

  // Items with no scope are always visible. Items whose scope was deleted (no longer in
  // the loaded list) are hidden rather than guessed at.
  function isVisible(scopeId) {
    if (!scopeId) return true;
    const scope = scopes.find((s) => s.id === scopeId);
    return scope ? !!scope.is_active : false;
  }

  return { load, onChange, getScopes, setActive, isVisible };
})();
