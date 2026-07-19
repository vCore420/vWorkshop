/**
 * createPinboardOverlay
 * ----------------------
 * "Walking to the pinboard opens project planning." Ideas being captured
 * or actively worked on, editable in place — this is where things live
 * before they're finished. Version 3, Phase 9 ("Creative Flow") —
 * "existing management surfaces should comfortably accommodate growing
 * libraries without obscuring or hiding functionality." A cork board that
 * never cleared a finished project would, in a long-running Workshop,
 * accumulate months of "done" notes sitting alongside genuinely active
 * planning — real clutter, and a straight duplication of the Archive
 * (`ArchiveOverlay.js`), which already exists specifically to hold
 * finished work. `done` projects now leave the board the moment they're
 * marked done (the status `<select>` in `buildNote()` below is exactly
 * how a project gets there) — they're never deleted, just no longer
 * pinned here, the same way a real corkboard note comes down once the
 * job it was for is actually finished.
 */
export function createPinboardOverlay({ projectsStore }) {
  return {
    materialClass: "cork",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Project planning";
      panelEl.appendChild(heading);

      const board = document.createElement("div");
      board.className = "cork-board";
      panelEl.appendChild(board);

      const render = () => {
        board.innerHTML = "";
        for (const project of projectsStore.all().filter((p) => p.status !== "done")) {
          board.appendChild(buildNote(project, projectsStore));
        }
        const addBtn = document.createElement("div");
        addBtn.className = "cork-add";
        addBtn.textContent = "+ Pin a new idea";
        addBtn.addEventListener("click", () => {
          const created = projectsStore.add({ title: "New idea", status: "planning" });
          void created;
        });
        board.appendChild(addBtn);
      };

      render();
      return projectsStore.events.on("projects:changed", render);
    },
  };
}

function buildNote(project, projectsStore) {
  const note = document.createElement("div");
  note.className = "cork-note";

  const titleInput = document.createElement("input");
  titleInput.value = project.title;
  titleInput.style.fontWeight = "600";
  titleInput.style.marginBottom = "6px";
  titleInput.addEventListener("change", () => projectsStore.update(project.id, { title: titleInput.value }));

  const notesArea = document.createElement("textarea");
  notesArea.value = project.notes;
  notesArea.rows = 3;
  notesArea.placeholder = "Notes\u2026";
  notesArea.addEventListener("change", () => projectsStore.update(project.id, { notes: notesArea.value }));

  const statusSelect = document.createElement("select");
  for (const status of ["planning", "active", "done"]) {
    const opt = document.createElement("option");
    opt.value = status;
    opt.textContent = status;
    if (status === project.status) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  statusSelect.addEventListener("change", () => projectsStore.update(project.id, { status: statusSelect.value }));

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "\u2715";
  removeBtn.title = "Unpin";
  removeBtn.style.position = "absolute";
  removeBtn.style.top = "4px";
  removeBtn.style.right = "6px";
  removeBtn.style.border = "none";
  removeBtn.style.background = "transparent";
  removeBtn.style.cursor = "pointer";
  removeBtn.style.opacity = "0.5";
  removeBtn.addEventListener("click", () => projectsStore.remove(project.id));

  note.append(removeBtn, titleInput, notesArea, statusSelect);
  return note;
}
