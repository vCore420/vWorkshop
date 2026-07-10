import { ServiceRegistry } from "./ServiceRegistry.js";
import { ProgramsService } from "./ProgramsService.js";
import { ProjectsService } from "./ProjectsService.js";
import { FilesService } from "./FilesService.js";
import { PluginRegistry } from "./PluginRegistry.js";
import { AutomationService } from "./AutomationService.js";
import { HardwareService } from "./HardwareService.js";

const HOST_VERSION = "0.1.0-preview";

/**
 * HostManager
 * -------------
 * "The Host should be treated as a lightweight companion service. It is
 * not another user-facing application." Concretely: there is no
 * `createHostApp()` anywhere in `src/computer/apps/` — the Host has no
 * computer-app entry of its own, no rail icon, no window. Everything it
 * offers is reached exclusively through `workshop://host` and its
 * sibling pages (`HostPages.js`), which the Browser already knows how to
 * display without any special-casing — "the Host should never create
 * separate windows or interfaces."
 *
 * ```
 * Browser
 *   ↓
 * Workshop Host   (this file, and everything under src/host/)
 *   ↓
 * Local Machine
 * ```
 *
 * This is the whole of "Host Philosophy": the Browser displays pages,
 * the Host provides services, and the Browser never directly performs a
 * local-machine operation itself. Today, every one of those services
 * (`ProgramsService`, `ProjectsService`, `FilesService`,
 * `AutomationService`, `HardwareService`) is honestly unimplemented —
 * there is no actual bridge to a local machine from inside a browser
 * tab, and this phase doesn't invent one. What exists is the *shape*
 * every one of those will eventually fill: register with
 * `ServiceRegistry` under a name, expose `getStatus()`, and the Host
 * Dashboard already knows how to list it, with zero changes required
 * when a service becomes real.
 */
export class HostManager {
  constructor(pageRegistry) {
    this.version = HOST_VERSION;
    this.services = new ServiceRegistry();
    this.pluginRegistry = new PluginRegistry(pageRegistry);

    this.services.register("programs", new ProgramsService());
    this.services.register("projects", new ProjectsService());
    this.services.register("files", new FilesService());
    this.services.register("automation", new AutomationService());
    this.services.register("hardware", new HardwareService());
    // Deliberately not registered as a ServiceRegistry entry — see
    // PluginRegistry.js's own comment on why it's a related but distinct
    // concern (which workshop:// pages a plugin contributes, not a
    // service with its own status the same way the others have one).
  }

  /** "Status: Running, Version, Connected Services, Available
   *  Capabilities, Future Extensions" — the Dashboard's own overview,
   *  read live from whatever's actually registered rather than a
   *  hardcoded list, so a future service shows up here automatically. */
  getOverviewStatus() {
    const services = this.services.all().map(({ name, service }) => ({ name, ...service.getStatus?.() }));
    return {
      running: true, // the Host "runs" the moment the Workshop itself does — there's no separate process to start
      version: this.version,
      services,
      availableCapabilities: services.filter((s) => s.available).map((s) => s.name),
      futureExtensions: services.filter((s) => !s.available).map((s) => s.name),
    };
  }
}
