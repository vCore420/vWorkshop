import { wrapPage } from "./PageShell.js";
import { renderMarkdown } from "../utils/SimpleMarkdown.js";
import { HOME_URL } from "./BrowserStore.js";
import { CURRENT_SAVE_VERSION } from "../systems/SaveMigrations.js";
import { getIdleLocation } from "../resident/ResidentMovement.js";
import { getProvider } from "../ai/ProviderRegistry.js";
import { PERSONALITY_TRAITS } from "../ai/TraitConfiguration.js";
import { EMBODIMENT_TYPES } from "../ai/EmbodimentConfiguration.js";

/**
 * WorkshopPages
 * ---------------
 * Registers every built-in `workshop://` page with `PageRegistry` — see
 * that file's own comment on why this centralised registration doesn't
 * compromise "the Browser doesn't know about Workshop systems, systems
 * expose pages to it": the Browser still only ever talks to the
 * registry, never to `projectsStore` or any docs file directly.
 *
 * **Real documentation, not stub pages.** `workshop://documentation`,
 * `workshop://builder`, and `workshop://animation` `fetch()` this
 * project's own actual `README.md`/`docs/WORLDBUILDER.md`/
 * `docs/PLAYER.md` from the deployed site (the exact same static files
 * this repository already ships — GitHub Pages serves the whole
 * repository, `docs/*.md` included, so a root-relative fetch reaches the
 * genuine, currently-accurate file, not a frozen copy that drifts out of
 * date the next time these docs change) and render them with
 * `SimpleMarkdown.js`. A network failure (offline, a very unusual
 * deployment layout) falls back to a short, honest explanation rather
 * than a blank page or a thrown error.
 *
 * **Browser Ecosystem phase**: `workshop://documentation` is the new
 * canonical name (matching the brief's own naming); `workshop://docs`
 * keeps working as an alias — both registered against the identical
 * provider — so existing bookmarks and history entries from earlier
 * phases still resolve correctly. Five new pages arrived this phase —
 * `workshop://residents`, `workshop://assets` (see its own
 * `AssetPages.js`), `workshop://diagnostics`, `workshop://mission-control`,
 * `workshop://bookmarks`, `workshop://search` — each registered here (or,
 * for assets, in its own file) alongside a matching `searchIndex.addEntry()`
 * call, so Unified Search knows about it too.
 */
export function registerWorkshopPages(pageRegistry, searchIndex, deps) {
  const { projectsStore, browserStore, hostProjectsService, residentProfileStore, residentState, residentBehaviour, conversationMemory, aiConnectionManager, engine, hostManager } = deps;

  pageRegistry.register("workshop://", () => homePage({ browserStore, hostManager, residentProfileStore }));
  pageRegistry.register("workshop://documentation", () => docFilePage("Workshop Documentation", "./README.md"));
  pageRegistry.register("workshop://docs", () => docFilePage("Workshop Documentation", "./README.md")); // alias — see this file's own comment
  pageRegistry.register("workshop://builder", () => docFilePage("Builder Documentation", "./docs/WORLDBUILDER.md"));
  pageRegistry.register("workshop://animation", () => docFilePage("Player & Animation Documentation", "./docs/PLAYER.md"));
  pageRegistry.register("workshop://projects", () => projectsPage(projectsStore, hostProjectsService));
  pageRegistry.register("workshop://settings", () => settingsPage());
  pageRegistry.register("workshop://residents", () => residentsPage({ residentProfileStore, residentState, residentBehaviour, conversationMemory, aiConnectionManager }));
  pageRegistry.register("workshop://diagnostics", () => diagnosticsPage(deps));
  pageRegistry.register("workshop://mission-control", () => missionControlPage({ residentProfileStore, aiConnectionManager }));
  pageRegistry.register("workshop://bookmarks", () => bookmarksPage(browserStore));
  pageRegistry.register("workshop://search", (url) => searchPage(url, searchIndex));

  searchIndex.addEntries([
    { url: "workshop://", title: "Workshop Home", category: "Workshop", keywords: ["home", "start"] },
    { url: "workshop://documentation", title: "Workshop Documentation", category: "Documentation", keywords: ["docs", "readme", "help"] },
    { url: "workshop://builder", title: "Builder Documentation", category: "Documentation", keywords: ["builder", "construction", "objects"] },
    { url: "workshop://animation", title: "Player & Animation Documentation", category: "Documentation", keywords: ["animation", "player", "movement"] },
    { url: "workshop://projects", title: "Workshop Projects", category: "Workshop", keywords: ["notebook", "pinboard", "workbench"] },
    { url: "workshop://settings", title: "Browser Settings", category: "Workshop", keywords: ["preferences", "clear data"] },
    { url: "workshop://residents", title: "Residents", category: "Workshop", keywords: ["bubble", "resident", "ai", "mission control"] },
    { url: "workshop://diagnostics", title: "Workshop Diagnostics", category: "Workshop", keywords: ["status", "health", "systems", "debug"] },
    { url: "workshop://mission-control", title: "Mission Control", category: "Workshop", keywords: ["ai", "resident", "bubble"] },
    { url: "workshop://bookmarks", title: "Bookmarks", category: "Workshop", keywords: ["saved", "favourites"] },
  ]);
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} responded with ${response.status}`);
  return response.text();
}

async function docFilePage(title, path) {
  let bodyHtml;
  try {
    const markdown = await fetchText(path);
    bodyHtml = renderMarkdown(markdown);
  } catch {
    bodyHtml = `<p class="workshop-page-empty">Couldn't load this documentation file right now (${escapeHtml(path)}). If you're viewing the Workshop from somewhere other than its normal deployed address, this page may not be reachable from here.</p>`;
  }
  return { title, html: wrapPage(title, `<span class="workshop-page-badge">Workshop Docs</span>${bodyHtml}`) };
}

function homePage({ browserStore, hostManager, residentProfileStore }) {
  const recents = collectRecentUrls(browserStore);
  const recentsHtml = recents.length
    ? `<div class="workshop-home-grid">${recents.map((url) => tile(url, url)).join("")}</div>`
    : `<p class="workshop-page-empty">Nowhere visited yet this session.</p>`;

  const activeResident = residentProfileStore?.getActive();
  const hostStatus = hostManager?.getOverviewStatus();

  const html = `
    <h1>Workshop Home</h1>
    <p class="workshop-page-subtitle">Your window into everything \u2014 the Workshop, your local machine, and the wider digital world.</p>

    <div class="workshop-home-section">
      <input class="workshop-search-box" type="text" placeholder="Search the Workshop\u2026" id="home-search-box" autocomplete="off">
    </div>

    <div class="workshop-home-section">
      <h2>Workshop</h2>
      <div class="workshop-home-grid">
        ${tile("workshop://residents", "Residents", activeResident ? `${activeResident.name} and friends` : "No residents yet")}
        ${tile("workshop://assets", "Shared Asset Library", "Objects, blueprints, animations, and more")}
        ${tile("workshop://projects", "Workshop Projects", "Everything you're building")}
        ${tile("workshop://mission-control", "Mission Control", "AI resident status snapshot")}
        ${tile("workshop://diagnostics", "Diagnostics", "Workshop status and system health")}
        ${tile("workshop://documentation", "Workshop Documentation", "How the Workshop is built")}
        ${tile("workshop://builder", "Builder Documentation", "Building objects and behaviours")}
        ${tile("workshop://animation", "Player & Animation", "Identity, movement, and animation")}
        ${tile("workshop://bookmarks", "Bookmarks", "Pages you've saved")}
        ${tile("workshop://settings", "Browser Settings", "This browser's own preferences")}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Workshop Host</h2>
      <p class="workshop-page-subtitle" style="margin-bottom:10px;">The Workshop's bridge to your local machine \u2014 ${hostStatus?.availableCapabilities.length ?? 0} of ${hostStatus?.services.length ?? 0} services currently available.</p>
      <div class="workshop-home-grid">
        ${tile("host://services", "Host Services", "Dashboard and status")}
        ${tile("host://applications", "Applications", "Installed applications")}
        ${tile("host://projects", "Local Projects", "Projects on your own computer")}
        ${tile("host://documents", "Documents", "Local document access")}
        ${tile("host://downloads", "Downloads", "Recent downloads")}
        ${tile("host://plugins", "Plugins", "What plugins have contributed")}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Recently visited</h2>
      ${recentsHtml}
    </div>

    <script>
      document.getElementById("home-search-box").addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const q = event.target.value.trim();
        if (q) window.parent.postMessage({ type: "workshop-browser-navigate", url: "workshop://search?q=" + encodeURIComponent(q) }, "*");
      });
    </script>
  `;
  return { title: "Workshop Home", html: wrapPage("Workshop Home", html) };
}

function collectRecentUrls(browserStore) {
  const seen = new Set();
  const urls = [];
  for (const tab of browserStore?.all() ?? []) {
    for (let i = tab.historyIndex; i >= 0 && urls.length < 8; i--) {
      const url = tab.history[i];
      if (url === HOME_URL || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return urls.slice(0, 8);
}

function projectsPage(projectsStore, hostProjectsService) {
  const projects = projectsStore?.all() ?? [];
  const rows = projects.length
    ? projects
        .slice()
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(
          (p) => `<div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(p.title)}</span><span class="workshop-home-tile-meta">${escapeHtml(p.status)}${p.notes ? " \u2014 " + escapeHtml(truncate(p.notes, 80)) : ""}</span></div>`
        )
        .join("")
    : `<p class="workshop-page-empty">No projects yet — start one from the Notebook, Pinboard, or Workbench.</p>`;

  // "Projects" means two genuinely different things that happen to share
  // a name — the Workshop's own Notebook entries (above, real today) and
  // local filesystem projects on the player's actual computer (below,
  // now living at its own host://projects page — see HostPages.js).
  const hostStatus = hostProjectsService?.getStatus?.() ?? { summary: "Not available." };
  const html = `
    <h1>Projects</h1>
    <p class="workshop-page-subtitle">Everything you're building — inside the Workshop, and (eventually) on your own computer.</p>

    <div class="workshop-home-section">
      <h2>Workshop Projects</h2>
      <p class="workshop-page-subtitle" style="margin-bottom:12px;">Live from ProjectsStore — the same board as the Notebook, Pinboard, and Workbench.</p>
      <div class="workshop-home-grid">${rows}</div>
    </div>

    <div class="workshop-home-section">
      <h2>Local Projects</h2>
      <span class="workshop-page-badge">Workshop Host \u2014 not active yet</span>
      <p>${escapeHtml(hostStatus.summary)} See <a href="host://projects">host://projects</a> for the dedicated Host page.</p>
    </div>
  `;
  return { title: "Projects", html: wrapPage("Projects", html) };
}

function settingsPage() {
  const html = `
    <h1>Browser Settings</h1>
    <p class="workshop-page-subtitle">This browser's own preferences.</p>
    <p>Open tabs, navigation history, bookmarks, and the active tab are all remembered automatically between Workshop sessions — there's nothing to turn on.</p>
    <h2>Clear browsing data</h2>
    <p>Closes every tab and forgets all navigation history, leaving one fresh tab at Workshop Home. Bookmarks are kept \u2014 remove those individually from <a href="workshop://bookmarks">workshop://bookmarks</a>.</p>
    <button id="clear-browsing-data" style="font-family:var(--font-body);font-weight:600;background:var(--brass);color:var(--wood-dark);border:none;border-radius:8px;padding:10px 18px;cursor:pointer;">Clear Browsing Data</button>
    <script>
      document.getElementById("clear-browsing-data").addEventListener("click", () => {
        window.parent.postMessage({ type: "workshop-browser-clear-data" }, "*");
      });
    </script>
  `;
  return { title: "Browser Settings", html: wrapPage("Browser Settings", html) };
}

/** "workshop://residents — Resident information." A read-only mirror of
 *  Mission Control's own Resident Health section (see docs/AI.md), as a
 *  browsable page rather than a computer app — the same live data,
 *  reached a different way. Every profile is listed, not only the active
 *  one, matching `docs/AI.md`'s own multi-profile support. */
function residentsPage({ residentProfileStore, residentState, residentBehaviour, conversationMemory, aiConnectionManager }) {
  const profiles = residentProfileStore?.all() ?? [];
  const activeId = residentProfileStore?.activeProfileId;

  const rows = profiles
    .map((profile) => {
      const isActive = profile.id === activeId;
      const traitLabels = profile.traits.selected.map((id) => PERSONALITY_TRAITS.find((t) => t.id === id)?.label ?? id).join(", ") || "None set";
      const embodimentLabel = EMBODIMENT_TYPES.find((t) => t.id === profile.embodiment.type)?.label ?? profile.embodiment.type;
      return `
        <div class="workshop-home-section">
          <h3>${escapeHtml(profile.name)}${isActive ? ' <span class="workshop-page-badge">Active \u2014 embodied as Bubble</span>' : ""}</h3>
          <div class="workshop-diagnostics-grid">
            ${metaRow("Provider", getProvider(profile.provider).label)}
            ${metaRow("Model", profile.model || "None selected")}
            ${metaRow("Traits", traitLabels)}
            ${metaRow("Embodiment", embodimentLabel)}
            ${metaRow("Memory mode", profile.memory.mode)}
          </div>
        </div>
      `;
    })
    .join("");

  const activeSnapshot = activeId
    ? `
      <div class="workshop-home-section">
        <h2>Right now</h2>
        <div class="workshop-diagnostics-grid">
          ${metaRow("Connection", aiConnectionManager?.status ?? "unknown")}
          ${metaRow("Current activity", residentBehaviour?.mode === "conversing" ? "In conversation" : "Going about its day")}
          ${metaRow("Current mood", capitalize(residentState?.mood))}
          ${metaRow("Current location", residentState?.idleLocationId ? getIdleLocation(residentState.idleLocationId).label : "Unknown")}
          ${metaRow("Things remembered", String(conversationMemory?.notes.length ?? 0))}
        </div>
      </div>
    `
    : "";

  const html = `
    <h1>Residents</h1>
    <p class="workshop-page-subtitle">Every prepared resident, and how the currently-embodied one is doing right now.</p>
    ${activeSnapshot}
    <h2>Profiles</h2>
    ${rows || '<p class="workshop-page-empty">No resident profiles exist yet.</p>'}
    <p style="margin-top:20px;">Configure any of these in <a href="workshop://mission-control">Mission Control</a>, or open AI Control from the Computer's rail directly.</p>
  `;
  return { title: "Residents", html: wrapPage("Residents", html) };
}

/** "workshop://mission-control — Mission Control." Mission Control
 *  itself lives in a computer app (`AIApp.js`), not a Browser page — full
 *  editing needs richer controls (sliders, checkboxes) than a read-only
 *  `srcdoc` page manages cleanly. This is an honest bridge: a live
 *  snapshot of the active resident's own Mission Control state, with a
 *  plain pointer to where changes are actually made. */
function missionControlPage({ residentProfileStore, aiConnectionManager }) {
  const profile = residentProfileStore?.getActive();
  const html = profile
    ? `
      <h1>Mission Control</h1>
      <p class="workshop-page-subtitle">A live snapshot \u2014 open AI Control from the Computer's rail to actually make changes.</p>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Resident", profile.name)}
        ${metaRow("Provider", getProvider(profile.provider).label)}
        ${metaRow("Model", profile.model || "None selected")}
        ${metaRow("Connection", aiConnectionManager?.status ?? "unknown")}
        ${metaRow("Purpose", profile.identity.purpose || "Not set")}
        ${metaRow("Personality", profile.identity.personality || "Not set")}
      </div>
      <p style="margin-top:20px;">See <a href="workshop://residents">workshop://residents</a> for every profile, or <code>docs/AI.md</code> for the full account of what Mission Control does.</p>
    `
    : `<h1>Mission Control</h1><p class="workshop-page-empty">No resident profile exists yet.</p>`;
  return { title: "Mission Control", html: wrapPage("Mission Control", html) };
}

/** "Workshop status." A calm, honest health check — every engine system
 *  that's currently running, persistence's own save format version and
 *  provider count, the AI connection, and the Browser/Host/Plugin
 *  ecosystem's own size — reusing the "plain read-only grid" shape
 *  Mission Control's own Resident Health section already established
 *  (see docs/AI.md), rather than inventing a second look for the same
 *  kind of information. */
function diagnosticsPage({ engine, persistenceSystem, aiConnectionManager, hostManager, pageRegistry, browserStore, searchIndex }) {
  const systemNames = (engine?.systems ?? []).map((s) => s.constructor.name);
  const hostStatus = hostManager?.getOverviewStatus();
  const pluginCount = engine?.plugins?.plugins?.size ?? 0;
  const pageContributors = hostManager?.pluginRegistry?.contributors().length ?? 0;

  const html = `
    <h1>Workshop Diagnostics</h1>
    <p class="workshop-page-subtitle">A calm status check \u2014 what's running, what's connected, and how much the Workshop currently holds.</p>

    <div class="workshop-home-section">
      <h2>Engine</h2>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Systems running", String(systemNames.length))}
        ${metaRow("Engine plugins registered", String(pluginCount))}
      </div>
      <p class="workshop-page-subtitle" style="margin-top:8px;">${systemNames.map(escapeHtml).join(", ")}</p>
    </div>

    <div class="workshop-home-section">
      <h2>Persistence</h2>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Save format version", String(CURRENT_SAVE_VERSION))}
        ${metaRow("Registered providers", String(persistenceSystem?.providers.size ?? 0))}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>AI Connection</h2>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Status", aiConnectionManager?.status ?? "unknown")}
        ${metaRow("Latency", aiConnectionManager?.lastLatencyMs != null ? `${aiConnectionManager.lastLatencyMs} ms` : "\u2014")}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Workshop Host</h2>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Services registered", String(hostStatus?.services.length ?? 0))}
        ${metaRow("Services available", String(hostStatus?.availableCapabilities.length ?? 0))}
        ${metaRow("Plugins contributing pages", String(pageContributors))}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Browser</h2>
      <div class="workshop-diagnostics-grid">
        ${metaRow("Open tabs", String(browserStore?.all().length ?? 0))}
        ${metaRow("Bookmarks", String(browserStore?.bookmarks.length ?? 0))}
        ${metaRow("Registered workshop:// pages", String(pageRegistry?.listByScheme("workshop").length ?? 0))}
        ${metaRow("Registered host:// pages", String(pageRegistry?.listByScheme("host").length ?? 0))}
        ${metaRow("Registered plugin:// pages", String(pageRegistry?.listByScheme("plugin").length ?? 0))}
        ${metaRow("Searchable entries", String(searchIndex?.all().length ?? 0))}
      </div>
    </div>
  `;
  return { title: "Workshop Diagnostics", html: wrapPage("Workshop Diagnostics", html) };
}

/** "Bookmarks... continue improving the browsing experience." The same
 *  `BrowserStore.bookmarks` list the Phone's own Browser app and the full
 *  Browser's new toolbar star both read and write — one shared list,
 *  three ways to see it. */
function bookmarksPage(browserStore) {
  const bookmarks = browserStore?.bookmarks ?? [];
  const rows = bookmarks
    .map(
      (b, i) => `
        <div class="workshop-home-tile" style="display:flex;justify-content:space-between;align-items:center;">
          <a href="${escapeHtml(b.url)}" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.title)}</a>
          <button data-remove-index="${i}" style="background:none;border:none;color:var(--ink-soft);cursor:pointer;font-size:0.85rem;">Remove</button>
        </div>
      `
    )
    .join("");

  const html = `
    <h1>Bookmarks</h1>
    <p class="workshop-page-subtitle">Pages you've saved \u2014 the same list from the Browser's own star button and the Phone's Browser app.</p>
    ${bookmarks.length ? `<div class="workshop-home-grid" style="grid-template-columns:1fr;">${rows}</div>` : '<p class="workshop-page-empty">No bookmarks yet \u2014 star a page from the Browser\u2019s own toolbar to save it here.</p>'}
    <script>
      document.querySelectorAll("[data-remove-index]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          window.parent.postMessage({ type: "workshop-browser-remove-bookmark", index: Number(btn.dataset.removeIndex) }, "*");
        });
      });
    </script>
  `;
  return { title: "Bookmarks", html: wrapPage("Bookmarks", html) };
}

/** "Please introduce the foundations for unified searching... For this
 *  phase, please establish the architecture and integrate wherever
 *  practical." `url` carries the query as `?q=...` (a deliberately
 *  simple, non-percent-encoded convention — see `SearchIndex.js`'s own
 *  comment on why this stays simple); every entry currently in
 *  `SearchIndex` is baked into the page as a plain array and filtered
 *  client-side as the person types, the same "small, self-contained
 *  script" technique `plugin://calculator` uses for real interactivity
 *  inside a `srcdoc` page. */
function searchPage(url, searchIndex) {
  const queryMatch = /[?&]q=([^&]*)/.exec(url);
  const initialQuery = queryMatch ? decodeURIComponent(queryMatch[1]) : "";
  const entries = searchIndex?.all() ?? [];

  const html = `
    <h1>Search</h1>
    <p class="workshop-page-subtitle">Workshop pages, Host pages, and plugin pages, all in one place.</p>
    <input class="workshop-search-box" type="text" id="search-input" placeholder="Search everything\u2026" autocomplete="off" value="${escapeHtml(initialQuery)}">
    <div class="workshop-search-results" id="search-results"></div>
    <script>
      const ENTRIES = ${JSON.stringify(entries)};
      const input = document.getElementById("search-input");
      const results = document.getElementById("search-results");

      // Every entry today is a static, developer-authored title (see
      // WorkshopPages.js/HostPages.js/AssetPages.js's own addEntry()
      // calls) — but SearchIndex.js's own comment explicitly invites a
      // future phase to index individual, player-named things (an
      // object definition, a resident) the same way, so this escapes
      // defensively now rather than only once that actually happens.
      function escapeHtml(text) {
        return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }

      function render(query) {
        const q = query.trim().toLowerCase();
        const matches = !q
          ? ENTRIES
          : ENTRIES.filter((e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.keywords.some((k) => k.toLowerCase().includes(q)));
        results.innerHTML = matches.length
          ? matches.map((e) => \`<a class="workshop-home-tile" href="\${escapeHtml(e.url)}"><span class="workshop-home-tile-title">\${escapeHtml(e.title)}</span><span class="workshop-home-tile-meta">\${escapeHtml(e.category)} \u00b7 \${escapeHtml(e.url)}</span></a>\`).join("")
          : '<p class="workshop-search-empty">Nothing found.</p>';
      }

      input.addEventListener("input", () => render(input.value));
      render(input.value);
    </script>
  `;
  return { title: "Search", html: wrapPage("Search", html) };
}

function tile(url, title, meta) {
  return `<a class="workshop-home-tile" href="${escapeHtml(url)}"><span class="workshop-home-tile-title">${escapeHtml(title)}</span>${meta ? `<span class="workshop-home-tile-meta">${escapeHtml(meta)}</span>` : ""}</a>`;
}

function metaRow(label, value) {
  return `<div class="workshop-diagnostics-row"><span class="workshop-diagnostics-label">${escapeHtml(label)}</span><span class="workshop-diagnostics-value">${escapeHtml(value)}</span></div>`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

function capitalize(text) {
  const value = String(text ?? "");
  return value ? value[0].toUpperCase() + value.slice(1) : "Unknown";
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
