// Header widget shown on task-dashboard/task-ranker/task-ranker2/loop-dashboard: a
// multiselect dropdown of non-deleted scopes, toggling each one's is_active flag.
// A no-op if the page doesn't include the scope-picker markup.
(async function () {
  const btn = document.getElementById("scope-picker-btn");
  const dropdown = document.getElementById("scope-picker-dropdown");
  const listEl = document.getElementById("scope-picker-list");
  if (!btn || !dropdown || !listEl) return;

  const user = await Auth.requireUser();
  if (!user) return;

  function render(scopes) {
    listEl.innerHTML = "";
    if (!scopes.length) {
      const empty = document.createElement("div");
      empty.className = "scope-picker-empty";
      empty.textContent = "No scopes yet.";
      listEl.appendChild(empty);
      return;
    }
    for (const scope of scopes) {
      const label = document.createElement("label");
      label.className = "scope-picker-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!scope.is_active;
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        try {
          await ScopeFilter.setActive(scope.id, checkbox.checked);
        } catch (err) {
          alert("Failed to update scope: " + err.message);
          checkbox.checked = !checkbox.checked;
        }
        checkbox.disabled = false;
      });

      const span = document.createElement("span");
      span.textContent = scope.name;

      label.append(checkbox, span);
      listEl.appendChild(label);
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  dropdown.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", () => {
    dropdown.hidden = true;
  });

  ScopeFilter.onChange(render);
  await ScopeFilter.load();
})();
