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
 * The room lighting / clock-mode / weather controls that used to be this
 * whole app now live in the "General" tab — preserved exactly as they
 * were, not removed, just no longer the only thing here.
 */
import { WEATHER_STATES } from "../../systems/EnvironmentSystem.js";

export function createSettingsApp({ settingsStore, lightingSystem, timeOfDaySystem, environmentSystem, musicSystem, dangerZoneActions }) {
  const engine = musicSystem.engine; // same trick MediaApp.js uses — avoids a dedicated engine dependency just for this

  const TABS = [
    { id: "general", label: "General" },
    { id: "graphics", label: "Graphics" },
    { id: "performance", label: "Performance" },
    { id: "display", label: "Display" },
    { id: "controls", label: "Controls" },
    { id: "audio", label: "Audio" },
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
        const render = { general: renderGeneral, graphics: renderGraphics, performance: renderPerformance, display: renderDisplay, controls: renderControls, audio: renderAudio, danger: renderDangerZone }[id];
        disposeCurrentTab = render(body);
      }

      function renderGeneral(el) {
        const lightRow = buildCheckboxRow("Workshop lights on", lightingSystem.lightsOn, (checked) => lightingSystem.setLightsOn(checked));
        el.appendChild(lightRow);

        const timeRow = document.createElement("div");
        timeRow.className = "panel-row";
        const timeLabel = document.createElement("label");
        timeLabel.textContent = "Clock";
        const timeSelect = document.createElement("select");
        for (const [value, label] of [["realtime", "Follow real time"], ["simulated", "Simulated cycle"]]) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          if (timeOfDaySystem.mode === value) opt.selected = true;
          timeSelect.appendChild(opt);
        }
        timeSelect.addEventListener("change", () => timeOfDaySystem.setMode(timeSelect.value));
        timeRow.append(timeLabel, timeSelect);
        el.appendChild(timeRow);

        const weatherRow = document.createElement("p");
        weatherRow.className = "app-subtitle";
        const envState = WEATHER_STATES[environmentSystem.current]?.label ?? environmentSystem.current;
        const modeLabel = { manual: "Manual", live: "Live Weather", dynamic: "Workshop Dynamic" }[environmentSystem.mode] ?? environmentSystem.mode;
        weatherRow.textContent = `Current environment: ${envState} (${modeLabel}) \u2014 look out a window to view or change it.`;
        el.appendChild(weatherRow);
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
        el.appendChild(buildRangeRow("Mouse Sensitivity", c.mouseSensitivity, 0.2, 3, 0.1, "\u00d7", (v) => patch({ mouseSensitivity: v }), 1));
        el.appendChild(buildRangeRow("Touch Sensitivity", c.touchSensitivity, 0.2, 3, 0.1, "\u00d7", (v) => patch({ touchSensitivity: v }), 1));
        el.appendChild(buildCheckboxRow("Invert look", c.invertLook, (checked) => patch({ invertLook: checked })));
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
