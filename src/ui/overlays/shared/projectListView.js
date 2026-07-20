/**
 * renderProjectList
 * ------------------
 * A plain-DOM (no framework) list view over ProjectsStore, filtered by
 * status. Used by the pinboard (every project) and the computer's
 * "Projects" app (also every project) — two different overlay materials
 * sharing one rendering + editing implementation. The workbench (see
 * `src/workbench/`) deliberately does *not* use this: it shows exactly one
 * project at a time as a physical arrangement, not a list.
 *
 * @returns {() => void} cleanup function — call when the host overlay closes.
 */
export function renderProjectList(container, projectsStore, { filterStatus = null, allowAdd = true } = {}) {
  const render = () => {
    container.innerHTML = "";
    const items = filterStatus ? projectsStore.byStatus(filterStatus) : projectsStore.all();

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = filterStatus === "active"
        ? "Nothing on the bench right now. Pin an idea, then mark it active when you start it."
        : "No projects yet.";
      container.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "wide-list";
      for (const project of items) {
        const li = document.createElement("li");
        const title = document.createElement("div");
        title.className = "item-title";
        title.textContent = project.title;
        const meta = document.createElement("div");
        meta.className = "item-meta";
        meta.textContent = `${project.status} · updated ${new Date(project.updatedAt).toLocaleDateString()}`;
        li.append(title, meta);

        if (project.notes) {
          const notes = document.createElement("div");
          notes.style.marginTop = "6px";
          notes.style.fontSize = "0.9em";
          notes.textContent = project.notes;
          li.appendChild(notes);
        }

        const controls = document.createElement("div");
        controls.style.marginTop = "8px";
        controls.style.display = "flex";
        controls.style.gap = "8px";

        if (project.status !== "active") {
          const activateBtn = document.createElement("button");
          activateBtn.textContent = "Move to bench";
          activateBtn.className = "dial-button-plain";
          activateBtn.setAttribute("aria-label", `Move ${project.title} to bench`);
          styleSmallButton(activateBtn);
          activateBtn.addEventListener("click", () => projectsStore.update(project.id, { status: "active" }));
          controls.appendChild(activateBtn);
        }
        if (project.status !== "done") {
          const doneBtn = document.createElement("button");
          doneBtn.textContent = "Mark done";
          doneBtn.setAttribute("aria-label", `Mark ${project.title} done`);
          styleSmallButton(doneBtn);
          doneBtn.addEventListener("click", () => projectsStore.update(project.id, { status: "done" }));
          controls.appendChild(doneBtn);
        }
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.setAttribute("aria-label", `Remove ${project.title}`);
        styleSmallButton(removeBtn);
        removeBtn.addEventListener("click", () => projectsStore.remove(project.id));
        controls.appendChild(removeBtn);

        li.appendChild(controls);
        list.appendChild(li);
      }
      container.appendChild(list);
    }

    if (allowAdd) {
      const row = document.createElement("div");
      row.className = "field-row";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "New project title\u2026";
      input.setAttribute("aria-label", "New project title");
      const addBtn = document.createElement("button");
      addBtn.textContent = "Pin it";
      addBtn.addEventListener("click", () => {
        if (!input.value.trim()) return;
        projectsStore.add({ title: input.value, status: filterStatus === "active" ? "active" : "planning" });
        input.value = "";
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      row.append(input, addBtn);
      container.appendChild(row);
    }
  };

  function styleSmallButton(btn) {
    btn.style.fontFamily = "var(--font-mono)";
    btn.style.fontSize = "0.7rem";
    btn.style.background = "rgba(255,255,255,0.08)";
    btn.style.color = "inherit";
    btn.style.border = "1px solid rgba(255,255,255,0.2)";
    btn.style.borderRadius = "4px";
    btn.style.padding = "4px 8px";
    btn.style.cursor = "pointer";
  }

  render();
  const unsubscribe = projectsStore.events.on("projects:changed", render);
  return unsubscribe;
}
