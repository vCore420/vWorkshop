import { wrapPage } from "../../browser/PageShell.js";

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
 * URL becomes `iframe.src`; a `workshop://` URL resolves through
 * `PageRegistry` (see that file's own comment) and becomes
 * `iframe.srcdoc`. `BrowserApp` itself has no idea what `workshop://docs`
 * or `workshop://projects` actually contain — it only ever asks the
 * registry "what's the page for this path" and renders whatever comes
 * back, exactly as "the Browser should not contain hardcoded knowledge
 * about Workshop systems" asks for.
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
export function createBrowserApp({ browserStore, pageRegistry }) {
  return {
    id: "browser",
    label: "Browser",
    glyph: "\uD83C\uDF10",
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
      addressBar.placeholder = "Search or enter a workshop:// or web address";
      toolbar.appendChild(addressBar);

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

      function ensureFrame(tabId) {
        let frame = frames.get(tabId);
        if (frame) return frame;
        frame = document.createElement("iframe");
        frame.className = "browser-frame";
        frame.dataset.tabId = tabId;
        // Deliberately not sandboxed — a sandboxed srcdoc frame loses
        // same-origin access to its own contentWindow, which is exactly
        // what scroll-position tracking for workshop:// pages needs (see
        // BrowserStore.js's own note on why that's only ever practical
        // for same-origin content in the first place).
        frame.addEventListener("load", () => onFrameLoad(tabId, frame));
        content.appendChild(frame);
        frames.set(tabId, frame);
        return frame;
      }

      function onFrameLoad(tabId, frame) {
        if (disposed) return;
        const url = frame.dataset.currentUrl ?? "";
        if (url.startsWith("workshop://")) {
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

      function loadIntoFrame(tabId, url) {
        const frame = ensureFrame(tabId);
        frame.dataset.currentUrl = url;
        if (url.startsWith("workshop://")) {
          const path = url.slice("workshop://".length);
          frame.removeAttribute("src");
          pageRegistry
            .resolve(path)
            .then((page) => {
              if (disposed || frame.dataset.currentUrl !== url) return; // navigated elsewhere before this resolved
              if (page) {
                frame.srcdoc = page.html;
                browserStore.setTitle(tabId, page.title);
              } else {
                frame.srcdoc = wrapPage("Not found", notFoundHtml(url));
                browserStore.setTitle(tabId, "Not found");
              }
              if (tabId === activeTabId()) renderChrome();
            })
            .catch(() => {
              if (disposed || frame.dataset.currentUrl !== url) return;
              frame.srcdoc = wrapPage("Couldn't load", notFoundHtml(url));
            });
        } else {
          frame.removeAttribute("srcdoc");
          // Setting iframe.src to a value it already has typically does
          // NOT reload it in real browsers, since nothing about the
          // attribute actually changed — which would make Refresh quietly
          // do nothing for an http(s) tab whose URL hasn't changed. A
          // genuine attribute change first (even to about:blank) forces
          // an actual reload either way.
          if (frame.src === url) frame.src = "about:blank";
          frame.src = url;
        }
      }

      /** Reconciles the live `frames` map against BrowserStore's own tab
       *  list: new tabs get a frame created and loaded, existing tabs only
       *  get reloaded if their *current URL actually changed* (comparing
       *  against the frame's own last-loaded url, tracked in
       *  `dataset.currentUrl`) — switching to a tab that's already showing
       *  the right thing must never reload it, or every bit of the point
       *  of keeping frames alive is lost. Closed tabs get their frame
       *  removed and disposed. */
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
          const frame = ensureFrame(tab.id);
          if (frame.dataset.currentUrl !== url) loadIntoFrame(tab.id, url);
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
        openExternalBtn.style.visibility = url.startsWith("workshop://") ? "hidden" : "visible";
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
        const frame = frames.get(tabId);
        if (!frame) return;
        const url = browserStore.getCurrentUrl(tabId);
        frame.dataset.currentUrl = ""; // forces loadIntoFrame to treat this as a genuine (re)load
        loadIntoFrame(tabId, url);
      });
      openExternalBtn.addEventListener("click", () => {
        const url = browserStore.getCurrentUrl(activeTabId());
        if (!url.startsWith("workshop://")) window.open(url, "_blank", "noopener");
      });
      newTabBtn.addEventListener("click", () => browserStore.newTab());
      addressBar.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const url = normalizeUrl(addressBar.value);
        if (url) browserStore.navigate(activeTabId(), url);
        addressBar.blur();
      });

      // ---- workshop:// page interactivity (link clicks, Settings' "clear data") ----
      const onMessage = (event) => {
        if (event.data?.type === "workshop-browser-navigate" && event.data.url) {
          browserStore.navigate(activeTabId(), event.data.url);
        } else if (event.data?.type === "workshop-browser-clear-data") {
          for (const tab of browserStore.all().slice()) browserStore.closeTab(tab.id);
          browserStore.navigate(activeTabId(), "workshop://");
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
 *  127.0.0.1) are all addresses, not queries. No search-engine
 *  integration was asked for, so none was added. */
function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^workshop:\/\//i.test(trimmed)) return trimmed.toLowerCase();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`;
  return `https://${trimmed}`;
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
