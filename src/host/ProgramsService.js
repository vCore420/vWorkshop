/**
 * ProgramsService
 * -----------------
 * "Prepare a Programs service... do not worry about exhaustive
 * application discovery yet. The architecture is the priority." The real
 * shape a future version needs (installed/favourite/recent applications,
 * each `{id, name, icon, launch}`), with an honestly empty `installed`
 * list rather than fabricated example entries — there's no real
 * application discovery happening yet.
 *
 * **Browser Ecosystem phase reconciliation**: "use sensible placeholder
 * data so the interface is ready for future integration" (this phase's
 * own brief) sits in real tension with "an honestly empty list... a
 * convincing fake would be more misleading" (this file's own original
 * reasoning, still true). Both survive intact — `this.installed` stays
 * genuinely empty; `previewItems()` is new, and returns a handful of
 * clearly-labelled illustrative rows (each tagged `isExample: true`)
 * purely so `host://applications` has something to demonstrate its own
 * layout with. See `DocumentsService.js`'s own comment for the identical
 * reasoning spelled out in full; `host://applications` renders these with
 * a visible "Example" badge, never silently mixed into real results.
 *
 * `launchApplication(id)` already exists as the real future entry point
 * — a future Host, once it can actually talk to the local machine, only
 * needs to give this a real implementation; nothing that already calls
 * it (a future `host://applications` "Launch" button, say) needs to
 * change.
 */
export class ProgramsService {
  constructor() {
    this.installed = [];
    this.favourites = [];
    this.recent = [];
  }

  getStatus() {
    return { available: false, summary: "Application discovery isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  /** Illustrative only — see this file's own comment. Never returned by
   *  `getStatus()`, never treated as `this.installed`. */
  previewItems() {
    return [
      { name: "Text Editor", kind: "Productivity", isExample: true },
      { name: "Image Viewer", kind: "Media", isExample: true },
      { name: "Terminal", kind: "Development", isExample: true },
    ];
  }

  /** Not yet implemented — throws honestly rather than silently doing
   *  nothing, so a future caller finds out immediately rather than
   *  wondering why nothing happened. */
  launchApplication(_id) {
    throw new Error("ProgramsService.launchApplication() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
