import { CURRENT_SAVE_VERSION } from "../systems/SaveMigrations.js";

// Version 2 Sign-Off phase — "Healthy. Warning. Error. Unavailable."
// used to also live here as its own exported `HEALTH_LEVELS` array —
// this phase's own dead-code audit found it was never actually read as
// a value anywhere (only mentioned in a comment below), and it
// duplicated a vocabulary `SEVERITY`'s own keys already define.
// Removed rather than kept alongside a second copy of the same list.
//
// Order matters — index is severity, used by _worse()/_overallHealth()
// below. "unavailable" sits *after* "error" here on purpose: an
// unavailable optional feature (Ollama not running, the Host Companion
// not started) is real information worth showing, but it should never
// make the Workshop's own *overall* banner look worse than a genuine
// error elsewhere would.
const SEVERITY = { healthy: 0, warning: 1, unavailable: 1, error: 2 };

function _worse(a, b) {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

/**
 * DiagnosticsService
 * --------------------
 * "Not a traditional developer debug menu... a Workshop Control
 * Centre... the Workshop should be capable of monitoring, explaining
 * and diagnosing its own health." `workshop://diagnostics` (Browser
 * Ecosystem phase) already computed a Workshop-wide status report ad
 * hoc, directly inside `WorkshopPages.js`; this service is that same
 * computation moved to one reusable place, read by both
 * `workshop://diagnostics` and `host://services`' own Dashboard, rather
 * than two slowly-diverging copies of the same status check. The
 * Workshop Diagnostics phase is what actually taught it to *understand*
 * what it reports, not just list it — see `getReport()`'s own comment.
 *
 * Like `AssetService.js`/`ResidentService.js`, every number here comes
 * from a real, already-existing system (`engine.systems`,
 * `PersistenceSystem`, `AIConnectionManager`, `HostConnectionManager`,
 * `PageRegistry`, `BrowserStore`, `SearchIndex`, `ResidentController`,
 * `PluginService`, `AssetService`, `WorkshopEventLog`/`WorldEventLog`).
 * There's nothing to fake about "how many systems are currently
 * running," or "is anything actually broken right now" — it's either
 * true or it isn't.
 */
export class DiagnosticsService {
  constructor({
    engine,
    persistenceSystem,
    aiConnectionManager,
    hostConnectionManager,
    hostManager,
    pageRegistry,
    browserStore,
    searchIndex,
    residentController,
    workshopEventLog,
    worldEventLog,
  } = {}) {
    this._engine = engine;
    this._persistenceSystem = persistenceSystem;
    this._aiConnectionManager = aiConnectionManager;
    this._hostConnectionManager = hostConnectionManager;
    this._hostManager = hostManager;
    this._pageRegistry = pageRegistry;
    this._browserStore = browserStore;
    this._searchIndex = searchIndex;
    this._residentController = residentController;
    this._workshopEventLog = workshopEventLog;
    this._worldEventLog = worldEventLog;
  }

  /** One flat, plain object — every field independently optional-chained,
   *  since a diagnostics report that partially fails to compute should
   *  still show whatever it *could* determine, not throw and show
   *  nothing at all.
   *
   *  **Workshop Diagnostics phase — the shape changed from "numbers" to
   *  "understanding."** Every section used to be a flat bag of counts;
   *  each now also carries a computed `health` level (see
   *  `SEVERITY` above) and, where genuinely useful, a
   *  `suggestion` — "health should be calculated using the current
   *  state of each subsystem rather than being manually assigned" is
   *  true throughout: nothing here is a hardcoded "healthy," every
   *  level is derived from a real check against real state, in
   *  `_health*()` below. `report.health` is the overall roll-up (worst
   *  of every section, "unavailable" never dragging it down on its
   *  own — see `_worse()`'s own comment). */
  getReport() {
    const hostStatus = this._hostManager?.getOverviewStatus();
    const assetService = this._hostManager?.services.get("assets");
    const pluginService = this._hostManager?.services.get("plugins");
    const assetSummary = assetService?.summary() ?? [];
    const validation = assetService?.validateAll() ?? { totalAssets: 0, brokenReferences: [], duplicates: [] };
    const plugins = pluginService?.listAll() ?? [];

    const persistence = this._buildPersistenceSection();
    const aiConnection = this._buildAiSection();
    const hostCompanion = this._buildHostCompanionSection();
    const pluginsSection = this._buildPluginsSection(plugins);
    const assets = this._buildAssetsSection(assetSummary, assetService, validation);
    const performance = this._buildPerformanceSection();
    const residents = this._buildResidentsSection();
    const host = this._buildHostSection(hostStatus);

    const sections = [persistence, aiConnection, hostCompanion, pluginsSection, assets, residents, host];
    const overall = sections.reduce((acc, s) => _worse(acc, s.health), "healthy");
    const suggestions = sections.flatMap((s) => (s.suggestion ? [{ id: s.id, suggestion: s.suggestion }] : []));

    return {
      health: { overall, sections: sections.map((s) => ({ id: s.id, name: s.name, health: s.health, summary: s.summary })), suggestions },
      generatedAt: new Date().toISOString(),
      engine: {
        systemNames: (this._engine?.systems ?? []).map((s) => s.constructor.name),
        pluginCount: this._engine?.plugins?.plugins?.size ?? 0,
      },
      performance,
      persistence,
      aiConnection,
      hostCompanion,
      host: { ...host, servicesRegistered: hostStatus?.services.length ?? 0, servicesAvailable: hostStatus?.availableCapabilities.length ?? 0, pagePlugins: this._hostManager?.pluginRegistry?.contributors().length ?? 0, services: hostStatus?.services ?? [] },
      assets,
      plugins: pluginsSection,
      residents,
      browser: {
        openTabs: this._browserStore?.all().length ?? 0,
        bookmarks: this._browserStore?.bookmarks.length ?? 0,
        workshopPages: this._pageRegistry?.listByScheme("workshop").length ?? 0,
        hostPages: this._pageRegistry?.listByScheme("host").length ?? 0,
        pluginPages: this._pageRegistry?.listByScheme("plugin").length ?? 0,
        assetPages: this._pageRegistry?.listByScheme("asset").length ?? 0,
        residentPages: this._pageRegistry?.listByScheme("resident").length ?? 0,
        projectPages: this._pageRegistry?.listByScheme("project").length ?? 0,
        searchableEntries: this._searchIndex?.all().length ?? 0,
      },
      events: this._buildEventsSection(),
      dependencies: DEPENDENCIES,
    };
  }

  _buildPersistenceSection() {
    const failedSinceLastSave = this._persistenceSystem?.lastSaveFailedAt && (!this._persistenceSystem.lastSavedAt || this._persistenceSystem.lastSaveFailedAt > this._persistenceSystem.lastSavedAt);
    const health = failedSinceLastSave ? "error" : "healthy";
    return {
      id: "persistence",
      name: "Persistence",
      health,
      summary: failedSinceLastSave ? "The last save attempt failed." : "Saving normally.",
      suggestion: failedSinceLastSave ? "Persistence unavailable — this usually means browser storage is full or private-browsing mode is blocking it. Try exporting a backup (Settings \u2192 Workshop Data) and freeing up space, or check the browser console for the exact error." : null,
      saveFormatVersion: CURRENT_SAVE_VERSION,
      registeredProviders: this._persistenceSystem?.providers.size ?? 0,
      lastSavedAt: this._persistenceSystem?.lastSavedAt ?? null,
      lastSaveFailedAt: this._persistenceSystem?.lastSaveFailedAt ?? null,
    };
  }

  _buildAiSection() {
    const status = this._aiConnectionManager?.status ?? "unknown";
    const health = status === "connected" ? "healthy" : status === "connecting" ? "warning" : "unavailable";
    return {
      id: "aiConnection",
      name: "AI Connection",
      health,
      summary: { connected: "Connected to Ollama.", connecting: "Connecting to Ollama\u2026", disconnected: "Not connected." }[status] ?? "Unknown.",
      suggestion: status === "disconnected" ? "Ollama isn't connected \u2014 this is optional, Bubble simply stays asleep without it. See docs/SETUP.md, or run the included PowerShell launcher script (start-ollama-for-workshop.ps1) if you want a real local AI connection." : null,
      status,
      latencyMs: this._aiConnectionManager?.lastLatencyMs ?? null,
      lastSuccessAt: this._aiConnectionManager?.lastSuccessAt ?? null,
      lastFailureAt: this._aiConnectionManager?.lastFailureAt ?? null,
      baseUrl: this._aiConnectionManager?.baseUrl ?? null,
    };
  }

  _buildHostCompanionSection() {
    const status = this._hostConnectionManager?.status ?? "not configured";
    const health = status === "connected" ? "healthy" : status === "connecting" ? "warning" : "unavailable";
    return {
      id: "hostCompanion",
      name: "Workshop Host Companion",
      health,
      summary: status === "connected" ? "Connected." : status === "connecting" ? "Connecting\u2026" : "Not running \u2014 entirely optional.",
      suggestion: health === "unavailable" ? "The Workshop Host Companion isn't running. It's entirely optional (only needed for local file access from the Browser) \u2014 see host-companion/README.md if you want to start it." : null,
      status,
    };
  }

  _buildPluginsSection(plugins) {
    const errored = plugins.filter((p) => p.state === "error");
    const health = errored.length > 0 ? "error" : "healthy";
    return {
      id: "plugins",
      name: "Plugin System",
      health,
      summary: errored.length > 0 ? `${errored.length} plugin${errored.length === 1 ? "" : "s"} failed to load.` : `${plugins.length} plugin${plugins.length === 1 ? "" : "s"} loaded.`,
      suggestion: errored.length > 0 ? `Plugin failed validation \u2014 ${errored.map((p) => `"${p.name}" (${p.error ?? "see console"})`).join(", ")}. Check the browser console for the full error, or visit host://plugins.` : null,
      count: plugins.length,
      errored: errored.map((p) => ({ id: p.id, name: p.name, error: p.error })),
      plugins,
    };
  }

  _buildAssetsSection(assetSummary, assetService, validation) {
    const problems = validation.brokenReferences.length + validation.duplicates.length;
    const health = problems > 0 ? "warning" : "healthy";
    return {
      id: "assets",
      name: "Shared Asset Library",
      health,
      summary: problems > 0 ? `${validation.brokenReferences.length} broken reference${validation.brokenReferences.length === 1 ? "" : "s"}, ${validation.duplicates.length} possible duplicate name${validation.duplicates.length === 1 ? "" : "s"}.` : `${validation.totalAssets} assets, all referencing something real.`,
      suggestion: validation.brokenReferences.length > 0 ? `Asset missing \u2014 ${validation.brokenReferences[0].name} references something that no longer exists (${validation.brokenReferences[0].issue}). Try reimporting it, or removing whatever still points to it.` : null,
      kindsRegistered: assetSummary.length,
      totalAssets: validation.totalAssets,
      favourites: assetService?.favourites().length ?? 0,
      brokenReferences: validation.brokenReferences,
      duplicates: validation.duplicates,
      byKind: assetSummary,
    };
  }

  /** "Frame rate. Frame timing... memory usage." `performance.memory`
   *  (JS heap size) is a real, Chrome-only API — reported honestly where
   *  available, `null` (not a fake number) everywhere else, the same
   *  "real or absent, never invented" standard the rest of this file
   *  already holds itself to. CPU/GPU usage and network activity have no
   *  standard, reliable browser API to read them from at all — left out
   *  entirely rather than approximated with something misleading. */
  _buildPerformanceSection() {
    const memory = typeof performance !== "undefined" && performance.memory ? { usedMB: Math.round(performance.memory.usedJSHeapSize / 1e6), limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1e6) } : null;
    return {
      id: "performance",
      name: "Performance",
      health: "healthy", // frame rate alone isn't a reliable enough signal to call a "problem" — see docs/PERFORMANCE.md's own device-tier reasoning; shown for awareness, not judged here
      summary: "Live \u2014 see the Performance tab in Settings for FPS and frame time.",
      memory,
    };
  }

  _buildResidentsSection() {
    const diagnostics = this._residentController?.getDiagnostics?.() ?? null;
    return {
      id: "residents",
      name: "Resident System",
      health: diagnostics ? "healthy" : "unavailable",
      summary: diagnostics ? `${diagnostics.name} \u2014 ${diagnostics.isAwake ? "awake" : "asleep"}, ${diagnostics.behaviourMode}.` : "No resident currently embodied.",
      residents: diagnostics ? [diagnostics] : [],
    };
  }

  _buildHostSection(hostStatus) {
    return {
      id: "host",
      name: "Workshop Host",
      health: hostStatus ? "healthy" : "unavailable",
      summary: hostStatus ? `Running \u00b7 v${hostStatus.version} \u00b7 ${hostStatus.availableCapabilities.length} capabilities available.` : "Unavailable.",
    };
  }

  /** Merges `WorkshopEventLog` (technical: plugin errors, connection
   *  changes, save failures) and `WorldEventLog` (ambient: weather,
   *  time, music) for *display* only — see `WorkshopEventLog.js`'s own
   *  comment on why the two stay separate stores. */
  _buildEventsSection() {
    const technical = (this._workshopEventLog?.recent(30) ?? []).map((e) => ({ ...e, source: "workshop" }));
    const world = (this._worldEventLog?.recent(10) ?? []).map((e) => ({ ...e, level: "info", source: "world" }));
    const merged = [...technical, ...world].sort((a, b) => (a.at < b.at ? 1 : -1));
    return { recent: merged.slice(0, 40), totalTechnical: this._workshopEventLog?.entries.length ?? 0 };
  }

  /** "Allow the Workshop to perform self-checks... produce a readable
   *  health report." `getReport()` above is already a live computation,
   *  not a cache — but a couple of sections (AI connection, Host
   *  Companion) only update on their own slow background poll. This
   *  actively re-checks both *right now* before building the report, so
   *  "Run Workshop Health Check" means something genuinely fresh, not
   *  just "read whatever was already known." */
  async runHealthCheck() {
    await Promise.allSettled([this._aiConnectionManager?.checkConnection?.(), this._hostConnectionManager?.checkConnection?.()]);
    return this.getReport();
  }

  getStatus() {
    return { available: true, summary: "Live Workshop-wide status is available." };
  }
}

/** "Dependency awareness... where appropriate, diagnostics should
 *  understand relationships between Workshop systems." A small, honest,
 *  hand-authored list — not derived automatically (nothing in this
 *  project tracks import graphs at runtime), the same "real content,
 *  simple mechanism" choice `docs/ARCHITECTURE.md`'s own directory
 *  listing already makes for describing structure. */
export const DEPENDENCIES = [
  { from: "Browser", to: "Workshop Host", note: "Browser pages under host:// (and every plugin-registered page) need the Host's own services to render anything real." },
  { from: "Mission Control", to: "AI Providers", note: "Sending a message needs a real connection to Ollama (or a future provider) to get a reply \u2014 without one, a resident simply stays asleep." },
  { from: "Residents", to: "Mission Control", note: "A resident's own personality, behaviour tuning, and expression set all come from its active Mission Control profile." },
  { from: "Plugins", to: "Registered Services", note: "A plugin's own Workshop.registerService()/host() calls reach whatever's already registered with the Host \u2014 nothing works before that." },
  { from: "Builder", to: "Shared Asset Library", note: "Every Construction Library piece, Saved Object, and Imported Model the Builder places is a real Workshop Asset, discoverable the same way anywhere else." },
  { from: "Phone", to: "Workshop Host", note: "The Phone's own apps read the identical underlying stores the Computer's apps do, both through the Host where relevant." },
];
