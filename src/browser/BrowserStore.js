import { EventBus } from "../core/EventBus.js";

const HOME_URL = "workshop://";
const MAX_HISTORY_PER_TAB = 100;

/**
 * BrowserStore
 * --------------
 * "The browser should remember everything between Workshop sessions...
 * closing and reopening the Workshop should feel like waking up a
 * computer rather than launching a brand-new browser." Ordinary JSON
 * through the normal `PersistenceSystem` path — tabs, their navigation
 * history, which one's active, and (where practical — see
 * `setScrollY()`'s own note) scroll position are all small, plain data,
 * nothing that needs `TextureStore.js`/`ImageAssetStore.js`'s own
 * IndexedDB treatment.
 *
 * A tab is `{ id, history: string[], historyIndex, scrollY, title }` —
 * `history`/`historyIndex` together are the entire back/forward
 * mechanism (`historyIndex` pointing at the current entry;
 * `navigate()` truncates anything ahead of it before pushing, the
 * ordinary "visiting a new page clears forward history" behaviour every
 * real browser has). Always at least one tab — `closeTab()` on the last
 * remaining one opens a fresh Home tab instead of leaving the browser
 * with nothing to show, the same "never an empty, purposeless state"
 * instinct behind `AnimationLibraryStore` always having its own defaults.
 */
export class BrowserStore {
  constructor() {
    this.events = new EventBus();
    const first = this._makeTab();
    /** @type {Array<{id:string, history:string[], historyIndex:number, scrollY:number, title:string}>} */
    this.tabs = [first];
    this.activeTabId = first.id;
  }

  _makeTab(url = HOME_URL) {
    return { id: `tab-${Date.now()}-${Math.round(Math.random() * 10000)}`, history: [url], historyIndex: 0, scrollY: 0, title: "New Tab" };
  }

  newTab(url = HOME_URL) {
    const tab = this._makeTab(url);
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this._emitChanged();
    return tab.id;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;
    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      // Never left with nothing to show — see this class's own comment.
      const fresh = this._makeTab();
      this.tabs.push(fresh);
      this.activeTabId = fresh.id;
    } else if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[Math.min(index, this.tabs.length - 1)].id;
    }
    this._emitChanged();
  }

  setActiveTab(tabId) {
    if (!this.tabs.some((t) => t.id === tabId)) return;
    this.activeTabId = tabId;
    this._emitChanged();
  }

  getActiveTab() {
    return this.tabs.find((t) => t.id === this.activeTabId) ?? this.tabs[0];
  }

  getTab(tabId) {
    return this.tabs.find((t) => t.id === tabId) ?? null;
  }

  all() {
    return this.tabs;
  }

  /** Visiting a new page — truncates any forward history past the
   *  current point first, the ordinary browser convention, then pushes
   *  the new URL and resets scroll (a fresh page starts at the top). */
  navigate(tabId, url) {
    const tab = this.getTab(tabId);
    if (!tab || !url) return;
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    if (tab.history.length > MAX_HISTORY_PER_TAB) tab.history.shift();
    tab.historyIndex = tab.history.length - 1;
    tab.scrollY = 0;
    this._emitChanged();
  }

  goBack(tabId) {
    const tab = this.getTab(tabId);
    if (!tab || tab.historyIndex <= 0) return;
    tab.historyIndex -= 1;
    tab.scrollY = 0;
    this._emitChanged();
  }

  goForward(tabId) {
    const tab = this.getTab(tabId);
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    tab.historyIndex += 1;
    tab.scrollY = 0;
    this._emitChanged();
  }

  canGoBack(tabId) {
    const tab = this.getTab(tabId);
    return !!tab && tab.historyIndex > 0;
  }

  canGoForward(tabId) {
    const tab = this.getTab(tabId);
    return !!tab && tab.historyIndex < tab.history.length - 1;
  }

  getCurrentUrl(tabId) {
    const tab = this.getTab(tabId);
    return tab ? tab.history[tab.historyIndex] : HOME_URL;
  }

  setTitle(tabId, title) {
    const tab = this.getTab(tabId);
    if (!tab || tab.title === title) return;
    tab.title = title || "New Tab";
    this.events.emit("browser:changed"); // title updates are frequent (every navigation) and cosmetic — not worth an eager save on their own
  }

  /** "Scroll positions where practical" — practical specifically means
   *  same-origin `workshop://` pages. A cross-origin `http(s)://` iframe's
   *  scroll position is genuinely unreadable from here; the browser's own
   *  same-origin policy blocks a parent page from touching
   *  `iframe.contentWindow.scrollY` for a frame from a different origin,
   *  full stop — not a Workshop limitation to engineer around, an
   *  ordinary web platform one every embedded browser view runs into.
   *  BrowserApp.js only ever calls this for workshop:// tabs. */
  setScrollY(tabId, y) {
    const tab = this.getTab(tabId);
    if (!tab) return;
    tab.scrollY = y;
    this.events.emit("browser:changed"); // scroll position is too frequent to trigger an eager save on every pixel — persisted whenever the next real save happens anyway
  }

  _emitChanged() {
    this.events.emit("browser:changed");
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  save() {
    return { tabs: this.tabs, activeTabId: this.activeTabId };
  }

  load(data) {
    if (!data?.tabs?.length) return;
    this.tabs = data.tabs;
    this.activeTabId = data.activeTabId && this.tabs.some((t) => t.id === data.activeTabId) ? data.activeTabId : this.tabs[0].id;
    this.events.emit("browser:changed");
  }
}

export { HOME_URL };
