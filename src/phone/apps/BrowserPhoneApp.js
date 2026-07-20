/**
 * createBrowserPhoneApp
 * ------------------------
 * "Introduce a lightweight browser companion... quick access to Workshop
 * documentation, GitHub, Bookmarks, Saved Workshop pages. The full
 * browser experience should remain available on the Workshop computer."
 * Internal-scheme links (`workshop://`, `host://`, `plugin://` — see
 * `PageRegistry.isInternalUrl()`) render inline (an iframe with the exact
 * `{title, html}` shape `PageRegistry.resolve()` already produces for the
 * full computer Browser — the same content, not a re-fetched copy);
 * ordinary `https://` links (GitHub, say) open in a real new browser tab
 * instead of trying to embed a site this Workshop doesn't control.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — this is a
 * browser, so it borrows a real browser's own chrome: a pill-shaped
 * address bar for adding bookmarks, a favicon-style globe mark on every
 * link/bookmark row, and a real toolbar (back chevron + page title) over
 * the opened page instead of a plain "← Back" text button.
 */
import { isInternalUrl } from "../../browser/PageRegistry.js";
import { nextDomId } from "../../utils/domIds.js";
import { iconMarkup } from "../../utils/ProceduralIcons.js";

export function createBrowserPhoneApp({ pageRegistry, browserStore }) {
  return {
    id: "browser",
    label: "Browser",
    glyph: "browser",
    mount(container) {
      const listView = document.createElement("div");
      const pageView = document.createElement("div");
      pageView.className = "workshop-phone-page-view";
      pageView.style.display = "none";
      container.append(listView, pageView);

      const iframe = document.createElement("iframe");
      iframe.className = "workshop-phone-page-frame";
      iframe.title = "Page";
      const toolbar = document.createElement("div");
      toolbar.className = "workshop-phone-browser-toolbar";
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "workshop-phone-browser-back-button";
      backBtn.innerHTML = iconMarkup("chevronLeft");
      backBtn.setAttribute("aria-label", "Back to Browser");
      backBtn.addEventListener("click", showList);
      const toolbarTitle = document.createElement("span");
      toolbarTitle.className = "workshop-phone-browser-toolbar-title";
      toolbar.append(backBtn, toolbarTitle);
      pageView.append(toolbar, iframe);

      async function openInternalPage(url, title) {
        const page = await pageRegistry.resolve(url);
        iframe.srcdoc = page?.html ?? `<p>${title} isn't available.</p>`;
        iframe.title = page?.title ?? title;
        toolbarTitle.textContent = page?.title ?? title;
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

        const quickHeadingId = nextDomId("phone-browser-quick-heading");
        const quickSection = document.createElement("div");
        quickSection.className = "workshop-phone-section";
        quickSection.setAttribute("role", "group");
        quickSection.setAttribute("aria-labelledby", quickHeadingId);
        const quickHeading = document.createElement("h3");
        quickHeading.id = quickHeadingId;
        quickHeading.textContent = "Quick Links";
        quickSection.appendChild(quickHeading);
        const quickList = document.createElement("div");
        quickList.setAttribute("role", "list");
        quickList.appendChild(buildLinkRow("Workshop Documentation", () => openInternalPage("workshop://documentation", "Documentation")));
        quickList.appendChild(buildLinkRow("Search the Workshop", () => openInternalPage("workshop://search", "Search")));
        quickList.appendChild(buildLinkRow("GitHub", () => window.open("https://github.com", "_blank", "noopener")));
        quickSection.appendChild(quickList);
        listView.appendChild(quickSection);

        const bookmarksHeadingId = nextDomId("phone-browser-bookmarks-heading");
        const bookmarksSection = document.createElement("div");
        bookmarksSection.className = "workshop-phone-section";
        bookmarksSection.setAttribute("role", "group");
        bookmarksSection.setAttribute("aria-labelledby", bookmarksHeadingId);
        const bookmarksHeading = document.createElement("h3");
        bookmarksHeading.id = bookmarksHeadingId;
        bookmarksHeading.textContent = "Bookmarks & Saved Pages";
        bookmarksSection.appendChild(bookmarksHeading);
        if (browserStore.bookmarks.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No bookmarks yet \u2014 add one below, or save a page from the full Browser on the computer.";
          bookmarksSection.appendChild(empty);
        }
        const bookmarksList = document.createElement("div");
        bookmarksList.setAttribute("role", "list");
        for (const bookmark of browserStore.bookmarks) {
          const row = document.createElement("div");
          row.className = "workshop-phone-list-row";
          row.setAttribute("role", "listitem");
          const favicon = document.createElement("span");
          favicon.className = "workshop-phone-browser-favicon";
          favicon.innerHTML = iconMarkup("browser");
          favicon.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.className = "workshop-phone-list-label";
          label.textContent = bookmark.title;
          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "workshop-phone-small-button";
          openBtn.textContent = "Open";
          openBtn.setAttribute("aria-label", `Open ${bookmark.title}`);
          openBtn.addEventListener("click", () => {
            if (isInternalUrl(bookmark.url)) openInternalPage(bookmark.url, bookmark.title);
            else window.open(bookmark.url, "_blank", "noopener");
          });
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "builder-icon-button";
          removeBtn.textContent = "\u2715";
          removeBtn.setAttribute("aria-label", `Remove bookmark: ${bookmark.title}`);
          removeBtn.addEventListener("click", () => browserStore.removeBookmark(bookmark.url));
          row.append(favicon, label, openBtn, removeBtn);
          bookmarksList.appendChild(row);
        }
        bookmarksSection.appendChild(bookmarksList);

        const addressBar = document.createElement("div");
        addressBar.className = "workshop-phone-browser-addressbar";
        const addressIcon = document.createElement("span");
        addressIcon.className = "workshop-phone-browser-addressbar-icon";
        addressIcon.innerHTML = iconMarkup("browser");
        addressIcon.setAttribute("aria-hidden", "true");
        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.placeholder = "workshop://docs, host://services, or https://\u2026";
        urlInput.setAttribute("aria-label", "Bookmark URL");
        addressBar.append(addressIcon, urlInput);
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "workshop-phone-small-button";
        addBtn.textContent = "Add Bookmark";
        addBtn.addEventListener("click", () => {
          if (!urlInput.value.trim()) return;
          browserStore.addBookmark(urlInput.value.trim(), urlInput.value.trim());
          urlInput.value = "";
        });
        bookmarksSection.append(addressBar, addBtn);
        listView.appendChild(bookmarksSection);
      }

      function buildLinkRow(label, onOpen) {
        const row = document.createElement("div");
        row.className = "workshop-phone-list-row";
        row.setAttribute("role", "listitem");
        const favicon = document.createElement("span");
        favicon.className = "workshop-phone-browser-favicon";
        favicon.innerHTML = iconMarkup("browser");
        favicon.setAttribute("aria-hidden", "true");
        const labelEl = document.createElement("span");
        labelEl.className = "workshop-phone-list-label";
        labelEl.textContent = label;
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "workshop-phone-small-button";
        openBtn.textContent = "Open";
        openBtn.setAttribute("aria-label", `Open ${label}`);
        openBtn.addEventListener("click", onOpen);
        row.append(favicon, labelEl, openBtn);
        return row;
      }

      renderList();
      const off = browserStore.events.on("browser:changed", renderList);
      return () => off();
    },
  };
}
