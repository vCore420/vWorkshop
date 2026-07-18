/**
 * createArchiveOverlay
 * ---------------------
 * "Shelves become documentation and project archives." Opens
 * `overlayId: "archive"` from the shelving unit itself.
 *
 * Version 3, Phase 3 ("The Reading Chair") — `buildArchiveContent()` is
 * exported and reused verbatim by `RestNookOverlay.js`'s own "browse the
 * Archive" view, rather than a second, independently-maintained copy of
 * this rendering living in the reading chair's own file (see
 * docs/PLAYER.md's reading-chair section, and CLAUDE.md's "one
 * implementation, several doors in"). This is genuinely the same archive
 * either way — the shelving unit and the reading chair are just two
 * physical ways to reach it.
 *
 * Also enriched this phase — "show all notes and any future things that
 * get attached to a project." Previously showed only a title and a
 * finished date; a finished project's full `notes` and every saved
 * `calculations` entry (added in the Workshop Tools phase — see
 * `ProjectsStore.js`) are now shown too, each finished project genuinely
 * summarising *everything* attached to it, not just enough to identify
 * it. Built with `textContent` throughout rather than the previous
 * `innerHTML` string — `notes` is free text a resident could type
 * anything into, and there's no reason to parse it as HTML.
 */
export function createArchiveOverlay({ projectsStore }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Archive";
      panelEl.appendChild(heading);
      panelEl.appendChild(buildArchiveContent(projectsStore));
      return null;
    },
  };
}

/** The archive's own content, as a DOM fragment — no heading, so a caller
 *  (this file's own overlay, or the reading chair's) can place its own
 *  above it however fits that surface. */
export function buildArchiveContent(projectsStore) {
  const fragment = document.createDocumentFragment();
  const doneProjects = projectsStore.byStatus("done");

  if (doneProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Finished projects will land here, alongside documentation, once there's something to keep.";
    fragment.appendChild(empty);
    return fragment;
  }

  const list = document.createElement("ul");
  list.className = "wide-list archive-list";
  for (const project of doneProjects) list.appendChild(buildArchiveEntry(project));
  fragment.appendChild(list);
  return fragment;
}

function buildArchiveEntry(project) {
  const li = document.createElement("li");

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = project.title;
  li.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = `finished ${new Date(project.updatedAt).toLocaleDateString()}`;
  li.appendChild(meta);

  if (project.notes) {
    const notes = document.createElement("p");
    notes.className = "archive-notes";
    notes.textContent = project.notes;
    li.appendChild(notes);
  }

  if (project.calculations?.length > 0) {
    const calcList = document.createElement("ul");
    calcList.className = "archive-calculations";
    for (const calc of project.calculations) {
      const calcItem = document.createElement("li");
      const calcTitle = document.createElement("span");
      calcTitle.textContent = `\u{1F4D0} ${calc.toolTitle}`;
      const calcDate = document.createElement("span");
      calcDate.className = "item-meta";
      calcDate.textContent = new Date(calc.createdAt).toLocaleDateString();
      calcItem.append(calcTitle, calcDate);
      calcList.appendChild(calcItem);
    }
    li.appendChild(calcList);
  }

  return li;
}
