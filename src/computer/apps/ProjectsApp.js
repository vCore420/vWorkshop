import { renderProjectList } from "../../ui/overlays/shared/projectListView.js";

/**
 * createProjectsApp
 * -------------------
 * Reuses the exact same list/edit logic as the workbench and pinboard
 * (`renderProjectList`) — the computer isn't a third implementation of
 * project management, just a third *view* of the one ProjectsStore. This
 * one shows everything, unfiltered: at the desk is where you'd want the
 * full picture, not just what's active or just what's planned.
 */
export function createProjectsApp({ projectsStore }) {
  return {
    id: "projects",
    label: "Projects",
    glyph: "projects",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Projects";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Everything, planning through done — the same board as the pinboard and workbench.";
      const listEl = document.createElement("div");
      container.append(heading, subtitle, listEl);
      return renderProjectList(listEl, projectsStore, { filterStatus: null, allowAdd: true });
    },
  };
}
