import { wrapPage } from "../browser/PageShell.js";

/**
 * HostPages
 * -----------
 * "Every Host feature should eventually be exposed through Workshop
 * pages... the Browser should simply display these pages." Registers
 * `host://services` (the Dashboard) and its sibling service pages with
 * `PageRegistry`, the exact same mechanism `WorkshopPages.js` already
 * uses for Home/Docs/Projects/Settings. `BrowserApp.js` needed zero
 * changes to gain these — that's the entire point of the registry
 * existing.
 *
 * **Browser Ecosystem phase: a real `host://` scheme.** Every Host page
 * previously lived under `workshop://` (`workshop://host`,
 * `workshop://programs`, and so on) — a reasonable starting point when
 * `PageRegistry` only understood one scheme, but "continue expanding
 * Host integration" is also the moment to give the Host its own proper
 * namespace, matching how the brief itself writes these URLs. Old
 * `workshop://host`/`workshop://programs` keep resolving (registered
 * alongside their new `host://` names, pointing at the identical
 * provider) so existing bookmarks and history entries don't quietly
 * break.
 *
 * Every page here reads live from `HostManager`/`ModelRegistry` at
 * resolve time, never a snapshot frozen at registration — the same
 * "provider is just a function, called fresh on every navigation"
 * property `workshop://projects` already relies on.
 */
export function registerHostPages(pageRegistry, searchIndex, { hostManager, modelRegistry }) {
  pageRegistry.register("host://services", () => hostDashboardPage(hostManager));
  pageRegistry.register("workshop://host", () => hostDashboardPage(hostManager)); // alias — see this file's own comment

  pageRegistry.register("host://applications", () => servicePreviewPage("Applications", hostManager.services.get("programs"), "name", "kind"));
  pageRegistry.register("workshop://programs", () => servicePreviewPage("Applications", hostManager.services.get("programs"), "name", "kind")); // alias

  pageRegistry.register("host://projects", () => servicePreviewPage("Local Projects", hostManager.services.get("projects"), "name", "kind", "modified"));

  pageRegistry.register("host://documents", () => servicePreviewPage("Documents", hostManager.services.get("documents"), "name", "kind", "modified"));
  pageRegistry.register("host://downloads", () => servicePreviewPage("Downloads", hostManager.services.get("downloads"), "name", "kind", "modified"));

  pageRegistry.register("host://files", () => servicePage("Files", hostManager.services.get("files")));
  pageRegistry.register("workshop://files", () => servicePage("Files", hostManager.services.get("files"))); // alias

  pageRegistry.register("host://automation", () => servicePage("Automation", hostManager.services.get("automation")));
  pageRegistry.register("workshop://automation", () => servicePage("Automation", hostManager.services.get("automation"))); // alias

  pageRegistry.register("host://hardware", () => servicePage("Hardware", hostManager.services.get("hardware")));

  pageRegistry.register("host://models", () => modelsPage(modelRegistry));
  pageRegistry.register("workshop://models", () => modelsPage(modelRegistry)); // alias

  pageRegistry.register("host://plugins", () => pluginsPage(hostManager.pluginRegistry));
  pageRegistry.register("workshop://plugins", () => pluginsPage(hostManager.pluginRegistry)); // alias

  searchIndex.addEntries([
    { url: "host://services", title: "Host Services", category: "Host", keywords: ["dashboard", "status"] },
    { url: "host://applications", title: "Applications", category: "Host", keywords: ["programs", "apps", "launch"] },
    { url: "host://projects", title: "Local Projects", category: "Host", keywords: ["folders", "editor"] },
    { url: "host://documents", title: "Documents", category: "Host", keywords: ["files", "text"] },
    { url: "host://downloads", title: "Downloads", category: "Host", keywords: ["files"] },
    { url: "host://files", title: "Files", category: "Host", keywords: ["open", "save", "folder"] },
    { url: "host://automation", title: "Automation", category: "Host", keywords: ["rules", "scripts"] },
    { url: "host://hardware", title: "Hardware", category: "Host", keywords: ["usb", "controllers", "devices"] },
    { url: "host://models", title: "Models", category: "Host", keywords: ["ollama", "ai"] },
    { url: "host://plugins", title: "Plugins", category: "Host", keywords: ["extensions", "contributors"] },
  ]);
}

function hostDashboardPage(hostManager) {
  const status = hostManager.getOverviewStatus();
  const serviceRows = status.services
    .map(
      (s) => `<div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">${capitalize(s.name)}</span><span class="workshop-home-tile-meta">${s.available ? "Available" : "Not yet available"} \u2014 ${escapeHtml(s.summary ?? "")}</span></div>`
    )
    .join("");

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Workshop Host</h1>
    <p class="workshop-page-subtitle">The Workshop's bridge to your local machine \u2014 currently a lightweight, prepared companion, not yet connected to anything on your actual computer.</p>

    <div class="workshop-home-section">
      <h2>Status</h2>
      <div class="workshop-home-grid">
        <div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">Running</span><span class="workshop-home-tile-meta">${status.running ? "Yes" : "No"}</span></div>
        <div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">Version</span><span class="workshop-home-tile-meta">${escapeHtml(status.version)}</span></div>
        <div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">Available capabilities</span><span class="workshop-home-tile-meta">${status.availableCapabilities.length}</span></div>
        <div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">Future extensions</span><span class="workshop-home-tile-meta">${status.futureExtensions.length}</span></div>
      </div>
    </div>

    <div class="workshop-home-section">
      <h2>Services</h2>
      <div class="workshop-home-grid">${serviceRows}</div>
    </div>

    <div class="workshop-home-section">
      <h2>Pages</h2>
      <div class="workshop-home-grid">
        ${tile("host://applications", "Applications")}
        ${tile("host://projects", "Projects")}
        ${tile("host://documents", "Documents")}
        ${tile("host://downloads", "Downloads")}
        ${tile("host://files", "Files")}
        ${tile("host://models", "Models")}
        ${tile("host://plugins", "Plugins")}
        ${tile("host://automation", "Automation")}
        ${tile("host://hardware", "Hardware")}
      </div>
    </div>
  `;
  return { title: "Workshop Host", html: wrapPage("Workshop Host", html) };
}

/** Every simple, still-unimplemented service page (Files, Automation,
 *  Hardware) shares this one honest shape — a status line, no fabricated
 *  example content pretending to be real. Distinct from
 *  `servicePreviewPage()` below, which *does* show illustrative rows —
 *  see that function's own comment for which services get which
 *  treatment and why. */
function servicePage(title, service) {
  const status = service?.getStatus?.() ?? { available: false, summary: "Not available." };
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>${escapeHtml(title)}</h1>
    <p class="workshop-page-subtitle">${status.available ? "Available" : "Not yet available"}</p>
    <p>${escapeHtml(status.summary)}</p>
    <p><a href="host://services">Back to the Host Dashboard</a></p>
  `;
  return { title, html: wrapPage(title, html) };
}

/** For the four services this phase gave `previewItems()` to
 *  (Applications, Local Projects, Documents, Downloads — see each
 *  service's own comment for the "real data stays empty, illustrative
 *  preview is clearly marked" reconciliation) — every row here carries a
 *  visible "Example" badge and a dashed border
 *  (`.workshop-example-row`/`.workshop-example-badge`, see
 *  `browser-pages.css`), so a person previewing what this page will look
 *  like once it's real never mistakes the preview for a working
 *  feature. `fields` names which of each item's own properties to show
 *  as the row's title/meta, in order. */
function servicePreviewPage(title, service, ...fields) {
  const status = service?.getStatus?.() ?? { available: false, summary: "Not available." };
  const items = service?.previewItems?.() ?? [];
  const rows = items
    .map((item) => {
      const [titleField, ...metaFields] = fields;
      const meta = metaFields.map((f) => item[f]).filter(Boolean).join(" \u00b7 ");
      return `<div class="workshop-home-tile workshop-example-row" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(item[titleField])}<span class="workshop-example-badge">Example</span></span><span class="workshop-home-tile-meta">${escapeHtml(meta)}</span></div>`;
    })
    .join("");

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>${escapeHtml(title)}</h1>
    <p class="workshop-page-subtitle">${status.available ? "Available" : "Not yet available"}</p>
    <p>${escapeHtml(status.summary)}</p>

    <h2>What this will look like</h2>
    <p class="workshop-page-subtitle" style="margin-bottom:12px;">The rows below are illustrative examples, not real data \u2014 there's no local-machine bridge to read from yet. This is what a populated page will look like once there is.</p>
    <div class="workshop-home-grid">${rows || '<p class="workshop-page-empty">No preview items configured.</p>'}</div>

    <p style="margin-top:20px;"><a href="host://services">Back to the Host Dashboard</a></p>
  `;
  return { title, html: wrapPage(title, html) };
}

function modelsPage(modelRegistry) {
  const models = modelRegistry?.all() ?? [];
  const rows = models.length
    ? models
        .map(
          (m) =>
            `<div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(m.name)}</span><span class="workshop-home-tile-meta">${[m.parameterSize, m.quantization].filter(Boolean).map(escapeHtml).join(" \u00b7 ") || "No further details"}</span></div>`
        )
        .join("")
    : `<p class="workshop-page-empty">No models known yet \u2014 connect to Ollama and refresh in AI Mission Control.</p>`;
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Models</h1>
    <p class="workshop-page-subtitle">Live from the same connection AI Mission Control uses \u2014 nothing here is a separate copy.</p>
    <div class="workshop-home-grid">${rows}</div>
    <p><a href="host://services">Back to the Host Dashboard</a></p>
  `;
  return { title: "Models", html: wrapPage("Models", html) };
}

/** "plugin:// pages should naturally integrate into Browser navigation
 *  without requiring hardcoded support." Lists every plugin that's
 *  contributed pages, and — new this phase — which pages each one
 *  declared (`plugin.pages`, see `PluginRegistry.js`'s own comment),
 *  rendered as real, clickable links rather than plain text. */
function pluginsPage(pluginRegistry) {
  const contributors = pluginRegistry?.contributors() ?? [];
  const rows = contributors.length
    ? contributors
        .map(
          (c) => `
            <div class="workshop-home-tile" style="cursor:default">
              <span class="workshop-home-tile-title">${escapeHtml(c.name)}</span>
              <span class="workshop-home-tile-meta">${c.pages.length ? c.pages.map((p) => `<a href="${escapeHtml(p)}">${escapeHtml(p)}</a>`).join(", ") : "No pages declared"}</span>
            </div>
          `
        )
        .join("")
    : `<p class="workshop-page-empty">No plugins have registered any Workshop pages yet.</p>`;
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Plugins</h1>
    <p class="workshop-page-subtitle">A plugin can extend the Browser by registering its own <code>plugin://</code> pages \u2014 see <code>docs/PLUGIN_GUIDE.md</code> and the two working examples below.</p>
    <div class="workshop-home-grid">${rows}</div>
    <p><a href="host://services">Back to the Host Dashboard</a></p>
  `;
  return { title: "Plugins", html: wrapPage("Plugins", html) };
}

function tile(url, title) {
  return `<a class="workshop-home-tile" href="${escapeHtml(url)}"><span class="workshop-home-tile-title">${escapeHtml(title)}</span></a>`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
