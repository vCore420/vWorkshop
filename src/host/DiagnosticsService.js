import { CURRENT_SAVE_VERSION } from "../systems/SaveMigrations.js";

/**
 * DiagnosticsService
 * --------------------
 * "Diagnostics Service" — named explicitly in this phase's own brief
 * alongside the other eight. `workshop://diagnostics` (Browser Ecosystem
 * phase) already computed a Workshop-wide health report ad hoc, directly
 * inside `WorkshopPages.js`; this service is that same computation moved
 * to one reusable place, read by both `workshop://diagnostics` and
 * `host://services`' own Dashboard, rather than two slowly-diverging
 * copies of the same status check.
 *
 * Like `AssetService.js`/`ResidentService.js`, this is genuinely real —
 * every number here comes from a real, already-existing system
 * (`engine.systems`, `PersistenceSystem`, `AIConnectionManager`,
 * `HostConnectionManager`, `PageRegistry`, `BrowserStore`,
 * `SearchIndex`). There's nothing to fake about "how many systems are
 * currently running" — it's either counted correctly or not.
 */
export class DiagnosticsService {
  constructor({ engine, persistenceSystem, aiConnectionManager, hostConnectionManager, hostManager, pageRegistry, browserStore, searchIndex } = {}) {
    this._engine = engine;
    this._persistenceSystem = persistenceSystem;
    this._aiConnectionManager = aiConnectionManager;
    this._hostConnectionManager = hostConnectionManager;
    this._hostManager = hostManager;
    this._pageRegistry = pageRegistry;
    this._browserStore = browserStore;
    this._searchIndex = searchIndex;
  }

  /** One flat, plain object — every field independently optional-chained,
   *  since a diagnostics report that partially fails to compute should
   *  still show whatever it *could* determine, not throw and show
   *  nothing at all. */
  getReport() {
    const hostStatus = this._hostManager?.getOverviewStatus();
    const assetService = this._hostManager?.services.get("assets");
    const assetSummary = assetService?.summary() ?? [];
    return {
      engine: {
        systemNames: (this._engine?.systems ?? []).map((s) => s.constructor.name),
        pluginCount: this._engine?.plugins?.plugins?.size ?? 0,
      },
      persistence: {
        saveFormatVersion: CURRENT_SAVE_VERSION,
        registeredProviders: this._persistenceSystem?.providers.size ?? 0,
      },
      aiConnection: {
        status: this._aiConnectionManager?.status ?? "unknown",
        latencyMs: this._aiConnectionManager?.lastLatencyMs ?? null,
      },
      hostCompanion: {
        status: this._hostConnectionManager?.status ?? "not configured",
      },
      host: {
        servicesRegistered: hostStatus?.services.length ?? 0,
        servicesAvailable: hostStatus?.availableCapabilities.length ?? 0,
        pagePlugins: this._hostManager?.pluginRegistry?.contributors().length ?? 0,
      },
      assets: {
        kindsRegistered: assetSummary.length,
        totalAssets: assetSummary.reduce((sum, row) => sum + row.count, 0),
        favourites: assetService?.favourites().length ?? 0,
      },
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
    };
  }

  getStatus() {
    return { available: true, summary: "Live Workshop-wide status is available." };
  }
}
