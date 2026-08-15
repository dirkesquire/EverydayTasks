// First page backed directly by a Supabase table (not the localStorage DB module).
// RLS on public.scope restricts rows to auth.uid(), so no client-side user filter is needed.
(async function () {
  const user = await Auth.requireUser();
  if (!user) return;

  const listEl = document.getElementById("scope-list");
  const emptyEl = document.getElementById("empty-state");
  const showDeletedEl = document.getElementById("show-deleted");
  const addBtn = document.getElementById("add-scope-btn");
  const rowTemplate = document.getElementById("scope-row-template");

  const renameDialog = document.getElementById("rename-dialog");
  const renameInput = document.getElementById("rename-input");
  const renameCancel = document.getElementById("rename-cancel");
  const renameSave = document.getElementById("rename-save");
  let renamingScopeId = null;

  const addScopeDialog = document.getElementById("add-scope-dialog");
  const addScopeInput = document.getElementById("add-scope-input");
  const addScopeCancel = document.getElementById("add-scope-cancel");
  const addScopeSave = document.getElementById("add-scope-save");

  let scopes = [];

  async function loadScopes() {
    const { data, error } = await supabaseClient.from("scope").select("*").order("sequence", { ascending: true });
    if (error) {
      alert("Failed to load scopes: " + error.message);
      return;
    }
    scopes = data || [];
    render();
  }

  function closeAllMenus() {
    listEl.querySelectorAll("[data-menu-dropdown]").forEach((el) => (el.hidden = true));
  }

  function buildRow(scope) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = scope.id;
    row.querySelector('[data-field="name"]').textContent = scope.name;
    if (scope.utc_deleted) row.classList.add("is-deleted");
    row.querySelector('[data-menu-item="delete"]').hidden = !!scope.utc_deleted;
    row.querySelector('[data-menu-item="restore"]').hidden = !scope.utc_deleted;

    const activeCheckbox = row.querySelector('[data-field="is-active"]');
    activeCheckbox.checked = !!scope.is_active;
    activeCheckbox.addEventListener("click", (e) => e.stopPropagation());
    activeCheckbox.addEventListener("change", () => toggleActive(scope, activeCheckbox));

    const menuToggle = row.querySelector("[data-menu-toggle]");
    const dropdown = row.querySelector("[data-menu-dropdown]");
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasHidden = dropdown.hidden;
      closeAllMenus();
      dropdown.hidden = !wasHidden;
    });

    row.querySelector('[data-action="rename"]').addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllMenus();
      openRenameDialog(scope);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      await deleteScope(scope);
    });

    row.querySelector('[data-action="restore"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      await restoreScope(scope);
    });

    return row;
  }

  function render() {
    const showDeleted = showDeletedEl.checked;
    const visible = scopes.filter((s) => showDeleted || !s.utc_deleted);

    listEl.innerHTML = "";
    emptyEl.hidden = visible.length > 0;
    for (const scope of visible) listEl.appendChild(buildRow(scope));
  }

  function openRenameDialog(scope) {
    renamingScopeId = scope.id;
    renameInput.value = scope.name;
    renameDialog.showModal();
    renameInput.focus();
    renameInput.select();
  }

  renameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      renameSave.click();
    }
  });

  addScopeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addScopeSave.click();
    }
  });

  renameCancel.addEventListener("click", () => renameDialog.close());

  renameSave.addEventListener("click", async () => {
    const name = renameInput.value.trim();
    if (!name || !renamingScopeId) {
      renameDialog.close();
      return;
    }
    const { error } = await supabaseClient.from("scope").update({ name }).eq("id", renamingScopeId);
    if (error) {
      alert("Failed to rename scope: " + error.message);
      return;
    }
    const scope = scopes.find((s) => s.id === renamingScopeId);
    if (scope) scope.name = name;
    renameDialog.close();
    render();
  });

  async function deleteScope(scope) {
    const utc_deleted = new Date().toISOString();
    const { error } = await supabaseClient.from("scope").update({ utc_deleted }).eq("id", scope.id);
    if (error) {
      alert("Failed to delete scope: " + error.message);
      return;
    }
    scope.utc_deleted = utc_deleted;
    render();
  }

  async function restoreScope(scope) {
    const { error } = await supabaseClient.from("scope").update({ utc_deleted: null }).eq("id", scope.id);
    if (error) {
      alert("Failed to restore scope: " + error.message);
      return;
    }
    scope.utc_deleted = null;
    render();
  }

  async function toggleActive(scope, checkbox) {
    const is_active = checkbox.checked;
    checkbox.disabled = true;
    const { error } = await supabaseClient.from("scope").update({ is_active }).eq("id", scope.id);
    checkbox.disabled = false;
    if (error) {
      alert("Failed to update scope: " + error.message);
      checkbox.checked = !is_active;
      return;
    }
    scope.is_active = is_active;
  }

  addBtn.addEventListener("click", () => {
    addScopeInput.value = "";
    addScopeDialog.showModal();
    addScopeInput.focus();
  });

  addScopeCancel.addEventListener("click", () => addScopeDialog.close());

  addScopeSave.addEventListener("click", async () => {
    const name = addScopeInput.value.trim();
    if (!name) {
      addScopeDialog.close();
      return;
    }
    const maxSequence = scopes.reduce((max, s) => Math.max(max, s.sequence || 0), 0);
    const { data, error } = await supabaseClient
      .from("scope")
      .insert({ name, sequence: maxSequence + 1 })
      .select()
      .single();
    if (error) {
      alert("Failed to add scope: " + error.message);
      return;
    }
    scopes.push(data);
    addScopeDialog.close();
    render();
  });

  showDeletedEl.addEventListener("change", render);

  document.addEventListener("click", closeAllMenus);

  /* ---------- drag and drop reordering ---------- */

  let draggingEl = null;

  function getRowAfter(y) {
    const rows = Array.from(listEl.querySelectorAll(".scope-row:not(.dragging)"));
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

  listEl.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".scope-row");
    if (!row) return;
    draggingEl = row;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", row.dataset.id);
  });

  listEl.addEventListener("dragover", (e) => {
    if (!draggingEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const after = getRowAfter(e.clientY);
    if (after) listEl.insertBefore(draggingEl, after);
    else listEl.appendChild(draggingEl);
  });

  listEl.addEventListener("drop", async (e) => {
    e.preventDefault();
    await finishDrag();
  });

  listEl.addEventListener("dragend", async () => {
    if (draggingEl) await finishDrag();
  });

  async function finishDrag() {
    if (!draggingEl) return;
    draggingEl.classList.remove("dragging");
    draggingEl = null;

    const idsInOrder = Array.from(listEl.querySelectorAll(".scope-row")).map((row) => row.dataset.id);
    const byId = new Map(scopes.map((s) => [s.id, s]));
    const updates = [];
    idsInOrder.forEach((id, i) => {
      const scope = byId.get(id);
      if (scope && scope.sequence !== i) {
        scope.sequence = i;
        updates.push(supabaseClient.from("scope").update({ sequence: i }).eq("id", id));
      }
    });

    if (updates.length) {
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed) alert("Failed to save new order: " + failed.error.message);
    }
    scopes.sort((a, b) => a.sequence - b.sequence);
  }

  await loadScopes();
})();
