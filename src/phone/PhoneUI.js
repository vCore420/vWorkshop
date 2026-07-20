import { iconMarkup } from "../utils/ProceduralIcons.js";
import { createCloseButton } from "../ui/closeButton.js";
import { createFocusTrap } from "../ui/focusTrap.js";

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
 * set for its own chime), and a home indicator bar — Version 3, Phase 13
 * ("The Phone Becomes a Device") made this a real second way back to the
 * home screen, not just the visual nod to "this is a touchscreen" it
 * started as; see this class's own constructor comment.
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
    statusIcons.setAttribute("aria-hidden", "true");
    statusBar.append(this.statusTimeEl, statusIcons);
    this.phone.appendChild(statusBar);

    const header = document.createElement("div");
    header.className = "workshop-phone-header";
    this.homeBtn = document.createElement("button");
    this.homeBtn.type = "button";
    this.homeBtn.className = "workshop-phone-home-button";
    this.homeBtn.textContent = "\u2302";
    this.homeBtn.title = "Home";
    this.homeBtn.setAttribute("aria-label", "Home");
    this.homeBtn.addEventListener("click", () => this.callbacks.onGoHome());
    this.titleEl = document.createElement("span");
    this.titleEl.className = "workshop-phone-title";
    this.titleEl.textContent = "Workshop";
    // `setTitle()` only fires once per screen (home <-> an app), not on an
    // app's own internal re-renders — a live region here announces
    // navigation without turning into noise every time a list refreshes.
    this.titleEl.setAttribute("aria-live", "polite");
    const closeBtn = createCloseButton({
      className: "workshop-phone-close-button",
      label: "\u2715",
      onClick: () => this.callbacks.onClose(),
    });
    header.append(this.homeBtn, this.titleEl, closeBtn);
    this.phone.appendChild(header);

    this.content = document.createElement("div");
    this.content.className = "workshop-phone-content";
    this.phone.appendChild(this.content);

    // Version 3, Phase 13 ("The Phone Becomes a Device") — playtesting
    // found this pill-shaped indicator, previously purely cosmetic ("this
    // is a touchscreen," nothing behind it), read as a real navigation
    // control that simply didn't work: a real device's own bottom
    // gesture bar always returns home when pressed. A genuine `<button>`
    // now, not a `<div>` with a click listener grafted on, so it's
    // reachable and activatable by keyboard the same way the header's own
    // Home button already is.
    const homeIndicator = document.createElement("button");
    homeIndicator.type = "button";
    homeIndicator.className = "workshop-phone-home-indicator";
    homeIndicator.title = "Home";
    homeIndicator.setAttribute("aria-label", "Home");
    homeIndicator.addEventListener("click", () => this.callbacks.onGoHome());
    this.phone.appendChild(homeIndicator);

    // Version 3, Phase 12 ("Accessibility & Comfort Pass") — `this.phone`
    // is only ever *visually* hidden (`.workshop-phone`'s own
    // `transform: translateY(140%)` in css/phone.css slides it off-screen;
    // there was never any CSS at all for the `.hidden` class this
    // constructor used to add to `this.root`, a dead no-op removed here).
    // Without `inert`, every button inside it — Home, Close, whichever app
    // was last open — stayed genuinely Tab-reachable the entire time the
    // phone was "closed," the same class of bug `WorkstationPanel.js` had.
    this.phone.setAttribute("role", "dialog");
    this.phone.setAttribute("aria-modal", "true");
    this.phone.setAttribute("aria-label", "Workshop Phone");
    this.phone.setAttribute("inert", "");
    this._focusTrap = createFocusTrap(this.phone);
  }

  /** Called from `PhoneSystem.update()`, throttled, only while open —
   *  see that file's own comment. */
  setStatusTime(text) {
    this.statusTimeEl.textContent = text;
  }

  /** Version 3, Phase 13 ("The Phone Becomes a Device") — called by
   *  `PhoneSystem` once at startup and again on every `settings:changed`,
   *  never read from a store directly (this class still has no idea what
   *  a `SettingsStore` is, the same "no idea what a Being, an outfit is"
   *  standard the rest of this file already holds to). Plain data
   *  attributes, not inline styles — `css/phone.css`'s own
   *  `[data-wallpaper]`/`[data-border]` rules do the actual work, so
   *  every preset's real colour lives in exactly one place. */
  setAppearance({ wallpaper, borderColor }) {
    if (wallpaper) this.phone.dataset.wallpaper = wallpaper;
    if (borderColor) this.phone.dataset.border = borderColor;
  }

  show() {
    this.phone.removeAttribute("inert");
    // Applying "open" a frame later, rather than immediately, is what
    // makes the slide-up an actual transition rather than an instant
    // jump — the phone needs to render off-screen for one frame first.
    requestAnimationFrame(() => this.phone.classList.add("open"));
    this._focusTrap.activate();
  }

  hide() {
    this.phone.classList.remove("open");
    this._focusTrap.deactivate();
    // inert doesn't need to wait for the slide-down transition to finish —
    // it only affects interactivity/focus, not what's still visually
    // animating off-screen, the same way pointer-events:none already
    // didn't need to wait anywhere else in this codebase.
    this.phone.setAttribute("inert", "");
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
