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
 */
export class PhoneUI {
  constructor(rootEl, callbacks) {
    this.root = rootEl;
    this.callbacks = callbacks;

    this.phone = document.createElement("div");
    this.phone.className = "workshop-phone";
    this.root.appendChild(this.phone);

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

    this.root.classList.add("hidden");
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

  setTitle(title) {
    this.titleEl.textContent = title;
    this.homeBtn.style.visibility = title === "Workshop" ? "hidden" : "visible";
  }

  /** "Display applications as a simple grid of icons... the design
   *  should remain minimal, clear, readable, comfortable." Every icon is
   *  a plain button — an emoji glyph and a label, nothing trying to look
   *  like Android or iOS. */
  showHome(apps) {
    this.setTitle("Workshop");
    this.content.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "workshop-phone-home-grid";
    for (const app of apps) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "workshop-phone-app-tile";
      const glyph = document.createElement("span");
      glyph.className = "workshop-phone-app-glyph";
      glyph.textContent = app.glyph ?? "\u25A1";
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
    this.setTitle(title);
    this.content.innerHTML = "";
    return this.content;
  }
}
