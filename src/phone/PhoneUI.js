import { iconMarkup } from "../utils/ProceduralIcons.js";

/**
 * PhoneUI
 * ---------
 * "The phone should animate naturally into view from the player's
 * hand... feel like a physical object carried by the player rather than
 * simply another floating interface." The exact slide-up-from-the-
 * bottom-right animation the old Builder Phone already established
 * (`.workshop-phone`/`.open`, in css/phone.css) — that already read as
 * "reaching into your pocket," and needed no redesign, only a new,
 * general home to live in rather than being Build Mode's own private
 * shell.
 *
 * This class owns exactly two things: the physical shell (open/close,
 * the header, a back-to-home button) and the home screen grid. It has no
 * idea what a Being, an outfit, or a construction piece is — every app's
 * own content is just a `mount(container)` call into `this.content`,
 * the same shape every computer app already uses. `PhoneSystem.js` is
 * the only thing that ever calls into this file.
 *
 * Interface & Design Refinement phase — "immediately recognisable as a
 * modern smartphone." Two small additions turn the shell from "a wooden
 * box with a title bar" into something with the actual anatomy a real
 * phone has, without touching anything about how apps mount or how
 * navigation behaves: a status bar (the Workshop's own real time, read
 * from `TimeOfDaySystem` — see `PhoneSystem.js`'s own `_updateStatusBar()` —
 * plus a couple of honestly-decorative signal/battery glyphs, the same
 * "a real detail, not a fabricated one" standard the wall clock already
 * set for its own chime), and a home indicator bar, the one purely
 * cosmetic nod to "this is a touchscreen" every modern phone shares.
 * Still wood and brass, not glass and aluminium — "its own identity
 * while remaining clearly part of the Workshop" meant refining this
 * phone's own material language further, not replacing it with a generic
 * one.
 */
export class PhoneUI {
  constructor(rootEl, callbacks) {
    this.root = rootEl;
    this.callbacks = callbacks;

    this.phone = document.createElement("div");
    this.phone.className = "workshop-phone";
    this.root.appendChild(this.phone);

    const statusBar = document.createElement("div");
    statusBar.className = "workshop-phone-statusbar";
    this.statusTimeEl = document.createElement("span");
    this.statusTimeEl.className = "workshop-phone-status-time";
    this.statusTimeEl.textContent = "--:--";
    const statusIcons = document.createElement("span");
    statusIcons.className = "workshop-phone-status-icons";
    statusIcons.textContent = "\u{1F4F6} \u{1F50B}"; // signal, battery — decorative, the same honesty standard as a real device's own always-full mockup screenshots
    statusBar.append(this.statusTimeEl, statusIcons);
    this.phone.appendChild(statusBar);

    const header = document.createElement("div");
    header.className = "workshop-phone-header";
    this.homeBtn = document.createElement("button");
    this.homeBtn.type = "button";
    this.homeBtn.className = "workshop-phone-home-button";
    this.homeBtn.textContent = "\u2302";
    this.homeBtn.title = "Home";
    this.homeBtn.addEventListener("click", () => this.callbacks.onGoHome());
    this.titleEl = document.createElement("span");
    this.titleEl.className = "workshop-phone-title";
    this.titleEl.textContent = "Workshop";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "workshop-phone-close-button";
    closeBtn.textContent = "\u2715";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.callbacks.onClose());
    header.append(this.homeBtn, this.titleEl, closeBtn);
    this.phone.appendChild(header);

    this.content = document.createElement("div");
    this.content.className = "workshop-phone-content";
    this.phone.appendChild(this.content);

    const homeIndicator = document.createElement("div");
    homeIndicator.className = "workshop-phone-home-indicator";
    this.phone.appendChild(homeIndicator);

    this.root.classList.add("hidden");
  }

  /** Called from `PhoneSystem.update()`, throttled, only while open —
   *  see that file's own comment. */
  setStatusTime(text) {
    this.statusTimeEl.textContent = text;
  }

  show() {
    this.root.classList.remove("hidden");
    // Applying "open" a frame later, rather than immediately, is what
    // makes the slide-up an actual transition rather than an instant
    // jump — the phone needs to render off-screen for one frame first.
    requestAnimationFrame(() => this.phone.classList.add("open"));
  }

  hide() {
    this.phone.classList.remove("open");
    // Wait for the slide-down transition to actually finish before pulling
    // the root out of the layout entirely.
    setTimeout(() => this.root.classList.add("hidden"), 380);
  }

  /** `isHome` is an explicit flag, not a string comparison against the
   *  title text — an earlier version compared `title === "Workshop"` to
   *  decide whether to hide the Home button, which happened to also be
   *  exactly the Workshop *app*'s own label, hiding the Home button on
   *  that app's own screen the same way it's hidden on the actual home
   *  screen. "Add the same Home button behaviour used by the other
   *  applications" — every app screen shows it now, regardless of what
   *  its own label happens to say. */
  setTitle(title, isHome = false) {
    this.titleEl.textContent = title;
    this.homeBtn.style.visibility = isHome ? "hidden" : "visible";
  }

  /** "Display applications as a simple grid of icons... the design
   *  should remain minimal, clear, readable, comfortable." Version 3,
   *  Phase 10 ("Real Assets, Honestly Introduced") gave `iconMarkup()`
   *  a real drawn mark for every first-party app's own `glyph`;
   *  anything it doesn't recognise (a third-party plugin's own literal
   *  emoji) falls back to printing `glyph` as plain text, exactly as
   *  this always did. Every icon is a plain button — an icon and a
   *  label, nothing trying to look like Android or iOS. */
  showHome(apps) {
    this.setTitle("Workshop", true);
    this.content.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "workshop-phone-home-grid";
    for (const app of apps) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "workshop-phone-app-tile";
      const glyph = document.createElement("span");
      glyph.className = "workshop-phone-app-glyph";
      const icon = iconMarkup(app.glyph);
      if (icon) glyph.innerHTML = icon;
      else glyph.textContent = app.glyph ?? "\u25A1";
      const label = document.createElement("span");
      label.className = "workshop-phone-app-label";
      label.textContent = app.label;
      tile.append(glyph, label);
      tile.addEventListener("click", () => this.callbacks.onSelectApp(app.id));
      grid.appendChild(tile);
    }
    this.content.appendChild(grid);
  }

  /** Clears the content area for an app's own `mount()` to fill —
   *  returns the element to mount into, the same convention
   *  `WorkstationPanel.js` already uses for computer apps. */
  prepareAppContainer(title) {
    this.setTitle(title, false);
    this.content.innerHTML = "";
    return this.content;
  }
}
