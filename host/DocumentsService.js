/**
 * DocumentsService
 * ------------------
 * "host://documents... where Host functionality has not yet been
 * implemented, prepare the page architecture and use sensible
 * placeholder data so the interface is ready for future integration."
 *
 * This is in real tension with how every other Host service in this
 * file's own neighbourhood was written — `ProgramsService.js`'s own
 * comment reads "an honestly empty list rather than fabricated example
 * entries... pretending otherwise with placeholder app names would be
 * more misleading than an empty list with an honest explanation." Both
 * instructions are worth taking seriously rather than picking one and
 * quietly dropping the other, so here's the reconciliation this file
 * (and `DownloadsService.js`, identically) actually implements:
 *
 * **Real state stays honestly empty.** `this.recent` is `[]`, exactly
 * like every sibling service — there is no bridge to a local machine, so
 * there is nothing real to list, and `getStatus()` says so plainly.
 *
 * **`previewItems()` is new, and is never confused for real data.** It
 * returns a handful of clearly-labelled illustrative rows — the *shape*
 * a populated page will have (name, kind, a relative modified time) —
 * every one of them tagged `isExample: true`, which `host://documents`
 * (see `HostPages.js`) renders with a visible "Example" badge and a
 * dashed border, never mixed silently into a list that looks like real
 * results. This is "sensible placeholder data so the interface is ready"
 * without it ever being "a convincing fake" — a person looking at the
 * page can immediately tell which rows are illustration and which would
 * be real, the moment there are any real ones.
 */
export class DocumentsService {
  constructor() {
    this.recent = []; // genuinely empty — see this file's own comment
  }

  getStatus() {
    return { available: false, summary: "Document access isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  /** Illustrative only — see this file's own comment. Never returned by
   *  `getStatus()`, never treated as `this.recent`. */
  previewItems() {
    return [
      { name: "Workshop Notes.txt", kind: "Text Document", modified: "2 days ago", isExample: true },
      { name: "Reference Sketch.png", kind: "Image", modified: "1 week ago", isExample: true },
      { name: "Build Plan.pdf", kind: "PDF Document", modified: "3 weeks ago", isExample: true },
    ];
  }

  openDocument(_path) {
    throw new Error("DocumentsService.openDocument() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
