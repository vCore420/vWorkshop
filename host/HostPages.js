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

  pageRegistry.register("host://applications", () => servicePreviewPage("Applications", hostManager.services.get("applications"), "name", "kind"));
  pageRegistry.register("workshop://programs", () => servicePreviewPage("Applications", hostManager.services.get("applications"), "name", "kind")); // alias

  pageRegistry.register("host://projects", () => hostProjectsPage(hostManager.services.get("projects")));

  pageRegistry.register("host://documents", () => servicePreviewPage("Documents", hostManager.services.get("documents"), "name", "kind", "modified"));
  pageRegistry.register("host://downloads", () => servicePreviewPage("Downloads", hostManager.services.get("downloads"), "name", "kind", "modified"));

  pageRegistry.register("host://files", () => servicePage("Files", hostManager.services.get("files")));
  pageRegistry.register("workshop://files", () => servicePage("Files", hostManager.services.get("files"))); // alias

  pageRegistry.register("host://automation", () => servicePage("Automation", hostManager.services.get("automation")));
  pageRegistry.register("workshop://automation", () => servicePage("Automation", hostManager.services.get("automation"))); // alias

  pageRegistry.register("host://hardware", () => servicePage("Hardware", hostManager.services.get("hardware")));

  pageRegistry.register("host://models", () => modelsPage(modelRegistry));
  pageRegistry.register("workshop://models", () => modelsPage(modelRegistry)); // alias

  pageRegistry.register("host://plugins", () => pluginsPage(hostManager));
  pageRegistry.register("workshop://plugins", () => pluginsPage(hostManager)); // alias

  pageRegistry.register("host://permissions", () => permissionsPage(hostManager.permissions));

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
    { url: "host://permissions", title: "Permissions", category: "Host", keywords: ["filesystem", "hardware", "network", "grant", "companion"] },
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
    <p class="workshop-page-subtitle">The Workshop's bridge to your local machine \u2014 most of it still a lightweight, prepared companion, but genuinely real wherever the <a href="host://files">Workshop Host Companion</a> is running and connected (see <code>host-companion/README.md</code>).</p>

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
        ${tile("host://permissions", "Permissions")}
        ${tile("asset://", "Assets")}
        ${tile("resident://", "Residents")}
        ${tile("project://", "Workshop Projects")}
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

/** "Pinned projects" — genuinely real (see `ProjectsService.js`'s own
 *  comment), shown above the illustrative preview rows and clearly
 *  visually distinct from them (no "Example" badge, a real remove
 *  button) since pinning itself needs no local-machine bridge at all.
 *  Adding a path posts `workshop-browser-pin-project`, the same
 *  `postMessage` shape every other interactive Workshop page already
 *  uses. */
function hostProjectsPage(projectsService) {
  const status = projectsService?.getStatus?.() ?? { available: false, summary: "Not available." };
  const pinned = projectsService?.pinnedProjects() ?? [];
  const pinnedRows = pinned.length
    ? pinned
        .map(
          (path) => `
            <div class="workshop-home-tile" style="cursor:default">
              <span class="workshop-home-tile-title">${escapeHtml(path)}</span>
              <button type="button" class="builder-icon-button" data-unpin="${escapeHtml(path)}">\u2715</button>
            </div>
          `
        )
        .join("")
    : `<p class="workshop-page-empty">No pinned projects yet \u2014 add a path below.</p>`;

  const preview = projectsService?.previewItems?.() ?? [];
  const previewRows = preview
    .map(
      (item) =>
        `<div class="workshop-home-tile workshop-example-row" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(item.name)}<span class="workshop-example-badge">Example</span></span><span class="workshop-home-tile-meta">${escapeHtml([item.kind, item.modified].filter(Boolean).join(" \u00b7 "))}</span></div>`
    )
    .join("");

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Local Projects</h1>
    <p class="workshop-page-subtitle">${status.available ? "Available" : "Not yet available"}</p>
    <p>${escapeHtml(status.summary)}</p>

    <h2>Pinned</h2>
    <p class="workshop-page-subtitle" style="margin-bottom:12px;">A real, saved list of paths you care about \u2014 works today, independent of everything else on this page.</p>
    <div class="workshop-home-grid">${pinnedRows}</div>
    <div class="resident-conversation-input-row" style="margin:10px 0 24px;">
      <input type="text" id="pin-path-input" placeholder="A project path or name to remember">
      <button type="button" id="pin-path-button">Pin</button>
    </div>

    <h2>What browsing real local projects will look like</h2>
    <p class="workshop-page-subtitle" style="margin-bottom:12px;">The rows below are illustrative examples, not real data \u2014 there's no local-machine bridge to read from yet.</p>
    <div class="workshop-home-grid">${previewRows}</div>

    <p style="margin-top:20px;"><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.getElementById("pin-path-button").addEventListener("click", () => {
        const input = document.getElementById("pin-path-input");
        if (!input.value.trim()) return;
        window.parent.postMessage({ type: "workshop-browser-pin-project", path: input.value.trim() }, "*");
      });
      document.querySelectorAll("[data-unpin]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.parent.postMessage({ type: "workshop-browser-unpin-project", path: btn.dataset.unpin }, "*");
        });
      });
    </script>
  `;
  return { title: "Local Projects", html: wrapPage("Local Projects", html) };
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

/** "The Plugin Manager should become the central place for managing
 *  Workshop extensions." Reads the same enriched `PluginService
 *  .listAll()` `host://plugins` always has, now carrying real status
 *  (`active`/`disabled`/`error`), manifest metadata, and per-plugin
 *  permissions for anything loaded through `PluginLoader.js`. Enable/
 *  Disable/Reload and the permission checkboxes are genuinely
 *  interactive, the identical `postMessage` shape `host://permissions`'
 *  own checkboxes already established — see that function's own
 *  comment for why the real call always happens in `BrowserApp.js`,
 *  never inside this page's own `srcdoc`. A plugin registered the
 *  older, direct way (no manifest) still shows up, honestly labelled —
 *  see `stateLabel()`. */
function pluginsPage(hostManager) {
  const pluginService = hostManager.services.get("plugins");
  const plugins = pluginService?.listAll() ?? [];
  const rows = plugins.length
    ? plugins.map((p) => pluginCard(p)).join("")
    : `<p class="workshop-page-empty">No plugins are currently loaded.</p>`;
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Plugins</h1>
    <p class="workshop-page-subtitle">Every plugin currently loaded — the new Plugin SDK (<code>manifest</code> + <code>setup(Workshop)</code>, see <code>docs/PLUGIN_SDK.md</code>) alongside the two original contracts it was built on top of (<code>engine.plugins</code>, and Browser pages/Workshop Assets via <code>hostManager.pluginRegistry</code> — see <code>docs/PLUGIN_GUIDE.md</code>). <a href="plugin://workshop-toolkit">plugin://workshop-toolkit</a> is the current reference example.</p>
    ${rows}
    <p><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.querySelectorAll("[data-plugin-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.parent.postMessage({ type: "workshop-browser-plugin-action", action: btn.dataset.pluginAction, id: btn.dataset.pluginId }, "*");
        });
      });
      document.querySelectorAll("input[data-plugin-permission]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          window.parent.postMessage({ type: "workshop-browser-set-plugin-permission", pluginId: checkbox.dataset.pluginId, capabilityId: checkbox.dataset.pluginPermission, granted: checkbox.checked }, "*");
        });
      });
    </script>
  `;
  return { title: "Plugins", html: wrapPage("Plugins", html) };
}

function pluginCard(p) {
  const isSdkPlugin = !!p.manifest; // only a real PluginLoader.js entry has enable/disable/reload and permissions worth showing
  const permissionRows = (p.permissions ?? [])
    .map(
      (perm) => `
        <div class="workshop-permission-row">
          <label class="workshop-permission-label">
            <input type="checkbox" data-plugin-id="${escapeHtml(p.id)}" data-plugin-permission="${escapeHtml(perm.id)}" ${perm.granted ? "checked" : ""}>
            <span>
              <strong>${escapeHtml(perm.label)}</strong>
              <span class="workshop-page-subtitle" style="margin:2px 0 0;">${escapeHtml(perm.description)}</span>
            </span>
          </label>
        </div>
      `
    )
    .join("");
  const pageLinks = p.pages.length ? p.pages.map((page) => `<a href="${escapeHtml(page)}">${escapeHtml(page)}</a>`).join(", ") : "No pages registered";
  const assetLine = p.assetKinds.length ? `<span class="workshop-home-tile-meta">Asset kinds: ${p.assetKinds.map(escapeHtml).join(", ")}</span>` : "";
  const actions = isSdkPlugin
    ? `
      <div class="workshop-page-actions" style="flex-direction:row; gap:8px; margin:8px 0;">
        ${p.state === "disabled"
          ? `<button class="workshop-favourite-button" data-plugin-action="enable" data-plugin-id="${escapeHtml(p.id)}">Enable</button>`
          : `<button class="workshop-favourite-button" data-plugin-action="disable" data-plugin-id="${escapeHtml(p.id)}">Disable</button>`}
        <button class="workshop-favourite-button" data-plugin-action="reload" data-plugin-id="${escapeHtml(p.id)}">Reload</button>
      </div>
    `
    : "";
  return `
    <div class="workshop-home-tile" style="cursor:default; margin-bottom:14px;">
      <span class="workshop-home-tile-title">${escapeHtml(p.name)} ${manifestVersionBadge(p.manifest)}</span>
      <span class="workshop-home-tile-meta">${stateLabel(p)} \u00b7 ${p.contracts.map(contractLabel).join(" \u00b7 ")}</span>
      ${p.manifest?.description ? `<span class="workshop-home-tile-meta">${escapeHtml(p.manifest.description)}</span>` : ""}
      ${p.manifest?.author ? `<span class="workshop-home-tile-meta">by ${escapeHtml(p.manifest.author)}</span>` : ""}
      <span class="workshop-home-tile-meta">${pageLinks}</span>
      ${assetLine}
      ${actions}
      ${permissionRows}
    </div>
  `;
}

function manifestVersionBadge(manifest) {
  return manifest?.version ? `<span class="workshop-page-subtitle" style="display:inline;">v${escapeHtml(manifest.version)}</span>` : "";
}

function stateLabel(p) {
  if (!p.manifest) return "engine.plugins / pluginRegistry contract (no manifest)";
  if (p.state === "error") return `\u26a0 Error: ${escapeHtml(p.error ?? "unknown error")}`;
  if (p.state === "disabled") return "Disabled";
  return "Active";
}

function contractLabel(contract) {
  if (contract === "sdk") return "Plugin SDK";
  if (contract === "pages") return "registers pages";
  if (contract === "assets") return "registers assets";
  return "engine lifecycle";
}

/** "Please begin introducing a permissions architecture." Genuinely
 *  interactive — each category's own checkbox posts a
 *  `workshop-browser-set-permission` message the same way
 *  `workshop://bookmarks`' own "Remove" button already posts
 *  `workshop-browser-navigate`; `BrowserApp.js` is the one place that
 *  actually calls `grant()`/`revoke()` on the real `PermissionsService`,
 *  then reloads this page so the checkbox state reflects what actually
 *  happened rather than what the click merely asked for. */
function permissionsPage(permissionsService) {
  const rows = permissionsService.categories().map((category) => {
    const granted = permissionsService.isGranted(category.id);
    return `
      <div class="workshop-permission-row">
        <label class="workshop-permission-label">
          <input type="checkbox" data-permission="${escapeHtml(category.id)}" ${granted ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(category.label)}</strong>
            <span class="workshop-page-subtitle" style="margin:2px 0 0;">${escapeHtml(category.description)}</span>
          </span>
        </label>
      </div>
    `;
  });
  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Permissions</h1>
    <p class="workshop-page-subtitle">What the Workshop Host is allowed to do on your own computer, all off by default. Granting Filesystem here is what lets <a href="host://files">Files</a> genuinely browse a folder once the Workshop Host Companion is running (see <code>host-companion/README.md</code>).</p>
    ${rows.join("")}
    <p><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.querySelectorAll("input[data-permission]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          window.parent.postMessage({ type: "workshop-browser-set-permission", id: checkbox.dataset.permission, granted: checkbox.checked }, "*");
        });
      });
    </script>
  `;
  return { title: "Permissions", html: wrapPage("Permissions", html) };
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
