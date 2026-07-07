/**
 * createAIApp
 * -------------
 * Reserved for a local AI companion — see docs/PLUGIN_GUIDE.md, which
 * describes this as a natural plugin. The input below is deliberately
 * disabled rather than wired to nothing; an honest placeholder says so.
 */
export function createAIApp() {
  return {
    id: "ai",
    label: "AI",
    glyph: "\u2726",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "AI";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "A local AI companion will sit here eventually — something to talk through ideas with, not a search box.";
      const row = document.createElement("div");
      row.className = "ai-input-row";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Not connected yet\u2026";
      input.disabled = true;
      row.appendChild(input);
      container.append(heading, empty, row);
      return null;
    },
  };
}
