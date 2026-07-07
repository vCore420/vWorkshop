/**
 * createNotebookOverlay
 * ----------------------
 * "Physical notebooks become notes." One page, one textarea, saved to
 * NotesStore keyed by the notebook's own id — see Notebook.js.
 */
export function createNotebookOverlay({ notesStore }) {
  return {
    materialClass: "paper",
    mount(panelEl, context) {
      const notebookId = context?.definition?.notebookId ?? "default";

      const heading = document.createElement("h2");
      heading.textContent = "Notebook";
      const meta = document.createElement("div");
      meta.className = "paper-meta";
      meta.textContent = "Notes are saved automatically.";

      const textarea = document.createElement("textarea");
      textarea.value = notesStore.read(notebookId);
      textarea.placeholder = "Write whatever you like\u2026";
      textarea.addEventListener("input", () => notesStore.write(notebookId, textarea.value));

      panelEl.append(heading, meta, textarea);
      textarea.focus();
      return null;
    },
  };
}
