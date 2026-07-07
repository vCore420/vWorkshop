import { WEATHER_STATES } from "../../systems/WeatherSystem.js";

/**
 * createWindowOverlay
 * ---------------------
 * "Look outside" is where weather is checked and changed. There's no
 * automatic weather simulation yet in this phase (see WeatherSystem.js) —
 * this is a real, if simple, control, not a placeholder.
 */
export function createWindowOverlay({ weatherSystem, timeOfDaySystem }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Outside";
      panelEl.appendChild(heading);

      const timeLine = document.createElement("p");
      const state = timeOfDaySystem.getState();
      const hours = Math.floor(state.currentTime);
      const minutes = Math.floor((state.currentTime - hours) * 60);
      timeLine.textContent = `It's ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}.`;
      panelEl.appendChild(timeLine);

      const row = document.createElement("div");
      row.className = "panel-row";
      row.style.flexWrap = "wrap";
      for (const [id, def] of Object.entries(WEATHER_STATES)) {
        const btn = document.createElement("button");
        btn.textContent = def.label;
        btn.style.fontFamily = "var(--font-mono)";
        btn.style.fontSize = "0.8rem";
        btn.style.padding = "6px 12px";
        btn.style.borderRadius = "999px";
        btn.style.cursor = "pointer";
        btn.style.border = id === weatherSystem.current ? "1px solid var(--brass-bright)" : "1px solid rgba(255,255,255,0.25)";
        btn.style.background = id === weatherSystem.current ? "rgba(184,134,59,0.3)" : "transparent";
        btn.style.color = "inherit";
        btn.addEventListener("click", () => weatherSystem.setWeather(id));
        row.appendChild(btn);
      }
      panelEl.appendChild(row);

      const note = document.createElement("p");
      note.style.fontSize = "0.8rem";
      note.style.color = "var(--paper-dark)";
      note.textContent = "No forecast yet — weather changes when you choose it.";
      panelEl.appendChild(note);

      return null;
    },
  };
}
