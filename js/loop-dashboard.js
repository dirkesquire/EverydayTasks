(async function () {
  const user = await Auth.requireUser();
  if (!user) return;
  DB.init(user);
  await DB.ensureSeeded();

  const tbody = document.getElementById("loops-tbody");
  const emptyEl = document.getElementById("empty-state");
  const table = document.getElementById("loops-table");
  const addBtn = document.getElementById("add-loop-btn");

  let sortKey = "name";
  let sortDir = 1;

  function render() {
    const loops = DB.getLoopsWithLastExecution()
      .filter((l) => ScopeFilter.isVisible(l.ScopeId))
      .sort((a, b) => {
        let result;
        if (sortKey === "name") {
          result = (a.ShortName || "").localeCompare(b.ShortName || "");
        } else {
          const aDate = a.lastExecution ? new Date(a.lastExecution.UtcDate) : null;
          const bDate = b.lastExecution ? new Date(b.lastExecution.UtcDate) : null;
          if (!aDate && !bDate) result = 0;
          else if (!aDate) result = 1;
          else if (!bDate) result = -1;
          else result = aDate - bDate;
        }
        return result * sortDir;
      });

    tbody.innerHTML = "";
    emptyEl.hidden = loops.length > 0;
    table.hidden = loops.length === 0;

    for (const loop of loops) {
      const tr = document.createElement("tr");
      tr.className = "row-clickable";
      tr.addEventListener("click", () => {
        window.location.href = `loop-executions.html?id=${encodeURIComponent(loop.Id)}`;
      });

      const nameTd = document.createElement("td");
      nameTd.textContent = loop.ShortName || "(untitled loop)";
      tr.appendChild(nameTd);

      const scopeTd = document.createElement("td");
      const scope = ScopeFilter.getScopes().find((s) => s.id === loop.ScopeId);
      scopeTd.textContent = scope ? scope.name : "—";
      tr.appendChild(scopeTd);

      const lastTd = document.createElement("td");
      lastTd.appendChild(renderDateBadge(loop.lastExecution ? loop.lastExecution.UtcDate : null));
      tr.appendChild(lastTd);

      tbody.appendChild(tr);
    }

    table.querySelectorAll("th.sortable").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === sortKey);
      th.dataset.dir = th.dataset.sort === sortKey ? (sortDir === 1 ? "asc" : "desc") : "";
    });
  }

  table.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      if (sortKey === th.dataset.sort) {
        sortDir *= -1;
      } else {
        sortKey = th.dataset.sort;
        sortDir = 1;
      }
      render();
    });
  });

  addBtn.addEventListener("click", async () => {
    const loop = await DB.createLoop({ ShortName: "" });
    window.location.href = `loop-executions.html?id=${encodeURIComponent(loop.Id)}`;
  });

  ScopeFilter.onChange(render);
  await ScopeFilter.load();
})();
