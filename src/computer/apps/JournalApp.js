/**
 * createJournalApp
 * -------------------
 * "One contribution" (see docs/CONTRIBUTIONS.md) — the computer's own
 * page of notes used to be a single textarea, overwritten on every
 * keystroke; there was no way to look back at what you'd written before.
 * Backed by JournalStore now, not NotesStore: a real ordered list of
 * dated entries, each kept exactly as it was left. The physical notebook
 * on the workbench is a genuinely different thing (still backed by
 * NotesStore, untouched by this) — a single page you're always
 * mid-sentence in, the way a real paper notebook works. This is the
 * computer's own equivalent of what `docs/HISTORY.md` already is for the
 * project itself: an honest, dated record that accumulates instead of
 * being overwritten.
 */
function formatEntryStamp(iso) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  const dateOptions = { day: "numeric", month: "long" };
  if (date.getFullYear() !== now.getFullYear()) dateOptions.year = "numeric";
  return `${date.toLocaleDateString(undefined, dateOptions)}, ${time}`;
}

function previewText(text) {
  const firstLine = text.trim().split("\n")[0].slice(0, 60);
  if (!firstLine) return "Empty entry";
  return text.trim().length > 60 || text.trim().split("\n").length > 1 ? `${firstLine}…` : firstLine;
}

export function createJournalApp({ journalStore }) {
  return {
    id: "journal",
    label: "Journal",
    glyph: "journal",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Journal";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Every entry stays, dated, exactly as you left it — read back through an old one, or start today's.";

      const layout = document.createElement("div");
      layout.className = "journal-app";

      const rail = document.createElement("div");
      rail.className = "journal-rail";
      const newEntryBtn = document.createElement("button");
      newEntryBtn.type = "button";
      newEntryBtn.className = "journal-new-entry";
      newEntryBtn.textContent = "New entry";
      const listEl = document.createElement("ul");
      listEl.className = "wide-list journal-entry-list";
      listEl.setAttribute("aria-label", "Journal entries");
      rail.append(newEntryBtn, listEl);

      const editorPane = document.createElement("div");
      editorPane.className = "journal-editor";

      layout.append(rail, editorPane);
      container.append(heading, subtitle, layout);

      let selectedId = journalStore.list()[0]?.id ?? null;

      function selectEntry(id) {
        selectedId = id;
        renderList();
        renderEditor();
      }

      function renderList() {
        listEl.innerHTML = "";
        const entries = journalStore.list();
        for (const entry of entries) {
          const li = document.createElement("li");
          if (entry.id === selectedId) li.classList.add("active");

          const selectBtn = document.createElement("button");
          selectBtn.type = "button";
          selectBtn.className = "journal-entry-select";
          selectBtn.setAttribute("aria-current", entry.id === selectedId ? "true" : "false");
          const title = document.createElement("div");
          title.className = "item-title";
          title.textContent = formatEntryStamp(entry.createdAt);
          const meta = document.createElement("div");
          meta.className = "item-meta journal-entry-preview";
          meta.textContent = previewText(entry.text);
          selectBtn.append(title, meta);
          selectBtn.addEventListener("click", () => selectEntry(entry.id));

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "journal-entry-delete";
          deleteBtn.textContent = "Remove";
          deleteBtn.setAttribute("aria-label", `Remove entry from ${formatEntryStamp(entry.createdAt)}`);
          deleteBtn.addEventListener("click", () => {
            journalStore.deleteEntry(entry.id);
            if (selectedId === entry.id) selectedId = journalStore.list()[0]?.id ?? null;
            renderList();
            renderEditor();
          });

          li.append(selectBtn, deleteBtn);
          listEl.appendChild(li);
        }
      }

      function renderEditor() {
        editorPane.innerHTML = "";
        const entry = selectedId ? journalStore.get(selectedId) : null;
        if (!entry) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "No entries yet. Start one whenever you have something worth remembering.";
          editorPane.appendChild(empty);
          return;
        }

        const label = document.createElement("label");
        label.className = "journal-editor-label";
        label.textContent = formatEntryStamp(entry.createdAt);
        label.htmlFor = "journal-entry-textarea";

        const textarea = document.createElement("textarea");
        textarea.id = "journal-entry-textarea";
        textarea.className = "journal-entry-textarea";
        textarea.value = entry.text;
        textarea.placeholder = "What's on your mind…";
        textarea.addEventListener("input", () => {
          journalStore.write(entry.id, textarea.value);
          const row = listEl.querySelector(`li.active .journal-entry-preview`);
          if (row) row.textContent = previewText(textarea.value);
        });

        editorPane.append(label, textarea);
        textarea.focus();
      }

      newEntryBtn.addEventListener("click", () => {
        const entry = journalStore.createEntry();
        selectEntry(entry.id);
      });

      renderList();
      renderEditor();
      return null;
    },
  };
}
