import { wrapPage } from "../../browser/PageShell.js";
import { isInternalUrl, INTERNAL_SCHEMES } from "../../browser/PageRegistry.js";
import { StorageUtils } from "../../utils/StorageUtils.js";

/**
 * createBrowserApp
 * -------------------
 * "The Workshop computer should now become the player's primary gateway
 * between the Workshop and the wider digital world... it should feel
 * like a genuine desktop application that happens to exist inside the
 * Workshop." One persistent `<iframe>` per tab (kept alive in the DOM,
 * hidden via CSS rather than destroyed, so switching tabs never loses a
 * page's live state or scroll position), reconciled against
 * `BrowserStore`'s own tab list on every change — the same
 * "re-render from the store, don't hand-maintain parallel state" pattern
 * every other Workshop app already follows, just applied carefully
 * enough not to reload an iframe that hasn't actually navigated anywhere.
 *
 * **Two kinds of page, one display mechanism.** An ordinary `http(s)://`
 * URL becomes `iframe.src`; an internal-scheme URL (`workshop://`,
 * `host://`, `plugin://` — see `PageRegistry.isInternalUrl()`) resolves
 * through `PageRegistry` (see that file's own comment) and becomes
 * `iframe.srcdoc`. `BrowserApp` itself has no idea what `workshop://docs`
 * or `host://services` actually contain — it only ever asks the registry
 * "what's the page for this URL" and renders whatever comes back, exactly
 * as "the Browser should not contain hardcoded knowledge about Workshop
 * systems" asks for. The Browser Ecosystem phase is what generalised this
 * from a single hardcoded `workshop://` check into the scheme-agnostic
 * `isInternalUrl()` — the Browser now treats `host://` and `plugin://`
 * exactly the same way it always treated `workshop://`, with no special
 * cases per scheme anywhere in this file.
 *
 * **A real, honest limitation, not hidden:** most modern sites (GitHub
 * included) send `X-Frame-Options`/CSP headers that block being embedded
 * in anyone else's page, by design, for their own users' security — no
 * amount of clever code here changes that, since it's enforced by the
 * browser itself based on headers the remote server sends, entirely
 * outside this file's control. There's also no reliable, cross-origin
 * way to even *detect* that this happened (a blocked frame just silently
 * shows nothing, and `iframe.onload` still fires either way). Rather
 * than pretend this doesn't happen, every tab always has a small,
 * persistent "Open in a new browser tab ↗" affordance — a real escape
 * hatch for exactly this case, not an error message that only appears
 * some of the time.
 */
export function createBrowserApp({ browserStore, pageRegistry, hostManager }) {
  return {
    id: "browser",
    label: "Browser",
    glyph: "browser",
    mount(container) {
      const root = document.createElement("div");
      root.className = "browser-app";
      container.appendChild(root);

      const tabBar = document.createElement("div");
      tabBar.className = "browser-tab-bar";
      root.appendChild(tabBar);

      const toolbar = document.createElement("div");
      toolbar.className = "browser-toolbar";
      root.appendChild(toolbar);

      const backBtn = toolbarButton("\u2190", "Back");
      const forwardBtn = toolbarButton("\u2192", "Forward");
      const refreshBtn = toolbarButton("\u21BB", "Refresh");
      const homeBtn = toolbarButton("\u2302", "Home");
      toolbar.append(backBtn, forwardBtn, refreshBtn, homeBtn);

      const addressBar = document.createElement("input");
      addressBar.type = "text";
      addressBar.className = "browser-address-input";
      addressBar.spellcheck = false;
      addressBar.placeholder = "Search or enter a workshop://, host://, or web address";
      toolbar.appendChild(addressBar);

      // "Bookmarks... continue improving the browsing experience" — a
      // one-click star for whatever's currently showing, sharing the
      // exact same `BrowserStore.bookmarks` list the Phone's own Browser
      // app already reads and writes, so a bookmark added from either
      // place shows up in both.
      const bookmarkBtn = toolbarButton("\u2606", "Bookmark this page");
      toolbar.appendChild(bookmarkBtn);

      const openExternalBtn = toolbarButton("\u2197", "Open in a new browser tab");
      toolbar.appendChild(openExternalBtn);

      const newTabBtn = document.createElement("button");
      newTabBtn.type = "button";
      newTabBtn.className = "browser-new-tab-btn";
      newTabBtn.textContent = "+";
      newTabBtn.title = "New tab";

      const content = document.createElement("div");
      content.className = "browser-content";
      root.appendChild(content);

      /** @type {Map<string, HTMLIFrameElement>} */
      const frames = new Map();
      let disposed = false;

      function activeTabId() {
        return browserStore.getActiveTab().id;
      }

      /** Creates and installs a brand new iframe for `tabId`, showing
       *  `url`, replacing whatever was there before — deliberately never
       *  reusing an existing element and mutating its own `src`/`srcdoc`.
       *  That reuse was the actual root cause of "the Browser often does
       *  not visually update until the player switches to another tab and
       *  back": an iframe's own rendered layer isn't always reliably
       *  invalidated by the browser when its content changes while the
       *  element itself never moves, resizes, or toggles visibility —
       *  exactly what happens navigating within an already-active tab.
       *  Switching tabs "fixed" it purely as a side effect, by forcing a
       *  display:none/block toggle, which happens to force a real
       *  relayout — not a coincidence, the actual mechanism. A fresh
       *  element is guaranteed a fresh compositing layer from the
       *  browser's own perspective, closing the gap architecturally
       *  rather than papering over it with an explicit forced reflow.
       *
       *  There's no state worth preserving across this replacement
       *  either: navigating to a new URL already resets scroll position
       *  (`BrowserStore.navigate()`'s own behaviour, since a fresh page
       *  starts at the top regardless), so nothing about keeping tabs'
       *  own frames alive *between* navigations (still true — see
       *  `reconcileFrames()`) is lost by replacing the element *within*
       *  one. */
      function loadIntoFrame(tabId, url) {
        const oldFrame = frames.get(tabId);
        const newFrame = document.createElement("iframe");
        newFrame.className = "browser-frame";
        if (oldFrame?.classList.contains("active")) newFrame.classList.add("active");
        newFrame.dataset.tabId = tabId;
        newFrame.dataset.currentUrl = url;
        // Deliberately not sandboxed — a sandboxed srcdoc frame loses
        // same-origin access to its own contentWindow, which is exactly
        // what scroll-position tracking for workshop:// pages needs (see
        // BrowserStore.js's own note on why that's only ever practical
        // for same-origin content in the first place).
        newFrame.addEventListener("load", () => onFrameLoad(tabId, newFrame));

        if (isInternalUrl(url)) {
          pageRegistry
            .resolve(url)
            .then((page) => {
              if (disposed || frames.get(tabId) !== newFrame) return; // superseded by a newer navigation before this resolved
              if (page) {
                newFrame.srcdoc = page.html;
                browserStore.setTitle(tabId, page.title);
              } else {
                newFrame.srcdoc = wrapPage("Not found", notFoundHtml(url));
                browserStore.setTitle(tabId, "Not found");
              }
              if (tabId === activeTabId()) renderChrome();
            })
            .catch(() => {
              if (disposed || frames.get(tabId) !== newFrame) return;
              newFrame.srcdoc = wrapPage("Couldn't load", notFoundHtml(url));
            });
        } else {
          newFrame.src = url;
        }

        if (oldFrame) oldFrame.remove();
        content.appendChild(newFrame);
        frames.set(tabId, newFrame);
      }

      function onFrameLoad(tabId, frame) {
        if (disposed || frames.get(tabId) !== frame) return; // a stale frame's own late load event, already replaced
        const url = frame.dataset.currentUrl ?? "";
        if (isInternalUrl(url)) {
          try {
            const tab = browserStore.getTab(tabId);
            frame.contentWindow?.scrollTo(0, tab?.scrollY ?? 0);
            frame.contentWindow?.addEventListener("scroll", () => {
              browserStore.setScrollY(tabId, frame.contentWindow.scrollY);
            });
            const titleFromDoc = frame.contentDocument?.title;
            if (titleFromDoc) browserStore.setTitle(tabId, titleFromDoc);
          } catch {
            // Same-origin access unexpectedly failing is harmless here —
            // the page still displays fine, it just won't get scroll
            // tracking or an auto-detected title this time.
          }
        } else {
          // Cross-origin http(s) content — reading anything about it
          // (title, scroll) is blocked by the browser's own same-origin
          // policy, not something to work around. The address/title
          // falls back to the URL itself; see renderTabBar().
          browserStore.setTitle(tabId, hostnameOf(url) ?? url);
        }
        if (tabId === activeTabId()) renderChrome();
      }

      /** Reconciles the live `frames` map against BrowserStore's own tab
       *  list: new tabs get a frame created and loaded, existing tabs only
       *  get a *replacement* frame if their current URL actually changed
       *  (comparing against the existing frame's own last-loaded url,
       *  tracked in `dataset.currentUrl`) — switching to a tab that's
       *  already showing the right thing must never reload it, or every
       *  bit of the point of keeping frames alive between navigations is
       *  lost. Closed tabs get their frame removed and disposed. */
      function reconcileFrames() {
        const liveIds = new Set(browserStore.all().map((t) => t.id));
        for (const [tabId, frame] of frames) {
          if (!liveIds.has(tabId)) {
            frame.remove();
            frames.delete(tabId);
          }
        }
        for (const tab of browserStore.all()) {
          const url = browserStore.getCurrentUrl(tab.id);
          const existing = frames.get(tab.id);
          if (!existing || existing.dataset.currentUrl !== url) loadIntoFrame(tab.id, url);
        }
        const activeId = activeTabId();
        for (const [tabId, frame] of frames) {
          frame.classList.toggle("active", tabId === activeId);
        }
      }

      function renderTabBar() {
        tabBar.innerHTML = "";
        const activeId = activeTabId();
        for (const tab of browserStore.all()) {
          const tabEl = document.createElement("button");
          tabEl.type = "button";
          tabEl.className = tab.id === activeId ? "browser-tab active" : "browser-tab";
          tabEl.addEventListener("click", () => {
            browserStore.setActiveTab(tab.id);
          });

          const titleEl = document.createElement("span");
          titleEl.className = "browser-tab-title";
          titleEl.textContent = tab.title || "New Tab";
          tabEl.appendChild(titleEl);

          const closeEl = document.createElement("span");
          closeEl.className = "browser-tab-close";
          closeEl.textContent = "\u00d7";
          closeEl.title = "Close tab";
          closeEl.addEventListener("click", (event) => {
            event.stopPropagation();
            browserStore.closeTab(tab.id);
          });
          tabEl.appendChild(closeEl);

          tabBar.appendChild(tabEl);
        }
        tabBar.appendChild(newTabBtn);
      }

      function renderToolbar() {
        const tabId = activeTabId();
        backBtn.disabled = !browserStore.canGoBack(tabId);
        forwardBtn.disabled = !browserStore.canGoForward(tabId);
        const url = browserStore.getCurrentUrl(tabId);
        if (document.activeElement !== addressBar) addressBar.value = url;
        openExternalBtn.style.visibility = isInternalUrl(url) ? "hidden" : "visible";
        const isBookmarked = browserStore.bookmarks.some((b) => b.url === url);
        bookmarkBtn.textContent = isBookmarked ? "\u2605" : "\u2606";
        bookmarkBtn.title = isBookmarked ? "Remove bookmark" : "Bookmark this page";
        bookmarkBtn.classList.toggle("browser-toolbar-button-active", isBookmarked);
      }

      function renderChrome() {
        renderTabBar();
        renderToolbar();
      }

      function render() {
        renderChrome();
        reconcileFrames();
      }

      // ---- toolbar actions ----
      backBtn.addEventListener("click", () => browserStore.goBack(activeTabId()));
      forwardBtn.addEventListener("click", () => browserStore.goForward(activeTabId()));
      homeBtn.addEventListener("click", () => browserStore.navigate(activeTabId(), "workshop://"));
      refreshBtn.addEventListener("click", () => {
        const tabId = activeTabId();
        if (!frames.has(tabId)) return;
        loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
      });
      openExternalBtn.addEventListener("click", () => {
        const url = browserStore.getCurrentUrl(activeTabId());
        if (!isInternalUrl(url)) window.open(url, "_blank", "noopener");
      });
      bookmarkBtn.addEventListener("click", () => {
        const tabId = activeTabId();
        const url = browserStore.getCurrentUrl(tabId);
        const isBookmarked = browserStore.bookmarks.some((b) => b.url === url);
        if (isBookmarked) browserStore.removeBookmark(url);
        else browserStore.addBookmark(url, browserStore.getTab(tabId)?.title || url);
      });
      newTabBtn.addEventListener("click", () => browserStore.newTab());
      addressBar.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const url = normalizeUrl(addressBar.value);
        if (url) browserStore.navigate(activeTabId(), url);
        addressBar.blur();
      });

      // ---- workshop:// page interactivity (link clicks, Settings' "clear data", Bookmarks' "remove", Permissions' checkboxes) ----
      const onMessage = async (event) => {
        if (event.data?.type === "workshop-browser-navigate" && event.data.url) {
          browserStore.navigate(activeTabId(), event.data.url);
        } else if (event.data?.type === "workshop-browser-clear-data") {
          for (const tab of browserStore.all().slice()) browserStore.closeTab(tab.id);
          browserStore.navigate(activeTabId(), "workshop://");
        } else if (event.data?.type === "workshop-browser-remove-bookmark" && typeof event.data.index === "number") {
          const bookmark = browserStore.bookmarks[event.data.index];
          if (bookmark) browserStore.removeBookmark(bookmark.url);
          // The bookmarks list is baked into the page's own srcdoc at
          // render time, not re-fetched live — reloading the same URL is
          // what actually reflects the removal, the same mechanism the
          // toolbar's own Refresh button already uses.
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-set-permission" && event.data.id) {
          // host://permissions' own checkboxes — see HostPages.js's own
          // permissionsPage() comment. The real grant/revoke call always
          // happens here, in the one place with an actual reference to
          // PermissionsService, never inside the page itself.
          if (event.data.granted) hostManager?.permissions.grant(event.data.id);
          else hostManager?.permissions.revoke(event.data.id);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-pin-project" && event.data.path) {
          hostManager?.services.get("projects")?.pin(event.data.path);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-unpin-project" && event.data.path) {
          hostManager?.services.get("projects")?.unpin(event.data.path);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-toggle-favourite" && event.data.assetId) {
          // Every asset detail page's own star button — see
          // AssetPages.js's own favouriteButton(). The real toggle always
          // happens here, never inside the srcdoc page itself.
          hostManager?.services.get("assets")?.toggleFavourite(event.data.assetId);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-export-asset" && event.data.assetId) {
          // Version 3, Phase 7 ("Sharing the Workshop") — every asset
          // detail page's own Export button, see AssetPages.js's own
          // exportButton(). AssetService.exportAsset() already triggers
          // the StorageUtils.downloadJSON() download itself, the same
          // primitive workshop-browser-export-event-log above uses —
          // nothing further to do here beyond calling it.
          hostManager?.services.get("assets")?.exportAsset(event.data.assetId);
        } else if (event.data?.type === "workshop-browser-plugin-action" && event.data.id) {
          // host://plugins' own Enable/Disable/Reload buttons — see
          // HostPages.js's own pluginsPage() comment. The real
          // PluginManager call always happens here, via PluginService's
          // own thin action methods.
          const pluginService = hostManager?.services.get("plugins");
          if (event.data.action === "enable") pluginService?.enablePlugin(event.data.id);
          else if (event.data.action === "disable") pluginService?.disablePlugin(event.data.id);
          else if (event.data.action === "reload") pluginService?.reloadPlugin(event.data.id);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-set-plugin-permission" && event.data.pluginId && event.data.capabilityId) {
          // host://plugins' own per-plugin permission checkboxes.
          const pluginService = hostManager?.services.get("plugins");
          if (event.data.granted) pluginService?.grantPermission(event.data.pluginId, event.data.capabilityId);
          else pluginService?.revokePermission(event.data.pluginId, event.data.capabilityId);
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-run-health-check") {
          // workshop://diagnostics' own "Run Workshop Health Check"
          // button — see DiagnosticsService.js's own runHealthCheck()
          // comment for what "genuinely fresh" means here.
          const diagnosticsService = hostManager?.services.get("diagnostics");
          await diagnosticsService?.runHealthCheck();
          const tabId = activeTabId();
          if (frames.has(tabId)) loadIntoFrame(tabId, browserStore.getCurrentUrl(tabId));
        } else if (event.data?.type === "workshop-browser-export-event-log") {
          // workshop://diagnostics' own "Export Event Log" button —
          // WorkshopEventLog.js's own exportLog(), the identical
          // StorageUtils.downloadJSON() shape every other export in the
          // Workshop already uses.
          const workshopEventLog = hostManager?.services.get("workshopEventLog");
          const data = workshopEventLog?.exportLog();
          if (data) StorageUtils.downloadJSON(`workshop-event-log-${new Date().toISOString().slice(0, 10)}.json`, data);
        }
      };
      window.addEventListener("message", onMessage);

      const offBrowserStore = browserStore.events.on("browser:changed", render);
      render();

      return () => {
        disposed = true;
        window.removeEventListener("message", onMessage);
        offBrowserStore();
        for (const frame of frames.values()) frame.remove();
        frames.clear();
      };
    },
  };
}

function toolbarButton(glyph, title) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "browser-toolbar-button";
  btn.textContent = glyph;
  btn.title = title;
  return btn;
}

/** Bare domain/IP/localhost gets an inferred scheme rather than being
 *  treated as a search query — "please treat these simply as browser
 *  pages," and the brief's own examples (github.com, localhost:3000,
 *  127.0.0.1) are all addresses, not queries. Anything else that doesn't
 *  look like an address (contains a space, or simply doesn't match a
 *  domain-like shape) is treated as a Unified Search query instead of
 *  guessing at `https://` for it — "please introduce the foundations for
 *  unified searching... integrate wherever practical," concretely, right
 *  here in the one place every typed address already passes through. */
function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const internalSchemePattern = new RegExp(`^(${INTERNAL_SCHEMES.join("|")}):\\/\\/`, "i");
  if (internalSchemePattern.test(trimmed)) return trimmed.toLowerCase();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(trimmed) && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `workshop://search?q=${encodeURIComponent(trimmed)}`;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function notFoundHtml(url) {
  return `<h1>Page not found</h1><p>Nothing is registered for <code>${escapeHtml(url)}</code>.</p><p><a href="workshop://">Return to Workshop Home</a></p>`;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
