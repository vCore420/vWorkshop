import { wrapPage } from "../browser/PageShell.js";

/**
 * HostPages
 * -----------
 * "Every Host feature should eventually be exposed through Workshop
 * pages... the Browser should simply display these pages." Registers
 * `workshop://host` (the Dashboard) and its sibling service pages with
 * `PageRegistry`, the exact same mechanism `WorkshopPages.js` already
 * uses for Home/Docs/Projects/Settings. `BrowserApp.js` needed zero
 * changes to gain these — that's the entire point of the registry
 * existing.
 *
 * Every page here reads live from `HostManager`/`ModelRegistry` at
 * resolve time, never a snapshot frozen at registration — the same
 * "provider is just a function, called fresh on every navigation"
 * property `workshop://projects` already relies on.
 */
export function registerHostPages(pageRegistry, { hostManager, modelRegistry }) {
  pageRegistry.register("host", () => hostDashboardPage(hostManager));
  pageRegistry.register("programs", () => servicePage("Programs", hostManager.services.get("programs")));
  pageRegistry.register("files", () => servicePage("Files", hostManager.services.get("files")));
  pageRegistry.register("automation", () => servicePage("Automation", hostManager.services.get("automation")));
  pageRegistry.register("models", () => modelsPage(modelRegistry));
  pageRegistry.register("plugins", () => pluginsPage(hostManager.pluginRegistry));
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
        ${tile("workshop://programs", "Programs")}
        ${tile("workshop://projects", "Projects")}
        ${tile("workshop://files", "Files")}
        ${tile("workshop://models", "Models")}
        ${tile("workshop://plugins", "Plugins")}
        ${tile("workshop://automation", "Automation")}
      </div>
    </div>
  `;
  return { title: "Workshop Host", html: wrapPage("Workshop Host", html) };
}

/** Every simple, still-unimplemented service page (Programs, Files,
 *  Automation) shares this one honest shape — a status line, no
 *  fabricated example content pretending to be real. */
function servicePage(title, service) {
  const status = service?.getStatus?.() ?? { available: false, summary: "Not available." };
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>${escapeHtml(title)}</h1>
    <p class="workshop-page-subtitle">${status.available ? "Available" : "Not yet available"}</p>
    <p>${escapeHtml(status.summary)}</p>
    <p><a href="workshop://host">Back to the Host Dashboard</a></p>
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
    <p><a href="workshop://host">Back to the Host Dashboard</a></p>
  `;
  return { title: "Models", html: wrapPage("Models", html) };
}

function pluginsPage(pluginRegistry) {
  const contributors = pluginRegistry?.contributors() ?? [];
  const rows = contributors.length
    ? contributors.map((c) => `<div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(c.name)}</span></div>`).join("")
    : `<p class="workshop-page-empty">No plugins have registered any Workshop pages yet.</p>`;
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Plugins</h1>
    <p class="workshop-page-subtitle">A future plugin can extend the Browser by registering its own workshop:// pages here \u2014 see docs/PLUGIN_GUIDE.md.</p>
    <div class="workshop-home-grid">${rows}</div>
    <p><a href="workshop://host">Back to the Host Dashboard</a></p>
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
