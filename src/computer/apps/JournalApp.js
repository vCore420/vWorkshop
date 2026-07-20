/**
 * createJournalApp
 * -------------------
 * The computer's own page of notes — distinct from the physical notebook
 * on the workbench (that one stays exactly as it was; this phase doesn't
 * touch it). Both are backed by the same generic NotesStore, just under a
 * different key, which is the whole point of keying notebooks by id.
 */
const JOURNAL_ID = "computer-journal";

export function createJournalApp({ notesStore }) {
  return {
    id: "journal",
    label: "Journal",
    glyph: "journal",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Journal";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Saved automatically, exactly as you left it.";

      const textarea = document.createElement("textarea");
      textarea.value = notesStore.read(JOURNAL_ID);
      textarea.placeholder = "What are you thinking about\u2026";
      textarea.setAttribute("aria-label", "Journal entry");
      textarea.style.width = "100%";
      textarea.style.minHeight = "60vh";
      textarea.style.background = "rgba(255,255,255,0.03)";
      textarea.style.border = "1px solid rgba(255,255,255,0.1)";
      textarea.style.borderRadius = "8px";
      textarea.style.padding = "14px";
      textarea.style.color = "var(--paper)";
      textarea.style.fontFamily = "var(--font-body)";
      textarea.style.fontSize = "0.95rem";
      textarea.style.lineHeight = "1.6";
      textarea.addEventListener("input", () => notesStore.write(JOURNAL_ID, textarea.value));

      container.append(heading, subtitle, textarea);
      textarea.focus();
      return null;
    },
  };
}
