import { ServiceRegistry } from "./ServiceRegistry.js";
import { ProgramsService } from "./ProgramsService.js";
import { ProjectsService } from "./ProjectsService.js";
import { FilesService } from "./FilesService.js";
import { PluginRegistry } from "./PluginRegistry.js";
import { AutomationService } from "./AutomationService.js";
import { HardwareService } from "./HardwareService.js";
import { DocumentsService } from "./DocumentsService.js";
import { DownloadsService } from "./DownloadsService.js";
import { AssetService } from "./AssetService.js";
import { PermissionsService } from "./PermissionsService.js";

const HOST_VERSION = "0.2.0-preview";

/**
 * HostManager
 * -------------
 * "The Host should be treated as a lightweight companion service. It is
 * not another user-facing application." Concretely: there is no
 * `createHostApp()` anywhere in `src/computer/apps/` — the Host has no
 * computer-app entry of its own, no rail icon, no window. Everything it
 * offers is reached through `host://services` (the Dashboard) and its
 * sibling pages, which the Browser already knows how to display without
 * any special-casing.
 *
 * ```
 * Browser
 *   ↓
 * Workshop Host   (this file, and everything under src/host/)
 *   ↓
 * Local Machine   (optionally, via the real Workshop Host Companion —
 *                   see host-companion/README.md and
 *                   HostConnectionManager.js)
 * ```
 *
 * **Workshop Platform phase: nine named services.** This phase's own
 * brief names nine explicitly — Application, File, Project, Plugin,
 * Asset, Resident, Automation, Hardware, Diagnostics. `ProgramsService`
 * is registered under both `"programs"` (its original key, kept for
 * anything already reading it) and `"applications"` (the brief's own
 * name) — the identical "same instance, two keys" alias pattern
 * `HostPages.js` already uses for old `workshop://` page URLs, applied
 * to service names instead of page URLs. `PluginService`,
 * `ResidentService`, and `DiagnosticsService` all need stores that don't
 * exist yet at the point `main.js` constructs this class (the resident
 * system, the engine itself) — they're constructed and registered later
 * in `main.js`'s own "Workshop Platform" wiring block, the same "register
 * once every dependency is real" timing page registration already
 * established in the Browser Ecosystem phase. `AssetService` starts
 * empty and has its real asset kinds (Objects, Blueprints, Animations,
 * Models, Images, Music) registered from that same later block, once
 * each backing store exists — see `AssetService.js`'s own comment on why
 * that's "dynamic registration," not a gap.
 *
 * **`PermissionsService` is real from the moment this class exists** —
 * unlike every other service here, there's nothing to wait on
 * (permission *grants* are just persisted booleans, not a bridge to
 * anything). `FilesService` is the one consumer that actually checks it
 * today, gating its own one real capability
 * (`listFiles()`, via the Workshop Host Companion) on the Filesystem
 * category being explicitly granted.
 */
export class HostManager {
  constructor(pageRegistry, hostConnectionManager) {
    this.version = HOST_VERSION;
    this.services = new ServiceRegistry();
    const assetService = new AssetService();
    this.services.register("assets", assetService);
    // AssetService constructed just above so PluginRegistry can hand it
    // to any plugin implementing `provideAssets()` — see
    // PluginRegistry.js's own comment on the third plugin contract.
    this.pluginRegistry = new PluginRegistry(pageRegistry, assetService);
    this.permissions = new PermissionsService();

    const programsService = new ProgramsService();
    this.services.register("programs", programsService);
    this.services.register("applications", programsService); // alias — see this class's own comment

    this.services.register("projects", new ProjectsService());
    this.services.register("files", new FilesService({ hostConnectionManager, permissionsService: this.permissions }));
    this.services.register("automation", new AutomationService());
    this.services.register("hardware", new HardwareService());
    this.services.register("documents", new DocumentsService());
    this.services.register("downloads", new DownloadsService());
    this.services.register("permissions", this.permissions);
    // "plugins", "residents", and "diagnostics" are registered later, in
    // main.js's own "Workshop Platform" wiring block — see this class's
    // own comment on why.
  }

  /** "Status: Running, Version, Connected Services, Available
   *  Capabilities, Future Extensions" — the Dashboard's own overview,
   *  read live from whatever's actually registered rather than a
   *  hardcoded list, so a future service shows up here automatically.
   *  `"applications"` is filtered out here specifically, not because
   *  it's any less real than `"programs"`, but because it's the exact
   *  same service object registered under a second name — showing it
   *  twice in a status list that's meant to count *distinct* things
   *  would be actively misleading, not just redundant. */
  getOverviewStatus() {
    const seen = new Set();
    const services = [];
    for (const { name, service } of this.services.all()) {
      if (name === "applications") continue; // alias of "programs" — see this method's own comment
      if (seen.has(service)) continue;
      seen.add(service);
      services.push({ name, ...service.getStatus?.() });
    }
    return {
      running: true, // the Host "runs" the moment the Workshop itself does — there's no separate process to start
      version: this.version,
      services,
      availableCapabilities: services.filter((s) => s.available).map((s) => s.name),
      futureExtensions: services.filter((s) => !s.available).map((s) => s.name),
    };
  }
}
