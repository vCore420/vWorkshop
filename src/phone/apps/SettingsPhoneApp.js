import { nextDomId } from "../../utils/domIds.js";
import { iconMarkup } from "../../utils/ProceduralIcons.js";

/**
 * createSettingsPhoneApp
 * -------------------------
 * A deliberately small subset of the full computer Settings app — the
 * handful of things worth adjusting without walking back to the desk
 * (volume, camera feel, time format, the phone's own wallpaper/border),
 * reading and writing the exact same `SettingsStore` the computer's own
 * Settings app already uses. Anything more involved (graphics quality,
 * display, diagnostics) stays exactly where it already is.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — deliberately
 * the plainest app of the wave. Its content is a panel of values to
 * adjust, not a collection, a companion, or a device to browse, so
 * sliders/checkboxes/toggle-rows stay exactly as they were rather than
 * becoming cards or tiles; the one touch is the same small gear mark
 * (`glyph: "settings"`) next to its own heading every other app's own
 * identity-defining mark already gets, kept to that and nothing more.
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
      appearanceSection.appendChild(
        buildButtonToggleRow([["paper", "Paper"], ["sage", "Sage"], ["glow", "Glow"], ["wood", "Wood"]], phone.wallpaper, (v) => settingsStore.update("phone", { wallpaper: v }))
      );
      const borderLabel = document.createElement("p");
      borderLabel.className = "app-subtitle";
      borderLabel.textContent = "Border Colour";
      appearanceSection.appendChild(borderLabel);
      appearanceSection.appendChild(
        buildButtonToggleRow([["oak", "Oak"], ["walnut", "Walnut"], ["brass", "Brass"], ["teal", "Teal"]], phone.borderColor, (v) => settingsStore.update("phone", { borderColor: v }))
      );
      container.appendChild(appearanceSection);

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

      function buildSliderRow(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const id = nextDomId("phone-settings-slider");
        const labelEl = document.createElement("label");
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        const slider = document.createElement("input");
        slider.id = id;
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.05";
        slider.value = String(value);
        slider.addEventListener("input", () => onChange(parseFloat(slider.value)));
        row.append(labelEl, slider);
        return row;
      }

      return null;
    },
  };
}
