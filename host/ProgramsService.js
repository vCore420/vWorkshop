/**
 * ProgramsService
 * -----------------
 * "Prepare a Programs service... do not worry about exhaustive
 * application discovery yet. The architecture is the priority." The real
 * shape a future version needs (installed/favourite/recent applications,
 * each `{id, name, icon, launch}`), with an honestly empty `installed`
 * list rather than fabricated example entries — there's no real
 * application discovery happening yet, and pretending otherwise with
 * placeholder app names would be more misleading than an empty list with
 * an honest explanation.
 *
 * `launchApplication(id)` already exists as the real future entry point
 * — a future Host, once it can actually talk to the local machine, only
 * needs to give this a real implementation; nothing that already calls
 * it (a future `workshop://programs` "Launch" button, say) needs to
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

  /** Not yet implemented — throws honestly rather than silently doing
   *  nothing, so a future caller finds out immediately rather than
   *  wondering why nothing happened. */
  launchApplication(_id) {
    throw new Error("ProgramsService.launchApplication() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
