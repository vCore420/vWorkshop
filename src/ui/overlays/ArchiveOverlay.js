/**
 * createArchiveOverlay
 * ---------------------
 * "Shelves become documentation and project archives." Nothing is archived
 * yet in this phase — the honest empty state here is the point: it's a
 * clearly-reserved place, not a fake feature.
 */
export function createArchiveOverlay({ projectsStore }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Archive";
      panelEl.appendChild(heading);

      const doneProjects = projectsStore.byStatus("done");
      if (doneProjects.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Finished projects will land here, alongside documentation, once there's something to keep.";
        panelEl.appendChild(empty);
      } else {
        const list = document.createElement("ul");
        list.className = "wide-list";
        for (const project of doneProjects) {
          const li = document.createElement("li");
          li.innerHTML = `<div class="item-title">${project.title}</div><div class="item-meta">finished ${new Date(project.updatedAt).toLocaleDateString()}</div>`;
          list.appendChild(li);
        }
        panelEl.appendChild(list);
      }
      return null;
    },
  };
}
