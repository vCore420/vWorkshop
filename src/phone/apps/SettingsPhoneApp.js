import { nextDomId } from "../../utils/domIds.js";
import { iconMarkup } from "../../utils/ProceduralIcons.js";

// Version 4, Phase 3 ("The Phone's Settings, Made Real") — the real tint
// each preset resolves to, matching `css/phone.css`'s own
// `[data-wallpaper="X"] { --phone-wallpaper-tint: ... }` rules exactly, so
// a swatch here is a genuine live preview, not a second, hand-picked
// approximation. Four small, stable values — deliberately kept as an
// explicit, cross-referenced duplication here rather than engineering a
// zero-duplication CSS/JS sharing mechanism for a four-item list; if a
// preset's tint ever changes in `css/phone.css`, update it here too.
const WALLPAPER_PRESETS = [
  { id: "paper", label: "Paper", tint: "color-mix(in srgb, var(--brass) 16%, transparent)" },
  { id: "sage", label: "Sage", tint: "color-mix(in srgb, var(--teal-bright) 18%, transparent)" },
  { id: "glow", label: "Glow", tint: "color-mix(in srgb, var(--screen-glow) 16%, transparent)" },
  { id: "wood", label: "Wood", tint: "color-mix(in srgb, var(--wood-light) 20%, transparent)" },
];
// Same reasoning — matches `css/phone.css`'s own
// `[data-border="X"] { border-color: ...; }` rules (and the base,
// unset-"oak" case, `var(--wood-mid)`) exactly.
const BORDER_PRESETS = [
  { id: "oak", label: "Oak", color: "var(--wood-mid)" },
  { id: "walnut", label: "Walnut", color: "var(--wood-dark)" },
  { id: "brass", label: "Brass", color: "var(--brass)" },
  { id: "teal", label: "Teal", color: "var(--teal)" },
];

/**
 * createSettingsPhoneApp
 * -------------------------
 * A deliberately small subset of the full computer Settings app — the
 * handful of things worth adjusting without walking back to the desk
 * (volume, camera feel, time format, the phone's own wallpaper/border/
 * brightness/theme), reading and writing the exact same `SettingsStore`
 * the computer's own Settings app already uses. Anything more involved
 * (graphics quality, display, diagnostics) stays exactly where it already
 * is — and even here, "display" now means genuinely real brightness and
 * theme, not the PC's own render-quality settings.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — deliberately
 * the plainest app of the wave: sliders/checkboxes/toggle-rows, not a
 * collection or a device to browse. Time Format, Audio, and Camera stay
 * exactly that shape.
 *
 * Version 4, Phase 3 ("The Phone's Settings, Made Real") — "I want this
 * to look more real and less basic drop down boxes and generic UI
 * elements," named specifically against Wallpaper and Border Colour,
 * which is the one place this app stops being purely plain: real colour
 * swatches (`buildWallpaperPicker()`/`buildBorderPicker()`) instead of
 * text-labelled buttons, a genuine light/dark Theme choice (reusing
 * `buildButtonToggleRow()` unchanged — still the same shape as Time
 * Format), and a real Brightness slider that visibly dims the Phone's own
 * rendered screen (`PhoneUI.js`'s own `.workshop-phone-screen`), not a
 * claim about the actual device screen this project has no access to.
 * The one touch every app in the wave already got is unaffected: the same
 * small gear mark (`glyph: "settings"`) next to its own heading.
 */
export function createSettingsPhoneApp({ settingsStore }) {
  return {
    id: "settings",
    label: "Settings",
    glyph: "settings",
    mount(container) {
      const header = document.createElement("div");
      header.className = "workshop-phone-settings-header";
      const headerIcon = document.createElement("span");
      headerIcon.className = "workshop-phone-settings-header-icon";
      headerIcon.innerHTML = iconMarkup("settings");
      headerIcon.setAttribute("aria-hidden", "true");
      const heading = document.createElement("h2");
      heading.textContent = "Settings";
      header.append(headerIcon, heading);
      container.appendChild(header);
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "The full settings remain on the Workshop computer.";
      container.appendChild(subtitle);

      const audio = settingsStore.get("audio");
      const controls = settingsStore.get("controls");
      const display = settingsStore.get("display");

      const phone = settingsStore.get("phone");

      // Version 3, Phase 13 ("The Phone Becomes a Device") — "the same
      // setting, both surfaces": the identical `settingsStore.get("display")
      // .timeFormat` the PC Settings app's own Atmosphere tab and
      // PhoneSystem's status bar both already read.
      const timeSection = document.createElement("div");
      timeSection.className = "workshop-phone-section";
      const timeHeading = document.createElement("h3");
      timeHeading.textContent = "Time";
      timeSection.appendChild(timeHeading);
      timeSection.appendChild(
        buildButtonToggleRow([["24h", "24-hour"], ["12h", "12-hour"]], display.timeFormat, (v) => settingsStore.update("display", { timeFormat: v }))
      );
      container.appendChild(timeSection);

      // "Let a player change the home screen's own wallpaper... and the
      // phone's own border colour" — the same `settingsStore.get("phone")`
      // the PC Settings app's own Phone tab reads and writes; see that
      // file's own comment on why these are curated presets, not a colour
      // picker. Real device customisation happens ON the device at least
      // as often as from a desktop, so this surface gets the controls
      // directly rather than only pointing back to the computer.
      const appearanceSection = document.createElement("div");
      appearanceSection.className = "workshop-phone-section";
      const appearanceHeading = document.createElement("h3");
      appearanceHeading.textContent = "Appearance";
      appearanceSection.appendChild(appearanceHeading);
      const wallpaperLabel = document.createElement("p");
      wallpaperLabel.className = "app-subtitle";
      wallpaperLabel.textContent = "Wallpaper";
      appearanceSection.appendChild(wallpaperLabel);
      appearanceSection.appendChild(buildWallpaperPicker(phone.wallpaper, (v) => settingsStore.update("phone", { wallpaper: v })));
      const borderLabel = document.createElement("p");
      borderLabel.className = "app-subtitle";
      borderLabel.textContent = "Border Colour";
      appearanceSection.appendChild(borderLabel);
      appearanceSection.appendChild(buildBorderPicker(phone.borderColor, (v) => settingsStore.update("phone", { borderColor: v })));
      container.appendChild(appearanceSection);

      // Version 4, Phase 3 ("The Phone's Settings, Made Real") — "real
      // brightness control... a genuine light/dark theme choice." A
      // separate Display section, the same split a real phone's own
      // Settings app draws between "Wallpaper" and "Display." Theme
      // reuses `buildButtonToggleRow()` unchanged — it's the exact same
      // "exactly one of a few named options" shape Time Format above
      // already uses, no new component needed. Brightness reuses
      // `buildSliderRow()`, given a 0.3–1 range instead of its own
      // default 0–1 — a real phone's own minimum brightness still shows
      // something, it doesn't go fully black.
      const displaySection = document.createElement("div");
      displaySection.className = "workshop-phone-section";
      const displayHeading = document.createElement("h3");
      displayHeading.textContent = "Display";
      displaySection.appendChild(displayHeading);
      const themeLabel = document.createElement("p");
      themeLabel.className = "app-subtitle";
      themeLabel.textContent = "Theme";
      displaySection.appendChild(themeLabel);
      displaySection.appendChild(
        buildButtonToggleRow([["light", "☀️ Light"], ["dark", "\u{1F319} Dark"]], phone.theme, (v) => settingsStore.update("phone", { theme: v }))
      );
      displaySection.appendChild(
        buildSliderRow("Brightness", phone.brightness, (v) => settingsStore.update("phone", { brightness: v }), { min: 0.3, max: 1 })
      );
      container.appendChild(displaySection);

      const audioSection = document.createElement("div");
      audioSection.className = "workshop-phone-section";
      const audioHeading = document.createElement("h3");
      audioHeading.textContent = "Audio";
      audioSection.appendChild(audioHeading);
      audioSection.appendChild(buildSliderRow("Master Volume", audio.masterVolume, (v) => settingsStore.update("audio", { masterVolume: v })));
      container.appendChild(audioSection);

      const cameraSection = document.createElement("div");
      cameraSection.className = "workshop-phone-section";
      const cameraHeading = document.createElement("h3");
      cameraHeading.textContent = "Camera";
      cameraSection.appendChild(cameraHeading);
      cameraSection.appendChild(buildSliderRow("Sensitivity", controls.mouseSensitivity / 3, (v) => settingsStore.update("controls", { mouseSensitivity: v * 3 })));

      const invertRow = document.createElement("div");
      invertRow.className = "panel-row";
      const invertLabel = document.createElement("label");
      const invertCheckbox = document.createElement("input");
      invertCheckbox.type = "checkbox";
      invertCheckbox.checked = controls.invertLook;
      invertCheckbox.addEventListener("change", () => settingsStore.update("controls", { invertLook: invertCheckbox.checked }));
      invertLabel.append(invertCheckbox, " Invert Vertical");
      invertRow.appendChild(invertLabel);
      cameraSection.appendChild(invertRow);
      container.appendChild(cameraSection);

      /** A row of small buttons, exactly one ever `.active`, matching the
       *  same "already-active glyph/text is the state" convention every
       *  other Phone app's own multi-choice row already uses (Workshop's
       *  weather/lighting buttons, say). Used here for both Time Format
       *  and the two Appearance rows rather than a `<select>`, which
       *  would be the odd one out on a screen that's otherwise entirely
       *  tap-targets. */
      function buildButtonToggleRow(options, currentValue, onChange) {
        const row = document.createElement("div");
        row.className = "workshop-phone-button-row";
        for (const [value, label] of options) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "workshop-phone-small-button" + (currentValue === value ? " active" : "");
          btn.textContent = label;
          btn.setAttribute("aria-pressed", String(currentValue === value));
          btn.addEventListener("click", () => {
            onChange(value);
            for (const other of row.children) {
              other.classList.toggle("active", other === btn);
              other.setAttribute("aria-pressed", String(other === btn));
            }
          });
          row.appendChild(btn);
        }
        return row;
      }

      // Version 4, Phase 3 — gained an optional `{min, max}` (still
      // defaulting to the original 0–1 every existing caller here relies
      // on) so Brightness's own 0.3–1 floor didn't need a second,
      // near-identical slider builder just for one different range.
      function buildSliderRow(label, value, onChange, { min = 0, max = 1 } = {}) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const id = nextDomId("phone-settings-slider");
        const labelEl = document.createElement("label");
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        const slider = document.createElement("input");
        slider.id = id;
        slider.type = "range";
        slider.min = String(min);
        slider.max = String(max);
        slider.step = "0.05";
        slider.value = String(value);
        slider.addEventListener("input", () => onChange(parseFloat(slider.value)));
        row.append(labelEl, slider);
        return row;
      }

      /** Version 4, Phase 3 — "live wallpaper previews instead of a
       *  generic dropdown." Each swatch renders the *actual* gradient
       *  formula `css/phone.css`'s own `.workshop-phone-content` rule
       *  uses (`WALLPAPER_PRESETS`' own tint values, cross-referenced
       *  with that file), read through the same live `--phone-base-1`/
       *  `--phone-base-2` custom properties the real background does —
       *  so a swatch already reflects whichever theme is currently
       *  active, without this function needing to know light from dark
       *  itself. Same active-state convention `buildButtonToggleRow()`
       *  already establishes, just with a real colour chip instead of
       *  plain text. */
      function buildWallpaperPicker(currentValue, onChange) {
        const row = document.createElement("div");
        row.className = "workshop-phone-wallpaper-picker";
        for (const preset of WALLPAPER_PRESETS) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "workshop-phone-wallpaper-swatch" + (currentValue === preset.id ? " active" : "");
          btn.setAttribute("aria-pressed", String(currentValue === preset.id));
          btn.setAttribute("aria-label", preset.label);
          const chip = document.createElement("span");
          chip.className = "workshop-phone-wallpaper-swatch-chip";
          chip.style.background = `radial-gradient(ellipse at 50% -10%, ${preset.tint}, transparent 60%), linear-gradient(180deg, var(--phone-base-1) 0%, var(--phone-base-2) 100%)`;
          const label = document.createElement("span");
          label.className = "workshop-phone-wallpaper-swatch-label";
          label.textContent = preset.label;
          btn.append(chip, label);
          btn.addEventListener("click", () => {
            onChange(preset.id);
            for (const other of row.children) {
              other.classList.toggle("active", other === btn);
              other.setAttribute("aria-pressed", String(other === btn));
            }
          });
          row.appendChild(btn);
        }
        return row;
      }

      /** Same live-preview idea as the wallpaper picker above, reusing
       *  `.workshop-phone-swatch` — the existing circular colour-chip
       *  component Wardrobe's own outfit list already uses — rather than
       *  a second, bespoke swatch style just for this row. */
      function buildBorderPicker(currentValue, onChange) {
        const row = document.createElement("div");
        row.className = "workshop-phone-border-picker";
        for (const preset of BORDER_PRESETS) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "workshop-phone-border-swatch-button" + (currentValue === preset.id ? " active" : "");
          btn.setAttribute("aria-pressed", String(currentValue === preset.id));
          btn.setAttribute("aria-label", preset.label);
          const swatch = document.createElement("span");
          swatch.className = "workshop-phone-swatch workshop-phone-border-swatch";
          swatch.style.background = preset.color;
          const label = document.createElement("span");
          label.textContent = preset.label;
          btn.append(swatch, label);
          btn.addEventListener("click", () => {
            onChange(preset.id);
            for (const other of row.children) {
              other.classList.toggle("active", other === btn);
              other.setAttribute("aria-pressed", String(other === btn));
            }
          });
          row.appendChild(btn);
        }
        return row;
      }

      return null;
    },
  };
}
