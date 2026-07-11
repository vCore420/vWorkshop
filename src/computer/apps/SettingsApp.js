/**
 * createSettingsApp
 * -------------------
 * The Workshop's one central place to configure itself — "rather than
 * using browser menus or hidden developer settings." Everything here
 * writes straight to `SettingsStore` (`store.update(category, patch)`),
 * which persists automatically and is applied by `SettingsSystem` — this
 * file only ever builds the form and reads back the current values; it
 * has no idea what a setting actually *does*. See docs/PERFORMANCE.md for
 * what each one does and why the ranges are what they are.
 *
 * The room lighting / clock-mode / weather controls that used to live in
 * "General" now live in "Atmosphere" instead — "the central place for
 * understanding and controlling the Workshop's environmental
 * simulation" — alongside a full, live read-out of the same environment
 * the 3D scene itself renders (see renderAtmosphere()'s own comment).
 */
import { WEATHER_STATES } from "../../systems/EnvironmentSystem.js";
import { getObserverLocation, solarPosition, moonPhaseFraction, moonIllumination, sunriseSunset, moonriseMoonset, dayOfYear } from "../../utils/Astronomy.js";

function formatClockTime(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const COMPASS_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** A wind/sun direction in radians (0 = north, clockwise) to a plain
 *  compass label — the same eight-point compass CompassSystem.js already
 *  shows in the 3D world, just as text here. */
function compassLabel(radians) {
  const normalized = ((radians % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI / 4)) % 8;
  return COMPASS_LABELS[index];
}

const MOON_PHASE_NAMES = [
  [0.02, "New Moon"],
  [0.24, "Waxing Crescent"],
  [0.26, "First Quarter"],
  [0.49, "Waxing Gibbous"],
  [0.51, "Full Moon"],
  [0.74, "Waning Gibbous"],
  [0.76, "Last Quarter"],
  [0.98, "Waning Crescent"],
  [1.01, "New Moon"],
];
/** A 0-1 phase fraction (see Astronomy.js's own moonPhaseFraction()) to
 *  the plain name for whichever of the eight traditional phases it falls
 *  nearest to. */
function moonPhaseName(fraction) {
  for (const [threshold, name] of MOON_PHASE_NAMES) {
    if (fraction <= threshold) return name;
  }
  return "New Moon";
}

function sectionHeading(text) {
  const h = document.createElement("h3");
  h.textContent = text;
  h.style.marginTop = "18px";
  return h;
}

/** A plain, read-only label/value row — Atmosphere's and Diagnostics'
 *  own equivalent of `buildCheckboxRow`/`buildSelectRow` for values
 *  there's nothing to edit, just something to show clearly. */
function infoRow(labelText, valueText) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const value = document.createElement("span");
  value.className = "settings-info-value";
  value.textContent = valueText;
  row.append(label, value);
  return row;
}

/** A checkbox ("override this or follow the preset") plus a 0-1 slider,
 *  shared by every manual-override control in the Atmosphere tab —
 *  `currentValue` is `null` when not overridden, a 0-1 number otherwise;
 *  `onChange(value | null)` is called with `null` the moment the
 *  checkbox is unchecked, handing control back to whatever the current
 *  weather preset (or, for Moon Phase, the real calendar date) would
 *  otherwise provide. */
function overrideSliderRow(labelText, currentValue, onChange) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const label = document.createElement("label");
  label.textContent = labelText;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = currentValue !== null;
  checkbox.title = "Override";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.02";
  slider.value = String(currentValue ?? 0.5);
  slider.disabled = currentValue === null;

  const valueEl = document.createElement("span");
  valueEl.className = "settings-range-value";
  valueEl.textContent = currentValue === null ? "auto" : `${Math.round(currentValue * 100)}%`;

  checkbox.addEventListener("change", () => {
    slider.disabled = !checkbox.checked;
    if (checkbox.checked) {
      onChange(parseFloat(slider.value));
      valueEl.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
    } else {
      onChange(null);
      valueEl.textContent = "auto";
    }
  });
  slider.addEventListener("input", () => {
    valueEl.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
    if (checkbox.checked) onChange(parseFloat(slider.value));
  });

  row.append(label, checkbox, slider, valueEl);
  return row;
}

export function createSettingsApp({ settingsStore, lightingSystem, timeOfDaySystem, environmentSystem, musicSystem, dangerZoneActions, aiConnectionManager, residentProfileStore, residentBehaviour, cameraSystem, interiorSystem, hostManager }) {
  const engine = musicSystem.engine; // same trick MediaApp.js uses — avoids a dedicated engine dependency just for this

  const TABS = [
    { id: "general", label: "General" },
    { id: "atmosphere", label: "Atmosphere" },
    { id: "graphics", label: "Graphics" },
    { id: "performance", label: "Performance" },
    { id: "display", label: "Display" },
    { id: "controls", label: "Controls" },
    { id: "audio", label: "Audio" },
    { id: "diagnostics", label: "Diagnostics" },
    { id: "danger", label: "Danger Zone" },
  ];

  return {
    id: "settings",
    label: "Settings",
    glyph: "\u2699",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Settings";
      container.appendChild(heading);

      const tabBar = document.createElement("div");
      tabBar.className = "settings-tab-bar";
      const tabButtons = new Map();
      for (const tab of TABS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = tab.label;
        btn.addEventListener("click", () => setTab(tab.id));
        tabButtons.set(tab.id, btn);
        tabBar.appendChild(btn);
      }
      container.appendChild(tabBar);

      const body = document.createElement("div");
      body.className = "settings-tab-body";
      container.appendChild(body);

      let currentTab = "general";
      let disposeCurrentTab = null;

      function setTab(id) {
        currentTab = id;
        for (const [tabId, btn] of tabButtons) btn.classList.toggle("active", tabId === id);
        disposeCurrentTab?.();
        disposeCurrentTab = null;
        body.innerHTML = "";
        const render = { general: renderGeneral, atmosphere: renderAtmosphere, graphics: renderGraphics, performance: renderPerformance, display: renderDisplay, controls: renderControls, audio: renderAudio, diagnostics: renderDiagnostics, danger: renderDangerZone }[id];
        disposeCurrentTab = render(body);
      }

      function renderGeneral(el) {
        const lightRow = buildCheckboxRow("Workshop lights on", lightingSystem.lightsOn, (checked) => lightingSystem.setLightsOn(checked));
        el.appendChild(lightRow);
        const hint = document.createElement("p");
        hint.className = "app-subtitle";
        hint.textContent = "Weather, time, and everything else about the Workshop's own environment now lives in the Atmosphere tab.";
        el.appendChild(hint);
        return null;
      }

      /** "This should become the central place for understanding and
       *  controlling the Workshop's environmental simulation." Everything
       *  here reads live off the same systems the 3D scene itself already
       *  reads from (TimeOfDaySystem, EnvironmentSystem, Astronomy.js) —
       *  nothing is a separate snapshot or copy, so this tab can never
       *  drift out of sync with what the sky actually looks like right
       *  now. The time-mode/set-time controls used to live in General;
       *  they moved here rather than being duplicated, since this is now
       *  unambiguously "the" place for the Workshop's own environment. */
      function renderAtmosphere(el) {
        const now = new Date();
        const location = getObserverLocation();
        const doy = dayOfYear(now);
        const sun = solarPosition(timeOfDaySystem.currentTime, location.latitude, doy);
        const sunTimes = sunriseSunset(location.latitude, doy);
        const phaseFrac = moonPhaseFraction(now);
        const illum = moonIllumination(phaseFrac);
        const moonTimes = moonriseMoonset(location.latitude, doy, phaseFrac);
        const starsVisible = sun.altitude < -2; // roughly matches TimeOfDaySystem's own soft star-visibility threshold

        el.appendChild(sectionHeading("Weather"));
        el.appendChild(
          buildSelectRow(
            "Mode",
            environmentSystem.mode,
            [["manual", "Manual"], ["live", "Live Weather"], ["dynamic", "Workshop Dynamic"]],
            (value) => environmentSystem.setMode(value)
          )
        );
        el.appendChild(
          buildSelectRow(
            "Current weather",
            environmentSystem.current,
            Object.entries(WEATHER_STATES).map(([id, def]) => [id, def.label]),
            (value) => environmentSystem.setWeather(value)
          )
        );
        if (environmentSystem.mode === "live" && environmentSystem.liveError) {
          const err = document.createElement("p");
          err.className = "app-subtitle";
          err.textContent = `Live weather unavailable right now: ${environmentSystem.liveError}`;
          el.appendChild(err);
        }
        el.appendChild(infoRow("Wind", `${Math.round(environmentSystem.windSpeed * 60)} km/h, from ${compassLabel(environmentSystem.windDirectionRad)}`));
        el.appendChild(infoRow("Temperature", environmentSystem.temperatureC !== null ? `${Math.round(environmentSystem.temperatureC)}\u00b0C` : "Not available \u2014 switch to Live Weather"));

        el.appendChild(sectionHeading("Manual Overrides"));
        const overrideHint = document.createElement("p");
        overrideHint.className = "app-subtitle";
        overrideHint.textContent = "Pulls a single property away from whatever the current weather preset would otherwise give it. Set one back to \u201cFollow weather\u201d to let the preset take over again.";
        el.appendChild(overrideHint);
        el.appendChild(overrideSliderRow("Clouds", environmentSystem.manualOverrides.cloudCoverage, (v) => environmentSystem.setManualOverride("cloudCoverage", v)));
        el.appendChild(overrideSliderRow("Rain", environmentSystem.manualOverrides.precipitation, (v) => environmentSystem.setManualOverride("precipitation", v)));
        el.appendChild(overrideSliderRow("Fog", environmentSystem.manualOverrides.fogDensity, (v) => environmentSystem.setManualOverride("fogDensity", v)));
        el.appendChild(overrideSliderRow("Wind", environmentSystem.manualOverrides.windSpeed, (v) => environmentSystem.setManualOverride("windSpeed", v)));

        el.appendChild(sectionHeading("Location"));
        el.appendChild(infoRow("Current location", `${location.latitude.toFixed(2)}\u00b0, ${location.longitude.toFixed(2)}\u00b0 ${location.isReal ? "" : "(default \u2014 location not shared)"}`));

        el.appendChild(sectionHeading("Date & Time"));
        el.appendChild(infoRow("Current date", now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })));
        el.appendChild(infoRow("Current time", formatClockTime(timeOfDaySystem.currentTime)));
        el.appendChild(
          buildSelectRow(
            "Clock",
            timeOfDaySystem.mode,
            [["realtime", "Follow real time"], ["simulated", "Simulated cycle"]],
            (value) => timeOfDaySystem.setMode(value)
          )
        );
        const setTimeRow = document.createElement("div");
        setTimeRow.className = "panel-row";
        const setTimeLabel = document.createElement("label");
        setTimeLabel.textContent = "Set time";
        const setTimeInput = document.createElement("input");
        setTimeInput.type = "range";
        setTimeInput.min = "0";
        setTimeInput.max = "23.75";
        setTimeInput.step = "0.25";
        setTimeInput.value = String(timeOfDaySystem.currentTime);
        const setTimeValue = document.createElement("span");
        setTimeValue.className = "settings-range-value";
        setTimeValue.textContent = formatClockTime(timeOfDaySystem.currentTime);
        setTimeInput.addEventListener("input", () => {
          setTimeValue.textContent = formatClockTime(parseFloat(setTimeInput.value));
        });
        // Deliberately "change" (on release), not "input" (continuous,
        // while dragging) — setTime() starts a fresh easing transition on
        // every call (see TimeOfDaySystem.js), which would restart
        // jarringly on every pixel of drag if it fired that often.
        setTimeInput.addEventListener("change", () => {
          timeOfDaySystem.setTime(parseFloat(setTimeInput.value));
        });
        setTimeRow.append(setTimeLabel, setTimeInput, setTimeValue);
        el.appendChild(setTimeRow);
        const setTimeHint = document.createElement("p");
        setTimeHint.className = "app-subtitle";
        setTimeHint.textContent = "Eases there gradually rather than jumping — the sun and moon actually move to their new positions.";
        el.appendChild(setTimeHint);

        el.appendChild(sectionHeading("Sun"));
        el.appendChild(infoRow("Sunrise", sunTimes.rise !== null ? formatClockTime(sunTimes.rise) : "Doesn't rise today"));
        el.appendChild(infoRow("Sunset", sunTimes.set !== null ? formatClockTime(sunTimes.set) : "Doesn't set today"));
        const sunHint = document.createElement("p");
        sunHint.className = "app-subtitle";
        sunHint.textContent = "The sun's own position already follows Set Time above \u2014 there's nothing separate to override here.";
        el.appendChild(sunHint);

        el.appendChild(sectionHeading("Moon"));
        el.appendChild(infoRow("Phase", `${moonPhaseName(phaseFrac)} \u2014 ${Math.round(illum * 100)}% illuminated`));
        el.appendChild(infoRow("Moonrise", moonTimes.rise !== null ? formatClockTime(moonTimes.rise) : "Doesn't rise today"));
        el.appendChild(infoRow("Moonset", moonTimes.set !== null ? formatClockTime(moonTimes.set) : "Doesn't set today"));
        el.appendChild(overrideSliderRow("Moon Phase", timeOfDaySystem.moonPhaseOverride, (v) => timeOfDaySystem.setMoonPhaseOverride(v)));

        el.appendChild(sectionHeading("Stars"));
        el.appendChild(infoRow("Visibility", starsVisible ? "Visible \u2014 the sky is dark enough" : "Not visible \u2014 too much daylight"));
        const starsHint = document.createElement("p");
        starsHint.className = "app-subtitle";
        starsHint.textContent = "Star visibility already follows Set Time above (how dark the sky currently is) \u2014 nothing separate to override here either.";
        el.appendChild(starsHint);

        return null;
      }

      function renderGraphics(el) {
        const g = settingsStore.get("graphics");
        const patch = (fields) => settingsStore.update("graphics", fields);

        el.appendChild(buildSelectRow("Render Distance", String(g.renderDistance), [
          ["55", "Short"], ["100", "Medium"], ["160", "Long"], ["200", "Maximum"],
        ], (v) => patch({ renderDistance: Number(v) })));

        el.appendChild(buildSelectRow("Shadow Quality", g.shadowQuality, [
          ["off", "Off"], ["low", "Low"], ["medium", "Medium"], ["high", "High"],
        ], (v) => patch({ shadowQuality: v })));

        el.appendChild(buildSelectRow("Lighting Quality", g.lightingQuality, [
          ["low", "Low"], ["medium", "Medium"], ["high", "High"],
        ], (v) => patch({ lightingQuality: v })));

        el.appendChild(buildCheckboxRow("Anti-aliasing", g.antialiasing, (checked) => patch({ antialiasing: checked })));

        el.appendChild(buildSelectRow("Frame Rate Limit", String(g.frameRateLimit), [
          ["0", "Uncapped"], ["30", "30 fps"], ["60", "60 fps"], ["120", "120 fps"],
        ], (v) => patch({ frameRateLimit: Number(v) })));

        const note = document.createElement("p");
        note.className = "app-subtitle";
        note.textContent = "Changing Anti-aliasing briefly rebuilds the renderer — everything else applies instantly.";
        el.appendChild(note);
        return null;
      }

      function renderPerformance(el) {
        const presetRow = document.createElement("div");
        presetRow.className = "panel-row";
        const presetLabel = document.createElement("label");
        presetLabel.textContent = "Preset";
        const presetSelect = document.createElement("select");
        for (const [value, label] of [["performance", "Performance"], ["balanced", "Balanced"], ["quality", "Quality"], ["custom", "Custom"]]) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          if (value === "custom") opt.disabled = true; // reached by adjusting individual graphics settings, not chosen directly
          presetSelect.appendChild(opt);
        }
        presetSelect.value = settingsStore.get("performance").preset;
        presetSelect.addEventListener("change", () => settingsStore.applyPreset(presetSelect.value));
        presetRow.append(presetLabel, presetSelect);
        el.appendChild(presetRow);

        const detectBtn = document.createElement("button");
        detectBtn.type = "button";
        detectBtn.className = "settings-action-button";
        detectBtn.textContent = "Optimise For This Device";
        detectBtn.addEventListener("click", () => {
          const recommended = settingsStore.detectRecommendedPreset();
          settingsStore.applyPreset(recommended);
          presetSelect.value = recommended;
        });
        el.appendChild(detectBtn);

        const detectNote = document.createElement("p");
        detectNote.className = "app-subtitle";
        detectNote.textContent = "A quick, honest guess based on this device's general capability — not a real benchmark.";
        el.appendChild(detectNote);

        const feedbackHeading = document.createElement("h3");
        feedbackHeading.textContent = "Performance";
        el.appendChild(feedbackHeading);

        const feedback = document.createElement("div");
        feedback.className = "settings-performance-feedback";
        el.appendChild(feedback);

        const renderFeedback = ({ fps } = {}) => {
          const preset = settingsStore.get("performance").preset;
          const presetLabelText = { performance: "Performance", balanced: "Balanced", quality: "Quality", custom: "Custom" }[preset] ?? preset;
          const rounded = fps ? Math.round(fps) : null;
          const quality = rounded == null ? "\u2014" : rounded >= 50 ? "Smooth" : rounded >= 30 ? "Good" : rounded >= 15 ? "Reduced" : "Struggling";
          feedback.innerHTML = "";
          feedback.appendChild(buildFeedbackRow("Current performance", quality));
          feedback.appendChild(buildFeedbackRow("Current graphics preset", presetLabelText));
          feedback.appendChild(buildFeedbackRow("Approximate FPS", rounded == null ? "measuring\u2026" : String(rounded)));
        };
        renderFeedback();

        const offSample = engine.events.on("engine:performanceSample", renderFeedback);
        const offPresetChange = settingsStore.events.on("settings:changed", () => renderFeedback());
        return () => {
          offSample();
          offPresetChange();
        };
      }

      function renderDisplay(el) {
        const d = settingsStore.get("display");
        const patch = (fields) => settingsStore.update("display", fields);
        el.appendChild(buildRangeRow("Field of View", d.fov, 50, 90, 1, "\u00b0", (v) => patch({ fov: v })));
        el.appendChild(buildRangeRow("UI Scale", d.uiScale, 0.8, 1.3, 0.05, "\u00d7", (v) => patch({ uiScale: v }), 2));
        return null;
      }

      function renderControls(el) {
        const c = settingsStore.get("controls");
        const patch = (fields) => settingsStore.update("controls", fields);
        el.appendChild(sectionHeading("Camera"));
        // "Add third-person camera options to the Workshop Control
        // Settings. Examples include: Invert Vertical, Camera
        // Sensitivity, Future camera preferences." Mouse/Touch
        // Sensitivity already cover "Camera Sensitivity" in practice —
        // they're exactly what governs how fast the camera turns, in
        // both first- and third-person — and InputManager.js already
        // applies invertLook directly to lookDelta.y itself, so no new
        // wiring was needed here, just grouping these clearly as the
        // Workshop's own camera preferences and naming the checkbox to
        // match the brief's own term.
        el.appendChild(buildRangeRow("Camera Sensitivity", c.mouseSensitivity, 0.2, 3, 0.1, "\u00d7", (v) => patch({ mouseSensitivity: v }), 1));
        el.appendChild(buildRangeRow("Touch Sensitivity", c.touchSensitivity, 0.2, 3, 0.1, "\u00d7", (v) => patch({ touchSensitivity: v }), 1));
        el.appendChild(buildCheckboxRow("Invert Vertical", c.invertLook, (checked) => patch({ invertLook: checked })));
        return null;
      }

      function renderAudio(el) {
        const a = settingsStore.get("audio");
        const patch = (fields) => settingsStore.update("audio", fields);
        el.appendChild(buildRangeRow("Master Volume", a.masterVolume, 0, 1, 0.01, "%", (v) => patch({ masterVolume: v }), 0, true));
        el.appendChild(buildRangeRow("Music Volume", a.musicVolume, 0, 1, 0.01, "%", (v) => patch({ musicVolume: v }), 0, true));
        el.appendChild(buildRangeRow("Effects Volume", a.effectsVolume, 0, 1, 0.01, "%", (v) => patch({ effectsVolume: v }), 0, true));
        el.appendChild(buildRangeRow("Ambient Volume", a.ambientVolume, 0, 1, 0.01, "%", (v) => patch({ ambientVolume: v }), 0, true));

        const note = document.createElement("p");
        note.className = "app-subtitle";
        note.textContent = "Music Volume sits on top of the player's own volume slider, the same way a device's system volume sits on top of an app's — turning either down turns the music down.";
        el.appendChild(note);
        return null;
      }

      /** "Not intended to be a developer console... a lightweight status
       *  page for understanding the Workshop's current state." Every row
       *  reads straight from whichever system already owns that fact —
       *  FPS from Engine's own performance sampling, weather from
       *  EnvironmentSystem, resident status from ResidentBehaviour/
       *  ResidentConnection — nothing here is a second copy of anything,
       *  the same "app renders a store, doesn't duplicate it" shape every
       *  other Workshop app already follows. */
      function renderDiagnostics(el) {
        const perf = document.createElement("div");
        el.appendChild(sectionHeading("Performance"));
        el.appendChild(perf);

        el.appendChild(sectionHeading("Environment"));
        const envState = WEATHER_STATES[environmentSystem.current]?.label ?? environmentSystem.current;
        el.appendChild(infoRow("Current weather", envState));
        el.appendChild(infoRow("Time & date", `${formatClockTime(timeOfDaySystem.currentTime)} \u00b7 ${new Date().toLocaleDateString()}`));
        el.appendChild(infoRow("Shadow quality", capitalize(lightingSystem.getShadowQuality())));

        el.appendChild(sectionHeading("Player"));
        const pos = cameraSystem?.position;
        el.appendChild(infoRow("Player position", pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}` : "Unavailable"));
        el.appendChild(infoRow("Current interior", interiorSystem?.isInside(pos) ? "Indoors" : "Outdoors"));

        el.appendChild(sectionHeading("Resident"));
        const activeProfile = residentProfileStore?.getActive();
        el.appendChild(infoRow("Resident status", residentBehaviour ? (aiConnectionManager?.status === "connected" ? "Awake" : "Sleeping \u2014 waiting for Ollama") : "Unavailable"));
        el.appendChild(infoRow("Active profile", activeProfile?.name ?? "None"));

        el.appendChild(sectionHeading("Connections"));
        const hostStatus = hostManager?.getOverviewStatus();
        el.appendChild(infoRow("Workshop Platform status", hostStatus ? `Running \u00b7 v${hostStatus.version} \u00b7 ${hostStatus.availableCapabilities.length} capabilities available` : "Unavailable"));
        el.appendChild(infoRow("Ollama connection", { connected: "Connected", connecting: "Connecting\u2026", disconnected: "Waiting for Ollama\u2026" }[aiConnectionManager?.status] ?? "Unavailable"));

        const renderPerf = ({ fps, frameTimeMs } = {}) => {
          perf.innerHTML = "";
          perf.appendChild(infoRow("FPS", fps ? String(Math.round(fps)) : "measuring\u2026"));
          perf.appendChild(infoRow("Frame time", frameTimeMs ? `${frameTimeMs.toFixed(1)} ms` : "measuring\u2026"));
        };
        renderPerf();
        const offSample = engine.events.on("engine:performanceSample", renderPerf);
        return () => offSample();
      }

      function capitalize(text) {
        return typeof text === "string" && text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
      }

      function renderDangerZone(el) {
        const intro = document.createElement("p");
        intro.className = "app-subtitle";
        intro.textContent = "Maintenance actions for the Workshop itself. Everything below asks you to confirm before doing anything — nothing here happens by accident.";
        el.appendChild(intro);

        el.appendChild(
          buildDangerRow(
            "Clear Workshop Cache",
            "Forces a fresh download of the Workshop next time it loads. Doesn't touch anything you've made or saved.",
            "Clear the Workshop's cached files? Nothing you've made or saved will be affected \u2014 this only forces a fresh copy of the Workshop itself to be downloaded next time it loads.",
            async () => dangerZoneActions.clearCache()
          )
        );

        el.appendChild(
          buildDangerRow(
            "Reset Workshop Settings",
            "Graphics, Performance, Display, Controls, and Audio all back to their defaults.",
            "Reset all Workshop settings to their defaults? This won't affect your projects, notes, music library, outfits, or anything else you've made.",
            () => dangerZoneActions.resetSettings()
          )
        );

        el.appendChild(
          buildDangerRow(
            "Reset Player Data",
            "Your character back to the default appearance, and every saved outfit deleted.",
            "Reset your character to the default appearance and delete every saved outfit? This can't be undone.",
            async () => dangerZoneActions.resetPlayerData(),
            true
          )
        );

        const factoryHeading = document.createElement("h2");
        factoryHeading.textContent = "Factory Reset";
        el.appendChild(factoryHeading);
        el.appendChild(
          buildDangerRow(
            "Factory Reset Workshop",
            "Deletes absolutely everything \u2014 every project, note, outfit, your music library and playlists, every object you've built, and every setting \u2014 and returns the Workshop to a completely fresh first-launch state. This cannot be undone.",
            "This will permanently delete EVERYTHING: every project, note, saved outfit, your music library and playlists, every object you've built, and all settings. The Workshop will return to a completely fresh first-launch state. This cannot be undone. Continue?",
            async () => dangerZoneActions.factoryReset(),
            true,
            "Are you completely sure? There is no way to undo a factory reset once it starts."
          )
        );

        return null;
      }

      function buildDangerRow(label, description, confirmText, action, danger = false, secondConfirmText = null) {
        const row = document.createElement("div");
        row.className = "danger-zone-row";

        const info = document.createElement("div");
        info.className = "danger-zone-info";
        const title = document.createElement("strong");
        title.textContent = label;
        const desc = document.createElement("p");
        desc.textContent = description;
        info.append(title, desc);
        row.appendChild(info);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = danger ? "danger-zone-button danger-zone-button-severe" : "danger-zone-button";
        btn.textContent = label;
        btn.addEventListener("click", async () => {
          if (!window.confirm(confirmText)) return;
          if (secondConfirmText && !window.confirm(secondConfirmText)) return;
          btn.disabled = true;
          btn.textContent = "Working\u2026";
          try {
            await action();
          } finally {
            btn.disabled = false;
            btn.textContent = label;
          }
        });
        row.appendChild(btn);
        return row;
      }

      // ---- shared row builders ----

      function buildCheckboxRow(labelText, checked, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const label = document.createElement("label");
        label.style.width = "auto";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = checked;
        checkbox.addEventListener("change", () => onChange(checkbox.checked));
        label.append(checkbox, ` ${labelText}`);
        row.appendChild(label);
        return row;
      }

      function buildSelectRow(labelText, value, options, onChange) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const label = document.createElement("label");
        label.textContent = labelText;
        const select = document.createElement("select");
        for (const [optValue, optLabel] of options) {
          const opt = document.createElement("option");
          opt.value = optValue;
          opt.textContent = optLabel;
          if (optValue === value) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener("change", () => onChange(select.value));
        row.append(label, select);
        return row;
      }

      function buildRangeRow(labelText, value, min, max, step, unit, onChange, decimals = 0, asPercent = false) {
        const row = document.createElement("div");
        row.className = "panel-row";
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        const valueEl = document.createElement("span");
        valueEl.className = "settings-range-value";
        const formatValue = (v) => (asPercent ? `${Math.round(v * 100)}${unit}` : `${v.toFixed(decimals)}${unit}`);
        valueEl.textContent = formatValue(value);
        input.addEventListener("input", () => {
          const v = parseFloat(input.value);
          valueEl.textContent = formatValue(v);
          onChange(v);
        });
        row.append(label, input, valueEl);
        return row;
      }

      function buildFeedbackRow(labelText, valueText) {
        const row = document.createElement("div");
        row.className = "settings-feedback-row";
        const label = document.createElement("span");
        label.textContent = labelText;
        const value = document.createElement("span");
        value.className = "settings-feedback-value";
        value.textContent = valueText;
        row.append(label, value);
        return row;
      }

      setTab("general");
      return () => disposeCurrentTab?.();
    },
  };
}
