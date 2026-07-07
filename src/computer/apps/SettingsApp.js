/**
 * createSettingsApp
 * -------------------
 * The one deliberate exception to "no traditional settings menu" — and
 * even this lives inside the computer object, not floating over the scene.
 * Kept intentionally small: room lighting and the clock mode are the only
 * two things worth a toggle right now.
 */
export function createSettingsApp({ lightingSystem, timeOfDaySystem, weatherSystem }) {
  return {
    id: "settings",
    label: "Settings",
    glyph: "\u2699",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Settings";

      const lightRow = document.createElement("div");
      lightRow.className = "panel-row";
      const lightLabel = document.createElement("label");
      lightLabel.style.width = "auto";
      const lightCheckbox = document.createElement("input");
      lightCheckbox.type = "checkbox";
      lightCheckbox.checked = lightingSystem.lightsOn;
      lightCheckbox.addEventListener("change", () => lightingSystem.setLightsOn(lightCheckbox.checked));
      lightLabel.append(lightCheckbox, " Workshop lights on");
      lightRow.appendChild(lightLabel);

      const timeRow = document.createElement("div");
      timeRow.className = "panel-row";
      const timeLabel = document.createElement("label");
      timeLabel.style.width = "auto";
      timeLabel.textContent = "Clock: ";
      const timeSelect = document.createElement("select");
      for (const [value, label] of [["realtime", "follow real time"], ["simulated", "simulated cycle"]]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (timeOfDaySystem.mode === value) opt.selected = true;
        timeSelect.appendChild(opt);
      }
      timeSelect.addEventListener("change", () => timeOfDaySystem.setMode(timeSelect.value));
      timeLabel.appendChild(timeSelect);
      timeRow.appendChild(timeLabel);

      const weatherRow = document.createElement("p");
      weatherRow.className = "app-subtitle";
      weatherRow.textContent = `Current weather: ${weatherSystem.current} \u2014 change it by looking out a window.`;

      container.append(heading, lightRow, timeRow, weatherRow);
      return null;
    },
  };
}
