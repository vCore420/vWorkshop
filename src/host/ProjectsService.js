/**
 * ProjectsService
 * -----------------
 * "Future capabilities include: opening projects, opening folders,
 * launching projects in external editors, project metadata, recently
 * opened projects." Deliberately distinct from the Workshop's own
 * internal `ProjectsStore` (Notebook entries — title, status, notes,
 * already real and working, see `docs/BROWSER.md`'s own
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
 */
export class ProjectsService {
  constructor() {
    this.recent = [];
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

  openProject(_path) {
    throw new Error("ProjectsService.openProject() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  openInExternalEditor(_path) {
    throw new Error("ProjectsService.openInExternalEditor() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
