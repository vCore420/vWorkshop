/**
 * createBrowserPhoneApp
 * ------------------------
 * "Introduce a lightweight browser companion... quick access to Workshop
 * documentation, GitHub, Bookmarks, Saved Workshop pages. The full
 * browser experience should remain available on the Workshop computer."
 * `workshop://` links render inline (an iframe with the exact
 * `{title, html}` shape `PageRegistry.resolve()` already produces for the
 * full computer Browser — the same content, not a re-fetched copy);
 * ordinary `https://` links (GitHub, say) open in a real new browser tab
 * instead of trying to embed a site this Workshop doesn't control.
 */
export function createBrowserPhoneApp({ pageRegistry, browserStore }) {
  return {
    id: "browser",
    label: "Browser",
    glyph: "\uD83C\uDF10",
    mount(container) {
      const listView = document.createElement("div");
      const pageView = document.createElement("div");
      pageView.className = "workshop-phone-page-view";
      pageView.style.display = "none";
      container.append(listView, pageView);

      const iframe = document.createElement("iframe");
      iframe.className = "workshop-phone-page-frame";
      const backRow = document.createElement("div");
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "workshop-phone-small-button";
      backBtn.textContent = "\u2190 Back";
      backBtn.addEventListener("click", showList);
      backRow.appendChild(backBtn);
      pageView.append(backRow, iframe);

      async function openWorkshopPage(path, title) {
        const page = await pageRegistry.resolve(path);
        iframe.srcdoc = page?.html ?? `<p>${title} isn't available.</p>`;
        listView.style.display = "none";
        pageView.style.display = "flex";
      }

      function showList() {
        pageView.style.display = "none";
        listView.style.display = "block";
      }

      function renderList() {
        listView.innerHTML = "";
        const heading = document.createElement("h2");
        heading.textContent = "Browser";
        listView.appendChild(heading);

        const quickSection = document.createElement("div");
        quickSection.className = "workshop-phone-section";
        const quickHeading = document.createElement("h3");
        quickHeading.textContent = "Quick Links";
        quickSection.appendChild(quickHeading);
        quickSection.appendChild(buildLinkRow("Workshop Documentation", () => openWorkshopPage("docs", "Documentation")));
        quickSection.appendChild(buildLinkRow("GitHub", () => window.open("https://github.com", "_blank", "noopener")));
        listView.appendChild(quickSection);

        const bookmarksSection = document.createElement("div");
        bookmarksSection.className = "workshop-phone-section";
        const bookmarksHeading = document.createElement("h3");
        bookmarksHeading.textContent = "Bookmarks & Saved Pages";
        bookmarksSection.appendChild(bookmarksHeading);
        if (browserStore.bookmarks.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No bookmarks yet \u2014 add one below, or save a page from the full Browser on the computer.";
          bookmarksSection.appendChild(empty);
        }
        for (const bookmark of browserStore.bookmarks) {
          const row = document.createElement("div");
          row.className = "workshop-phone-list-row";
          const label = document.createElement("span");
          label.className = "workshop-phone-list-label";
          label.textContent = bookmark.title;
          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "workshop-phone-small-button";
          openBtn.textContent = "Open";
          openBtn.addEventListener("click", () => {
            if (bookmark.url.startsWith("workshop://")) openWorkshopPage(bookmark.url.replace("workshop://", ""), bookmark.title);
            else window.open(bookmark.url, "_blank", "noopener");
          });
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "builder-icon-button";
          removeBtn.textContent = "\u2715";
          removeBtn.addEventListener("click", () => browserStore.removeBookmark(bookmark.url));
          row.append(label, openBtn, removeBtn);
          bookmarksSection.appendChild(row);
        }

        const addRow = document.createElement("div");
        addRow.className = "workshop-phone-button-row";
        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.placeholder = "workshop://docs or https://\u2026";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "workshop-phone-small-button";
        addBtn.textContent = "Add Bookmark";
        addBtn.addEventListener("click", () => {
          if (!urlInput.value.trim()) return;
          browserStore.addBookmark(urlInput.value.trim(), urlInput.value.trim());
          urlInput.value = "";
        });
        addRow.append(urlInput, addBtn);
        bookmarksSection.appendChild(addRow);
        listView.appendChild(bookmarksSection);
      }

      function buildLinkRow(label, onOpen) {
        const row = document.createElement("div");
        row.className = "workshop-phone-list-row";
        const labelEl = document.createElement("span");
        labelEl.className = "workshop-phone-list-label";
        labelEl.textContent = label;
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "workshop-phone-small-button";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", onOpen);
        row.append(labelEl, openBtn);
        return row;
      }

      renderList();
      const off = browserStore.events.on("browser:changed", renderList);
      return () => off();
    },
  };
}
