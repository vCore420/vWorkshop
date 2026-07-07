/**
 * createBrowserApp
 * -------------------
 * An honest placeholder, not a fake feature — the address bar doesn't do
 * anything yet. When a real browser view is worth the complexity (probably
 * an <iframe> where the target allows it, with a clear fallback for where
 * it doesn't), it slots in here without touching the rail or any other app.
 */
export function createBrowserApp() {
  return {
    id: "browser",
    label: "Browser",
    glyph: "\uD83C\uDF10",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Browser";
      const bar = document.createElement("div");
      bar.className = "browser-address-bar";
      bar.innerHTML = "<span>\u{1F512}</span><span>the web isn't open yet</span>";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "A real browser view will live here eventually. For now, this is just the frame it'll sit in.";
      container.append(heading, bar, empty);
      return null;
    },
  };
}
