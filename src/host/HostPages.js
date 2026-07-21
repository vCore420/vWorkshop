import { wrapPage } from "../browser/PageShell.js";
import { escapeHtml } from "../utils/domSafety.js";
import { formatBytes } from "../utils/formatBytes.js";

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
 *
 * **Version 4, Phase 1**: `host://files` is a real, working file browser
 * and small text editor now, not a status line — see `filesBrowserPage()`
 * below. `host://permissions` gained a Companion pairing section
 * alongside its existing checkboxes — see `permissionsPage()` below. Both
 * needed `hostConnectionManager` itself, not just `hostManager`, so it's
 * threaded through this function's own params now too.
 *
 * **Version 4, Phase v4.0.1b**: `host://applications` moves off its
 * illustrative-only `servicePreviewPage()` treatment onto a real page —
 * see `applicationsPage()` below — the moment `ProgramsService.
 * listPrograms()`/`launchApplication()` became genuinely real. Falls back
 * to the identical illustrative-preview treatment every other
 * still-unimplemented service uses whenever it isn't available yet.
 */
export function registerHostPages(pageRegistry, searchIndex, { hostManager, modelRegistry, hostConnectionManager }) {
  pageRegistry.register("host://services", () => hostDashboardPage(hostManager));
  pageRegistry.register("workshop://host", () => hostDashboardPage(hostManager)); // alias — see this file's own comment

  pageRegistry.register("host://applications", () => applicationsPage(hostManager));
  pageRegistry.register("workshop://programs", () => applicationsPage(hostManager)); // alias

  pageRegistry.register("host://projects", () => hostProjectsPage(hostManager.services.get("projects")));

  pageRegistry.register("host://documents", () => servicePreviewPage("Documents", hostManager.services.get("documents"), "name", "kind", "modified"));
  pageRegistry.register("host://downloads", () => servicePreviewPage("Downloads", hostManager.services.get("downloads"), "name", "kind", "modified"));

  pageRegistry.register("host://files", () => filesBrowserPage(hostManager, hostConnectionManager));
  pageRegistry.register("workshop://files", () => filesBrowserPage(hostManager, hostConnectionManager)); // alias

  pageRegistry.register("host://automation", () => servicePage("Automation", hostManager.services.get("automation")));
  pageRegistry.register("workshop://automation", () => servicePage("Automation", hostManager.services.get("automation"))); // alias

  pageRegistry.register("host://hardware", () => servicePage("Hardware", hostManager.services.get("hardware")));

  pageRegistry.register("host://models", () => modelsPage(modelRegistry));
  pageRegistry.register("workshop://models", () => modelsPage(modelRegistry)); // alias

  pageRegistry.register("host://plugins", () => pluginsPage(hostManager));
  pageRegistry.register("workshop://plugins", () => pluginsPage(hostManager)); // alias

  pageRegistry.register("host://permissions", () => permissionsPage(hostManager.permissions, hostConnectionManager));

  searchIndex.addEntries([
    { url: "host://services", title: "Host Services", category: "Host", keywords: ["dashboard", "status"] },
    { url: "host://applications", title: "Applications", category: "Host", keywords: ["programs", "apps", "launch", "run", "pair"] },
    { url: "host://projects", title: "Local Projects", category: "Host", keywords: ["folders", "editor"] },
    { url: "host://documents", title: "Documents", category: "Host", keywords: ["files", "text"] },
    { url: "host://downloads", title: "Downloads", category: "Host", keywords: ["files"] },
    { url: "host://files", title: "Files", category: "Host", keywords: ["open", "save", "edit", "browse", "folder", "pair"] },
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

/** "The Host should become the Workshop's gateway to the local
 *  filesystem" — Version 4, Phase 1 is what actually builds a door into
 *  the one real capability `FilesService.js` already had (`listFiles()`)
 *  but that, until now, nothing in the Browser ever called: a real
 *  folder browser, and a small text editor for one file at a time.
 *
 *  Deliberately **not** URL-based navigation (`host://files?path=...`) —
 *  `PageRegistry.normalizeUrl()` lowercases an entire URL including its
 *  query string, which would silently corrupt a case-sensitive folder
 *  name on a case-sensitive filesystem. Instead this reuses the exact
 *  `postMessage`-then-reload-in-place idiom `BrowserApp.js` already has
 *  several examples of (permission checkboxes, pin/unpin project, plugin
 *  actions) — `FilesService` holds the current browse position and any
 *  open file as small, transient, non-persisted state (see its own
 *  constructor comment), and every navigate/open/save/close action here
 *  just asks `BrowserApp.js` to update that state and reload this same
 *  URL, which then re-renders from whatever the state now is. */
async function filesBrowserPage(hostManager, hostConnectionManager) {
  const filesService = hostManager.services.get("files");
  const status = filesService?.getStatus?.() ?? { available: false, summary: "Not available." };

  if (!status.available) {
    const html = `
      <span class="workshop-page-badge">Workshop Host</span>
      <h1>Files</h1>
      <p class="workshop-page-subtitle">Not yet available</p>
      <p>${escapeHtml(status.summary)}</p>
      <p><a href="host://permissions">Grant permissions</a> · <a href="host://services">Back to the Host Dashboard</a></p>
    `;
    return { title: "Files", html: wrapPage("Files", html) };
  }

  const openFile = filesService.getOpenFile();

  if (openFile) {
    const lastError = filesService.getLastError();
    const errorBanner = lastError
      ? `<div class="workshop-diagnostics-banner workshop-diagnostics-health-error"><span class="workshop-diagnostics-health-dot"></span><span>${escapeHtml(lastError)}</span></div>`
      : "";
    const readOnly = !status.writeAvailable;
    const html = `
      <span class="workshop-page-badge">Workshop Host</span>
      <h1>Files</h1>
      <p class="workshop-page-subtitle">${escapeHtml(openFile.path)}${readOnly ? " — read-only (grant Filesystem Write at host://permissions to edit)" : ""}</p>
      ${errorBanner}
      <textarea id="workshop-file-editor" class="workshop-files-textarea" spellcheck="false" ${readOnly ? "readonly" : ""}>${escapeHtml(openFile.contents)}</textarea>
      <div class="workshop-page-actions" style="flex-direction:row; gap:8px;">
        ${readOnly ? "" : '<button type="button" class="workshop-favourite-button" id="workshop-file-save">Save</button>'}
        <button type="button" class="workshop-favourite-button" id="workshop-file-close">Close</button>
      </div>
      <p><a href="host://services">Back to the Host Dashboard</a></p>
      <script>
        document.getElementById("workshop-file-close").addEventListener("click", () => {
          window.parent.postMessage({ type: "workshop-browser-files-close" }, "*");
        });
        const saveBtn = document.getElementById("workshop-file-save");
        if (saveBtn) {
          saveBtn.addEventListener("click", () => {
            const contents = document.getElementById("workshop-file-editor").value;
            window.parent.postMessage({ type: "workshop-browser-files-save", path: ${JSON.stringify(openFile.path)}, contents }, "*");
          });
        }
      </script>
    `;
    return { title: "Files", html: wrapPage("Files", html) };
  }

  const currentPath = filesService.getCurrentPath();
  let listing = null;
  try {
    listing = await filesService.listFiles(currentPath);
    // Deliberately *not* clearing `lastError` just because listing this
    // folder succeeded — a pending error usually belongs to the action
    // that led here (a failed open/save), not to the listing itself, and
    // silently erasing it the moment this page next re-renders would mean
    // the error banner below never actually gets a chance to show. Only
    // navigating (`setCurrentPath()`), a *successful* open/save, or
    // closing the open file explicitly clear it — see BrowserApp.js's own
    // message handlers.
  } catch (err) {
    filesService.setLastError(err.message);
  }

  const lastError = filesService.getLastError();
  const errorBanner = lastError
    ? `<div class="workshop-diagnostics-banner workshop-diagnostics-health-error"><span class="workshop-diagnostics-health-dot"></span><span>${escapeHtml(lastError)}</span></div>`
    : "";

  const items = (listing?.items ?? []).slice().sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));
  const rows = items.length
    ? items
        .map((item) => {
          const itemPath = currentPath === "." ? item.name : `${currentPath}/${item.name}`;
          if (item.isDirectory) {
            return `<button type="button" class="workshop-home-tile workshop-files-row" data-files-navigate="${escapeHtml(itemPath)}"><span class="workshop-home-tile-title">📁 ${escapeHtml(item.name)}</span><span class="workshop-home-tile-meta">Folder</span></button>`;
          }
          const meta = [formatBytes(item.size ?? 0), item.modified ? new Date(item.modified).toLocaleString() : null].filter(Boolean).join(" · ");
          return `<button type="button" class="workshop-home-tile workshop-files-row" data-files-open="${escapeHtml(itemPath)}"><span class="workshop-home-tile-title">📄 ${escapeHtml(item.name)}</span><span class="workshop-home-tile-meta">${escapeHtml(meta)}</span></button>`;
        })
        .join("")
    : `<p class="workshop-page-empty">This folder is empty.</p>`;

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Files</h1>
    <p class="workshop-page-subtitle">${escapeHtml(status.summary)}</p>
    ${errorBanner}
    ${breadcrumbHtml(currentPath)}
    <div class="workshop-home-grid">${rows}</div>
    <p style="margin-top:20px;"><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.querySelectorAll("[data-files-navigate]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.parent.postMessage({ type: "workshop-browser-files-navigate", path: btn.dataset.filesNavigate }, "*");
        });
      });
      document.querySelectorAll("[data-files-open]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.parent.postMessage({ type: "workshop-browser-files-open", path: btn.dataset.filesOpen }, "*");
        });
      });
    </script>
  `;
  return { title: "Files", html: wrapPage("Files", html) };
}

/** `currentPath` is always Companion-relative (`"."` for the workspace
 *  root, `"sub/folder"` beneath it) — every segment reconstructs the
 *  prefix path up to itself so clicking it navigates straight there,
 *  the same one-level-at-a-time breadcrumb pattern a real file explorer
 *  uses. */
function breadcrumbHtml(currentPath) {
  const segments = currentPath && currentPath !== "." ? currentPath.split(/[\\/]+/).filter(Boolean) : [];
  const crumbs = [{ label: "Workspace root", path: "." }];
  let acc = "";
  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment;
    crumbs.push({ label: segment, path: acc });
  }
  // Breadcrumb buttons share the same `data-files-navigate` attribute the
  // folder rows above already use, so `filesBrowserPage()`'s own single
  // `[data-files-navigate]` listener wires these up too — no separate
  // script needed here.
  const parts = crumbs.map(
    (crumb, index) => `${index > 0 ? '<span class="workshop-files-breadcrumb-sep">/</span>' : ""}<button type="button" class="workshop-files-breadcrumb-button" data-files-navigate="${escapeHtml(crumb.path)}">${escapeHtml(crumb.label)}</button>`
  );
  return `<div class="workshop-files-breadcrumb">${parts.join("")}</div>`;
}

/** "The Host should become the Workshop's gateway to... launching
 *  applications" — Version 4, Phase v4.0.1b builds a real door into
 *  `ProgramsService.listPrograms()`/`launchApplication()`, the same
 *  "status-gated, real page once available, illustrative preview
 *  otherwise" shape `filesBrowserPage()` established for Files. Every
 *  configured program the Companion's own operator approved gets a row
 *  with a Launch button — and, for any declared `acceptsArgs` slot, a
 *  small input the Companion itself validates before spawning anything
 *  (see `workshop-host-companion.js`'s own `buildArgv()`). Same
 *  `postMessage`-then-reload-in-place idiom as everywhere else in this
 *  file — no new navigation mechanism, and (unlike Files) there's no
 *  in-page "open" state to manage, so a single reload after Launch is
 *  enough to reflect both the fresh error banner (on failure) and the
 *  "Recently launched" section (on success). */
async function applicationsPage(hostManager) {
  const programsService = hostManager.services.get("applications");
  const status = programsService?.getStatus?.() ?? { available: false, summary: "Not available." };

  if (!status.available) {
    const lastError = programsService?.getLastError?.();
    const errorBanner = lastError
      ? `<div class="workshop-diagnostics-banner workshop-diagnostics-health-error"><span class="workshop-diagnostics-health-dot"></span><span>${escapeHtml(lastError)}</span></div>`
      : "";
    const preview = programsService?.previewItems?.() ?? [];
    const previewRows = preview
      .map(
        (item) =>
          `<div class="workshop-home-tile workshop-example-row" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(item.name)}<span class="workshop-example-badge">Example</span></span><span class="workshop-home-tile-meta">${escapeHtml(item.kind ?? "")}</span></div>`
      )
      .join("");
    const html = `
      <span class="workshop-page-badge">Workshop Host</span>
      <h1>Applications</h1>
      <p class="workshop-page-subtitle">Not yet available</p>
      <p>${escapeHtml(status.summary)}</p>
      ${errorBanner}
      <h2>What this will look like</h2>
      <p class="workshop-page-subtitle" style="margin-bottom:12px;">The rows below are illustrative examples, not real data — launching one of the Companion operator's own configured programs will look like this once it's available.</p>
      <div class="workshop-home-grid">${previewRows}</div>
      <p style="margin-top:20px;"><a href="host://permissions">Grant permissions</a> · <a href="host://services">Back to the Host Dashboard</a></p>
    `;
    return { title: "Applications", html: wrapPage("Applications", html) };
  }

  let programs = [];
  try {
    programs = await programsService.listPrograms();
    // Deliberately not clearing lastError just because listing succeeded
    // — same reasoning as filesBrowserPage()'s own listing branch: a
    // pending error usually belongs to the launch attempt that led here,
    // not to this listing itself.
  } catch (err) {
    programsService.setLastError(err.message);
  }

  const lastError = programsService.getLastError();
  const errorBanner = lastError
    ? `<div class="workshop-diagnostics-banner workshop-diagnostics-health-error"><span class="workshop-diagnostics-health-dot"></span><span>${escapeHtml(lastError)}</span></div>`
    : "";

  const rows = programs.length
    ? programs.map((p) => programRow(p)).join("")
    : `<p class="workshop-page-empty">No programs are currently configured — see host-companion/README.md's own "Launching a configured program" section.</p>`;

  const running = programsService.runningApplications();
  const runningRows = running.length
    ? running
        .slice()
        .reverse()
        .map(
          (r) =>
            `<div class="workshop-home-tile" style="cursor:default"><span class="workshop-home-tile-title">${escapeHtml(r.name)}</span><span class="workshop-home-tile-meta">pid ${r.pid} · ${escapeHtml(new Date(r.startedAt).toLocaleString())}</span></div>`
        )
        .join("")
    : `<p class="workshop-page-empty">Nothing launched yet this session.</p>`;

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Applications</h1>
    <p class="workshop-page-subtitle">${escapeHtml(status.summary)}</p>
    ${errorBanner}
    <div class="workshop-home-grid">${rows}</div>

    <h2>Recently launched</h2>
    <div class="workshop-home-grid">${runningRows}</div>

    <p style="margin-top:20px;"><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.querySelectorAll("[data-launch-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.launchId;
          const args = {};
          // Filtering by dataset comparison rather than building
          // '[data-arg-for="' + id + '"]' as a selector string — a
          // program id containing a literal quote character would
          // otherwise produce an invalid (or misleading) selector.
          // Program ids come from the Companion operator's own trusted
          // config, not browser input, but there's no reason to depend
          // on that here when the safe form costs nothing extra.
          document.querySelectorAll("[data-arg-for]").forEach((input) => {
            if (input.dataset.argFor === id && input.value) args[input.dataset.argName] = input.value;
          });
          window.parent.postMessage({ type: "workshop-browser-launch-application", id, args }, "*");
        });
      });
    </script>
  `;
  return { title: "Applications", html: wrapPage("Applications", html) };
}

/** One configured program's own row — a Launch button plus, for each
 *  declared `acceptsArgs` slot, a matching input (`<select>` for `enum`,
 *  a text field for `workspacePath`) tagged `data-arg-for`/`data-arg-name`
 *  so `applicationsPage()`'s own single click handler can collect every
 *  filled-in value by name without a per-program script. The Companion
 *  itself re-validates every value before spawning anything — this is
 *  just building a usable form around slots it already declared, not a
 *  second copy of that validation. */
function programRow(program) {
  const argFields = (program.acceptsArgs ?? [])
    .map((slot) => {
      if (slot.type === "enum") {
        const options = (slot.values ?? []).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
        return `
          <label class="workshop-page-subtitle" style="display:block; margin:6px 0 2px;">
            ${escapeHtml(slot.name)}${slot.required ? " (required)" : ""}
            <select data-arg-for="${escapeHtml(program.id)}" data-arg-name="${escapeHtml(slot.name)}" style="display:block; width:100%; margin-top:2px;">
              <option value="">—</option>
              ${options}
            </select>
          </label>
        `;
      }
      // "workspacePath" is the only other declared type — a path
      // relative to the Companion's own workspace root, the same one
      // Files browses; the Companion resolves and validates it exactly
      // the way GET /file already does.
      return `
        <label class="workshop-page-subtitle" style="display:block; margin:6px 0 2px;">
          ${escapeHtml(slot.name)}${slot.required ? " (required)" : ""} — a path relative to the workspace root
          <input type="text" data-arg-for="${escapeHtml(program.id)}" data-arg-name="${escapeHtml(slot.name)}" placeholder="e.g. notes/todo.txt" style="display:block; width:100%; margin-top:2px;">
        </label>
      `;
    })
    .join("");
  return `
    <div class="workshop-home-tile" style="cursor:default; margin-bottom:14px;">
      <span class="workshop-home-tile-title">${escapeHtml(program.name)}</span>
      ${argFields}
      <div class="workshop-page-actions" style="flex-direction:row; margin:10px 0 0;">
        <button type="button" class="workshop-favourite-button" data-launch-id="${escapeHtml(program.id)}">Launch</button>
      </div>
    </div>
  `;
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
 *  happened rather than what the click merely asked for.
 *
 *  **Version 4, Phase 1**: a "Companion Pairing" section, shown only once
 *  the Companion is actually reachable — pairing a Companion that isn't
 *  even running yet has nothing to explain itself against. The token
 *  input posts `workshop-browser-set-companion-token`, the same
 *  message-then-reload shape as everything else on this page; see
 *  `HostConnectionManager.js`'s own comment for why the token itself is
 *  never persisted. */
function permissionsPage(permissionsService, hostConnectionManager) {
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

  const connected = hostConnectionManager?.status === "connected";
  const paired = !!hostConnectionManager?.hasToken?.();
  const pairingSection = connected
    ? `
      <h2>Companion Pairing</h2>
      <p class="workshop-page-subtitle" style="margin-bottom:12px;">
        ${paired
          ? "A pairing token has been entered — reading and editing files at <a href=\"host://files\">Files</a> will use it. If it turns out to be wrong (the Companion prints a fresh one every time it restarts), just enter the current one below to replace it."
          : "The Companion is running, but reading or editing a file's actual contents needs one more step: enter the pairing token printed in the Companion's own terminal window when it started."}
      </p>
      <div class="resident-conversation-input-row" style="margin:0 0 24px;">
        <input type="text" id="companion-token-input" placeholder="Pairing token from the Companion's terminal" autocomplete="off" spellcheck="false">
        <button type="button" id="companion-token-button">${paired ? "Replace" : "Pair"}</button>
      </div>
    `
    : "";

  const html = `
    <span class="workshop-page-badge">Workshop Host</span>
    <h1>Permissions</h1>
    <p class="workshop-page-subtitle">What the Workshop Host is allowed to do on your own computer, all off by default. Granting Filesystem Read here is what lets <a href="host://files">Files</a> genuinely browse a folder once the Workshop Host Companion is running (see <code>host-companion/README.md</code>); Filesystem Write additionally needs the Companion paired below.</p>
    ${rows.join("")}
    ${pairingSection}
    <p><a href="host://services">Back to the Host Dashboard</a></p>
    <script>
      document.querySelectorAll("input[data-permission]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          window.parent.postMessage({ type: "workshop-browser-set-permission", id: checkbox.dataset.permission, granted: checkbox.checked }, "*");
        });
      });
      const tokenButton = document.getElementById("companion-token-button");
      if (tokenButton) {
        tokenButton.addEventListener("click", () => {
          const input = document.getElementById("companion-token-input");
          if (!input.value.trim()) return;
          window.parent.postMessage({ type: "workshop-browser-set-companion-token", token: input.value.trim() }, "*");
        });
      }
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

