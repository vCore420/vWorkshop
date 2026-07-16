import { EventBus } from "../core/EventBus.js";

/**
 * ProjectsService
 * -----------------
 * "Please introduce a dedicated Project Service... opening projects,
 * recent projects, pinned projects, project metadata, future source
 * control integration, workspace awareness." Deliberately distinct from
 * the Workshop's own internal `ProjectsStore` (Notebook entries — title,
 * status, notes, already real and working, see `docs/BROWSER.md`'s own
 * `workshop://projects` section) — this is about *local filesystem*
 * projects, real folders on the player's actual computer, a genuinely
 * different concept that happens to share a name.
 *
 * `workshop://projects` (see `WorkshopPages.js`) shows the Workshop's own
 * real projects and points to this service's own dedicated
 * `host://projects` page (see `HostPages.js`) for local ones — two pages,
 * not one page pretending to cover both.
 *
 * `previewItems()` — same reconciliation as `ProgramsService.js`/
 * `DocumentsService.js`: `this.recent` stays honestly empty, a separate,
 * clearly-labelled illustrative list exists purely so `host://projects`
 * has something to demonstrate its own layout with.
 *
 * **Pinned projects, genuinely real.** Unlike opening a project or
 * launching an external editor (both need an actual filesystem bridge,
 * neither of which exists), "remember which paths I care about" needs
 * nothing beyond ordinary, persisted data — there's no reason to wait
 * for a real Host Companion connection just to let a person maintain a
 * list of paths for whenever one exists. `pin()`/`unpin()`/
 * `pinnedProjects()` work today, independent of everything else this
 * service can't do yet.
 */
export class ProjectsService {
  constructor() {
    this.events = new EventBus();
    this.recent = [];
    /** @type {string[]} */
    this.pinned = [];
  }

  getStatus() {
    return { available: false, summary: "Opening local projects isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  previewItems() {
    return [
      { name: "workshop-companion-app", kind: "Node project", modified: "1 day ago", isExample: true },
      { name: "reference-renders", kind: "Folder", modified: "6 days ago", isExample: true },
    ];
  }

  pin(path) {
    if (!path || this.pinned.includes(path)) return;
    this.pinned.push(path);
    this._emitChanged();
  }

  unpin(path) {
    const next = this.pinned.filter((p) => p !== path);
    if (next.length === this.pinned.length) return;
    this.pinned = next;
    this._emitChanged();
  }

  pinnedProjects() {
    return [...this.pinned];
  }

  _emitChanged() {
    this.events.emit("projectsService:changed");
    this.events.emit("persistence:saveRequested");
  }

  openProject(_path) {
    throw new Error("ProjectsService.openProject() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  openInExternalEditor(_path) {
    throw new Error("ProjectsService.openInExternalEditor() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { pinned: this.pinned };
  }

  load(data) {
    if (Array.isArray(data?.pinned)) this.pinned = data.pinned.filter((p) => typeof p === "string");
  }
}
