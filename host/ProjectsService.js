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
 * `workshop://projects` (see `HostPages.js`) shows both side by side
 * rather than this service claiming the URL for itself — the Workshop's
 * own projects are real today; duplicating or replacing that page with
 * an empty "local projects" placeholder would be a regression, not
 * progress.
 */
export class ProjectsService {
  constructor() {
    this.recent = [];
  }

  getStatus() {
    return { available: false, summary: "Opening local projects isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  openProject(_path) {
    throw new Error("ProjectsService.openProject() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  openInExternalEditor(_path) {
    throw new Error("ProjectsService.openInExternalEditor() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
