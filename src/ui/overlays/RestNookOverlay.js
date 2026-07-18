import { fetchText } from "../../browser/WorkshopPages.js";
import { renderMarkdown } from "../../utils/SimpleMarkdown.js";
import { buildArchiveContent } from "./ArchiveOverlay.js";
import { FurnitureSystem } from "../../systems/FurnitureSystem.js";

const HISTORY_PATH = "./docs/HISTORY.md";

/**
 * createRestNookOverlay
 * ----------------------
 * The sitting area doesn't do much yet on purpose — it's a comfortable,
 * quiet corner reserved for something calmer later (a local AI companion
 * to sit and talk with). This overlay stays brief rather than padding
 * itself out with fake content.
 *
 * "Currently dismissing the introductory message removes the text but
 * leaves part of the screen darkened. After dismissing the message, the
 * screen should immediately return to normal." Root cause: every
 * `materialClass: "panel"` overlay's own outer `.overlay` element
 * (`OverlayManager.js`'s own wrapper, not `panelEl` this file is handed)
 * carries its own full-screen dark backdrop
 * (`.overlay--panel { background: rgba(10,8,6,0.7) }`) — a separate
 * element from `panelEl` entirely. Fading `panelEl` alone (an earlier
 * fix for this same overlay) correctly hid the reminder's own visible
 * card, but never touched that outer backdrop, which stayed fully
 * opaque across the whole screen regardless. Dismissing now also fades
 * `panelEl.parentElement` — the actual `.overlay` element carrying that
 * background — back to transparent, alongside the same
 * `pointer-events: none` this overlay's own dismiss already relied on so
 * neither element can intercept clicks once invisible. The overlay's own
 * open/closed state is still untouched either way — this is purely a
 * visual dismissal; leaving the chair is still entirely CameraSystem's
 * own, unrelated Escape-driven mechanism, and re-sitting creates a fresh
 * overlay instance, so the reminder is there to dismiss again next time.
 *
 * Version 3, Phase 3 ("The Reading Chair") — the sitting area gains a
 * quiet way to read while seated, once the arrival reminder above has
 * been put away: a small "Read" tab appears (revealed by the same
 * `dismiss()` that fades the reminder), offering "The Workshop's Story"
 * (the exact same `docs/HISTORY.md` content `workshop://history` shows —
 * fetched and rendered with the same `fetchText()`/`renderMarkdown()`
 * pair that page uses internally, exported from `WorkshopPages.js`
 * rather than duplicated here, deliberately skipping that page's own
 * `wrapPage()` iframe-document wrapping since this is a real in-page DOM
 * panel, not an iframe surface) and "The Archive" (every finished
 * project, via `buildArchiveContent()` — the exact same rendering
 * `ArchiveOverlay.js`'s own shelving interaction uses, so the chair and
 * the shelf genuinely show the same archive rather than two independent
 * copies of it). This is the "narrow" mechanism the phase's own planning
 * settled on: a button inside the chair's own reading panel that swaps
 * its content, with no change to `InteractionSystem`'s own suspension
 * logic and no separate interactable — sitting down still opens exactly
 * one overlay, exactly as it always has.
 *
 * The read tab itself is appended as a *sibling* of `panelEl` (onto
 * `panelEl.parentElement`, the same outer `.overlay` element the fix
 * above already reaches into) rather than as a child of it — the
 * dismissed reminder's own `rest-nook-panel-dismissed`
 * (`opacity: 0; pointer-events: none`) is scoped to `panelEl` alone, so a
 * sibling is untouched by it and can stay visible and clickable for the
 * rest of the sitting session while the reminder card itself fades away
 * for good. Opening the reading panel reuses `panelEl` again (clearing
 * and repopulating it, and stripping the two dismissed classes back
 * off) rather than creating a second panel element, so it inherits the
 * exact same wood-panel `.overlay--panel` material the reminder itself
 * used.
 *
 * Version 3, Phase 4 ("Workshop Rituals") — "sitting at the same chair"
 * becoming a genuine habit, not just a static piece of furniture: opening
 * the reading panel fresh now offers whichever of Story/Archive was open
 * the last time it was read, instead of always resetting to the neutral
 * menu, via `FurnitureSystem.getInteractionState("sittingArea")` — the
 * same small, generic per-piece memory `docs/FURNITURE.md` and that
 * system's own comment describe. Backing out to the menu with "Back"
 * doesn't clear this — the memory is "what you were last actually
 * reading," not "what screen happened to be open," which is what a
 * returning reader would expect a bookmark to mean.
 */
export function createRestNookOverlay({ projectsStore }) {
  return {
    materialClass: "panel",
    mount(panelEl, context, engine) {
      const backdropEl = panelEl.parentElement;
      const furnitureSystem = engine.getSystem(FurnitureSystem);
      let panelOpen = false;

      const reminder = document.createElement("div");
      reminder.className = "rest-nook-reminder";
      const heading = document.createElement("h2");
      heading.textContent = "A quiet corner";
      const body = document.createElement("p");
      body.style.lineHeight = "1.6";
      body.textContent =
        "Nothing needs doing here. This spot is being kept free for something quieter, later — for now, it's just somewhere comfortable to sit.";
      reminder.append(heading, body);
      panelEl.appendChild(reminder);

      const hint = document.createElement("p");
      hint.className = "rest-nook-dismiss-hint";
      hint.textContent = "Click to dismiss";
      panelEl.appendChild(hint);

      const readTab = document.createElement("button");
      readTab.type = "button";
      readTab.className = "rest-nook-read-tab";
      readTab.textContent = "\u{1F4D6} Read";
      backdropEl.appendChild(readTab);

      const dismiss = () => {
        panelEl.classList.add("rest-nook-panel-dismissed");
        backdropEl.classList.add("rest-nook-backdrop-dismissed");
        readTab.classList.add("visible");
      };
      reminder.addEventListener("click", dismiss);
      hint.addEventListener("click", dismiss);

      const openPanel = () => {
        panelEl.classList.remove("rest-nook-panel-dismissed");
        backdropEl.classList.remove("rest-nook-backdrop-dismissed");
        panelOpen = true;
      };
      const closePanel = () => {
        panelEl.classList.add("rest-nook-panel-dismissed");
        backdropEl.classList.add("rest-nook-backdrop-dismissed");
        panelOpen = false;
      };

      const backRow = (onBack) => {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "rest-nook-back";
        back.textContent = "← Back";
        back.addEventListener("click", onBack);
        return back;
      };

      const showMenu = () => {
        openPanel();
        panelEl.replaceChildren();

        const menuHeading = document.createElement("h2");
        menuHeading.textContent = "A quiet read";
        panelEl.appendChild(menuHeading);

        const menu = document.createElement("div");
        menu.className = "rest-nook-menu";
        menu.appendChild(menuItem("\u{1F4D6} The Workshop's Story", showStory));
        menu.appendChild(menuItem("\u{1F5C4}️ The Archive", showArchive));
        panelEl.appendChild(menu);

        const putDown = document.createElement("p");
        putDown.className = "rest-nook-dismiss-hint";
        putDown.textContent = "Put it down";
        putDown.addEventListener("click", closePanel);
        panelEl.appendChild(putDown);
      };

      function menuItem(label, onOpen) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rest-nook-menu-item";
        btn.textContent = label;
        btn.addEventListener("click", onOpen);
        return btn;
      }

      const showStory = async () => {
        furnitureSystem?.setInteractionState("sittingArea", { lastView: "story" });
        panelEl.replaceChildren();
        panelEl.appendChild(backRow(showMenu));
        const storyHeading = document.createElement("h2");
        storyHeading.textContent = "The Workshop's Story";
        panelEl.appendChild(storyHeading);

        const storyBody = document.createElement("div");
        storyBody.className = "rest-nook-story-body";
        storyBody.textContent = "…";
        panelEl.appendChild(storyBody);

        try {
          const markdown = await fetchText(HISTORY_PATH);
          storyBody.innerHTML = renderMarkdown(markdown);
        } catch {
          storyBody.textContent = "Couldn't find this book on the shelf right now.";
        }
      };

      const showArchive = () => {
        furnitureSystem?.setInteractionState("sittingArea", { lastView: "archive" });
        panelEl.replaceChildren();
        panelEl.appendChild(backRow(showMenu));
        const archiveHeading = document.createElement("h2");
        archiveHeading.textContent = "The Archive";
        panelEl.appendChild(archiveHeading);
        panelEl.appendChild(buildArchiveContent(projectsStore));
      };

      readTab.addEventListener("click", () => {
        if (panelOpen) {
          closePanel();
          return;
        }
        const lastView = furnitureSystem?.getInteractionState("sittingArea")?.lastView;
        if (lastView === "story") showStory();
        else if (lastView === "archive") showArchive();
        else showMenu();
      });

      return null;
    },
  };
}
