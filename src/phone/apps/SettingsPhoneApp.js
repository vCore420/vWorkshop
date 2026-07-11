/**
 * createSettingsPhoneApp
 * -------------------------
 * A deliberately small subset of the full computer Settings app — the
 * handful of things worth adjusting without walking back to the desk
 * (volume, camera feel), reading and writing the exact same
 * `SettingsStore` the computer's own Settings app already uses. Anything
 * more involved (graphics quality, display, diagnostics) stays exactly
 * where it already is.
 */
export function createSettingsPhoneApp({ settingsStore }) {
  return {
    id: "settings",
    label: "Settings",
    glyph: "\u2699\uFE0F",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Settings";
      container.appendChild(heading);
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "The full settings remain on the Workshop computer.";
      container.appendChild(subtitle);

      const audio = settingsStore.get("audio");
      const controls = settingsStore.get("controls");

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

      function buildSliderRow(label, value, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        const slider = document.createElement("input");
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
