import { wrapPage } from "./PageShell.js";
import { renderMarkdown } from "../utils/SimpleMarkdown.js";
import { HOME_URL } from "./BrowserStore.js";

/**
 * WorkshopPages
 * ---------------
 * Registers every built-in `workshop://` page with `PageRegistry` — see
 * that file's own comment on why this centralised registration doesn't
 * compromise "the Browser doesn't know about Workshop systems, systems
 * expose pages to it": the Browser still only ever talks to the
 * registry, never to `projectsStore` or any docs file directly.
 *
 * **Real documentation, not stub pages.** `workshop://docs`,
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
 * **`workshop://host` used to be a placeholder here** — "the Workshop
 * Host is NOT being implemented during this phase... simply prepare the
 * architecture so they can slot in naturally later," from the phase this
 * file was first written in. That preparation held up exactly as
 * intended: `HostPages.js` now registers the real `workshop://host` (and
 * `programs`/`files`/`models`/`plugins`/`automation` beside it),
 * overwriting this file's own old placeholder the moment
 * `main.js` calls `registerHostPages()` after this function — nothing
 * about `BrowserApp.js` or `PageRegistry.js` needed to change at all to
 * make that swap possible.
 */
export function registerWorkshopPages(pageRegistry, { projectsStore, browserStore, hostProjectsService }) {
  pageRegistry.register("", () => homePage(browserStore));
  pageRegistry.register("docs", () => docFilePage("Workshop Documentation", "./README.md"));
  pageRegistry.register("builder", () => docFilePage("Builder Documentation", "./docs/WORLDBUILDER.md"));
  pageRegistry.register("animation", () => docFilePage("Player & Animation Documentation", "./docs/PLAYER.md"));
  pageRegistry.register("projects", () => projectsPage(projectsStore, hostProjectsService));
  pageRegistry.register("settings", () => settingsPage());
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

function homePage(browserStore) {
  const recents = collectRecentUrls(browserStore);
  const recentsHtml = recents.length
    ? `<div class="workshop-home-grid">${recents.map((url) => tile(url, url)).join("")}</div>`
    : `<p class="workshop-page-empty">Nowhere visited yet this session.</p>`;

  const html = `
    <h1>Workshop Home</h1>
    <p class="workshop-page-subtitle">Your gateway between the Workshop and the wider digital world.</p>

    <div class="workshop-home-section">
      <h2>Workshop</h2>
      <div class="workshop-home-grid">
        ${tile("workshop://docs", "Workshop Documentation", "How the Workshop is built")}
        ${tile("workshop://builder", "Builder Documentation", "Building objects and behaviours")}
        ${tile("workshop://animation", "Player & Animation", "Identity, movement, and animation")}
        ${tile("workshop://projects", "Workshop Projects", "Everything you're building")}
        ${tile("workshop://settings", "Browser Settings", "This browser's own preferences")}
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Recently visited</h2>
      ${recentsHtml}
    </div>
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
  // prepared architecture via the Workshop Host's own ProjectsService,
  // not yet functional — see docs/HOST.md). Shown together on one page
  // rather than a confusing second "projects" URL.
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
      <p>${escapeHtml(hostStatus.summary)}</p>
    </div>
  `;
  return { title: "Projects", html: wrapPage("Projects", html) };
}

function settingsPage() {
  const html = `
    <h1>Browser Settings</h1>
    <p class="workshop-page-subtitle">This browser's own preferences.</p>
    <p>Open tabs, navigation history, and the active tab are all remembered automatically between Workshop sessions — there's nothing to turn on.</p>
    <h2>Clear browsing data</h2>
    <p>Closes every tab and forgets all navigation history, leaving one fresh tab at Workshop Home.</p>
    <button id="clear-browsing-data" style="font-family:var(--font-body);font-weight:600;background:var(--brass);color:var(--wood-dark);border:none;border-radius:8px;padding:10px 18px;cursor:pointer;">Clear Browsing Data</button>
    <script>
      document.getElementById("clear-browsing-data").addEventListener("click", () => {
        window.parent.postMessage({ type: "workshop-browser-clear-data" }, "*");
      });
    </script>
  `;
  return { title: "Browser Settings", html: wrapPage("Browser Settings", html) };
}

function tile(url, title, meta) {
  return `<a class="workshop-home-tile" href="${escapeHtml(url)}"><span class="workshop-home-tile-title">${escapeHtml(title)}</span>${meta ? `<span class="workshop-home-tile-meta">${escapeHtml(meta)}</span>` : ""}</a>`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
