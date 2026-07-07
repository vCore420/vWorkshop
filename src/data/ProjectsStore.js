/**
 * ProjectsStore
 * -------------
 * A single source of truth for "creative projects", viewed several
 * different ways by different physical objects:
 *
 *   - The pinboard shows every project, grouped by status ("planning" is
 *     the default when it doesn't fit anywhere else yet) — this is where
 *     ideas get captured before they're being worked on.
 *   - The workbench shows exactly one project at a time — "current creative
 *     focus" — as a physical arrangement of objects, not a list. See
 *     src/workbench/ and docs/WORKBENCH.md. `kind` and `presence` exist on
 *     a project specifically to support that: `kind` picks a sensible
 *     default physical presence (src/workbench/kindTemplates.js); `presence`
 *     is the resolved (or fully custom) array of physical items themselves,
 *     stored back onto the project the first time it's placed on the bench
 *     so it becomes real per-project metadata rather than a re-derived
 *     guess. Neither field means anything to ProjectsStore itself — it's
 *     just data it carries around, same as `title` or `notes`.
 *   - The computer's Projects app shows every project too, as a plain list.
 *
 * This mirrors how a real workshop works: the corkboard is where things get
 * pinned up and thought about, the bench is where the current thing gets
 * physically worked on.
 */
import { EventBus } from "../core/EventBus.js";

let _nextId = 1;

export class ProjectsStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<{id:number,title:string,status:string,notes:string,kind:string,presence:Array|null,updatedAt:string}>} */
    this.projects = [];
  }

  add({ title, status = "planning", notes = "", kind = "general", presence = null }) {
    const project = {
      id: _nextId++,
      title: title?.trim() || "Untitled project",
      status,
      notes,
      kind,
      presence,
      updatedAt: new Date().toISOString(),
    };
    this.projects.push(project);
    this.events.emit("projects:changed", this.projects);
    return project;
  }

  update(id, patch) {
    const project = this.projects.find((p) => p.id === id);
    if (!project) return null;
    Object.assign(project, patch, { updatedAt: new Date().toISOString() });
    this.events.emit("projects:changed", this.projects);
    return project;
  }

  get(id) {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  remove(id) {
    this.projects = this.projects.filter((p) => p.id !== id);
    this.events.emit("projects:changed", this.projects);
  }

  byStatus(status) {
    return this.projects.filter((p) => p.status === status);
  }

  all() {
    return [...this.projects];
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { projects: this.projects };
  }

  load(data) {
    if (!data?.projects) return;
    // Backward-compatible with phase-1 save files that predate kind/presence.
    this.projects = data.projects.map((p) => ({ kind: "general", presence: null, ...p }));
    const maxId = this.projects.reduce((m, p) => Math.max(m, p.id), 0);
    _nextId = maxId + 1;
    this.events.emit("projects:changed", this.projects);
  }
}
