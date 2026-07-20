import { WEATHER_STATES } from "../../systems/EnvironmentSystem.js";
import { getObserverLocation, dayOfYear, getSeason } from "../../utils/Astronomy.js";
import { formatClockTime } from "../../utils/TimeFormat.js";

const MODES = [
  ["manual", "Manual"],
  ["live", "Live Weather"],
  ["dynamic", "Workshop Dynamic"],
];

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function windDescription(speed) {
  if (speed < 0.15) return "calm";
  if (speed < 0.35) return "a light breeze";
  if (speed < 0.6) return "a steady wind";
  if (speed < 0.85) return "strong wind";
  return "powerful, gusting wind";
}

function compassLabel(directionRad) {
  const deg = ((directionRad * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * createWindowOverlay
 * ---------------------
 * "The window should become the Workshop's Environment panel" — evolved,
 * not replaced: still opened by looking out a window (see
 * RoomLayoutSystem.js), still the one place weather is viewed and changed,
 * now covering all three of EnvironmentSystem's modes rather than a flat
 * list of three weather buttons.
 *
 * Re-renders itself entirely on every interaction rather than trying to
 * patch individual DOM nodes — this panel is small and opened
 * infrequently, so simplicity was judged more valuable than sparing a
 * few DOM node rebuilds. The one exception is Live Weather's async
 * fetch: a short-lived poll (cleared on close, see the returned disposer)
 * re-renders while a request is in flight, since nothing else would
 * otherwise notice when it resolves.
 *
 * The summary line now quietly names the season too (Season
 * Foundations, Atmosphere phase) — read straight off `Astronomy.getSeason()`,
 * the same pure function anything else that wants to know the season
 * calls, not a value this file computes or owns.
 */
export function createWindowOverlay({ environmentSystem, timeOfDaySystem, settingsStore }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      panelEl.classList.add("environment-panel");
      let pollTimer = null;

      function stopPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
      }

      function pollWhileLoading() {
        stopPolling();
        pollTimer = setInterval(() => {
          render();
          if (environmentSystem.liveStatus !== "loading") stopPolling();
        }, 400);
      }

      function render() {
        panelEl.innerHTML = "";
        const heading = document.createElement("h2");
        heading.textContent = "Outside";
        panelEl.appendChild(heading);

        const state = environmentSystem.getState();
        const weatherDef = WEATHER_STATES[state.current] ?? WEATHER_STATES.clear;
        const timeState = timeOfDaySystem.getState();

        const summary = document.createElement("p");
        summary.className = "environment-summary";
        const season = getSeason(dayOfYear(new Date()), getObserverLocation().latitude);
        const clock = formatClockTime(timeState.currentTime, settingsStore?.get("display").timeFormat);
        summary.textContent = `${weatherDef.label}, ${capitalize(season)} \u2014 ${clock}`;
        panelEl.appendChild(summary);

        const wind = document.createElement("p");
        wind.className = "environment-wind";
        wind.textContent = `Wind: ${windDescription(state.windSpeed)} from the ${compassLabel(state.windDirectionRad)}`;
        panelEl.appendChild(wind);

        const tabs = document.createElement("div");
        tabs.className = "environment-mode-tabs";
        for (const [id, label] of MODES) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          btn.className = id === state.mode ? "active" : "";
          btn.addEventListener("click", () => {
            environmentSystem.setMode(id);
            render();
            if (id === "live") pollWhileLoading();
          });
          tabs.appendChild(btn);
        }
        panelEl.appendChild(tabs);

        if (state.mode === "manual") {
          const grid = document.createElement("div");
          grid.className = "environment-weather-grid";
          for (const [id, def] of Object.entries(WEATHER_STATES)) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = def.label;
            btn.className = id === state.current ? "active" : "";
            btn.addEventListener("click", () => {
              environmentSystem.setWeather(id);
              render();
            });
            grid.appendChild(btn);
          }
          panelEl.appendChild(grid);
        } else if (state.mode === "live") {
          const status = document.createElement("p");
          status.className = "environment-status";
          if (state.liveStatus === "loading") {
            status.textContent = "Checking local weather\u2026";
          } else if (state.liveStatus === "error") {
            status.classList.add("environment-status-error");
            status.textContent = `Couldn't get live weather: ${state.liveError} Using Workshop Dynamic for now.`;
          } else {
            status.textContent = "Matching your local weather. Rechecks automatically every 20 minutes.";
          }
          panelEl.appendChild(status);

          const refreshBtn = document.createElement("button");
          refreshBtn.type = "button";
          refreshBtn.className = "environment-refresh-button";
          refreshBtn.textContent = "Check now";
          refreshBtn.disabled = state.liveStatus === "loading";
          refreshBtn.addEventListener("click", () => {
            environmentSystem.requestLiveWeather();
            render();
            pollWhileLoading();
          });
          panelEl.appendChild(refreshBtn);
        } else {
          const note = document.createElement("p");
          note.className = "environment-note";
          note.textContent = "Weather evolves naturally on its own, and keeps changing even while you're away.";
          panelEl.appendChild(note);
        }
      }

      render();
      if (environmentSystem.liveStatus === "loading") pollWhileLoading();

      return () => stopPolling();
    },
  };
}
