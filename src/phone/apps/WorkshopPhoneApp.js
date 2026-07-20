/**
 * createWorkshopPhoneApp
 * -------------------------
 * "Create a Workshop application for quick world controls... this should
 * become the player's portable Workshop control centre." Every control
 * here is a thin wrapper over a system that already does the real work —
 * `EnvironmentSystem` for weather, `TimeOfDaySystem` for time,
 * `MusicSystem` for playback, `LightingSystem` for the room's own
 * practical lights, `CameraSystem.recoverToSpawn()` for "I'm Lost!" —
 * nothing here is a second copy of any of their own state.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — every
 * control reads as a real device's own control-centre tile or
 * icon-prefixed button (`ProceduralIcons.js`) rather than plain text,
 * since this app's whole premise is a portable panel of physical-feeling
 * switches, not a settings form.
 */
import { nextDomId } from "../../utils/domIds.js";
import { iconMarkup } from "../../utils/ProceduralIcons.js";

/** A quick control — icon on top, label below, matching a real device's
 *  own control-centre tiles rather than a plain row of text buttons.
 *  Icon and label both stay real content (the icon is never the *only*
 *  accessible name), so this is a visual departure, not an accessibility
 *  one. */
function controlTile(iconKind, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "workshop-phone-control-tile";
  const icon = document.createElement("span");
  icon.className = "workshop-phone-control-tile-icon";
  icon.innerHTML = iconMarkup(iconKind);
  const text = document.createElement("span");
  text.textContent = label;
  btn.append(icon, text);
  btn.addEventListener("click", onClick);
  return btn;
}

export function createWorkshopPhoneApp({ environmentSystem, timeOfDaySystem, musicSystem, lightingSystem, cameraSystem }) {
  return {
    id: "workshop",
    label: "Workshop",
    glyph: "workshop",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Workshop";
      container.appendChild(heading);

      // --- Weather ---
      const weatherSection = document.createElement("div");
      weatherSection.className = "workshop-phone-section";
      const weatherHeadingId = nextDomId("phone-workshop-weather-heading");
      weatherSection.setAttribute("role", "group");
      weatherSection.setAttribute("aria-labelledby", weatherHeadingId);
      const weatherHeading = document.createElement("h3");
      weatherHeading.id = weatherHeadingId;
      weatherHeading.textContent = "Weather";
      weatherSection.appendChild(weatherHeading);
      const weatherRow = document.createElement("div");
      weatherRow.className = "workshop-phone-control-row";
      const weatherButtons = [];
      const weatherIcons = { clear: "weatherClear", partlyCloudy: "weatherCloudy", lightRain: "weatherRain", storm: "weatherStorm" };
      for (const [id, label] of [["clear", "Clear"], ["partlyCloudy", "Cloudy"], ["lightRain", "Rain"], ["storm", "Storm"]]) {
        const btn = controlTile(weatherIcons[id], label, () => environmentSystem.setWeather(id));
        weatherRow.appendChild(btn);
        weatherButtons.push([id, btn]);
      }
      // Weather has one real, persistent "current" state (`environmentSystem.current`) \u2014
      // unlike Time below, which is a continuous clock, so a pressed state here is
      // never stale. Reflected on mount and kept live via `environment:changed`.
      const refreshWeatherButtons = () => {
        for (const [id, btn] of weatherButtons) btn.setAttribute("aria-pressed", String(environmentSystem.current === id));
      };
      refreshWeatherButtons();
      weatherSection.appendChild(weatherRow);
      container.appendChild(weatherSection);

      // --- Time ---
      const timeSection = document.createElement("div");
      timeSection.className = "workshop-phone-section";
      const timeHeadingId = nextDomId("phone-workshop-time-heading");
      timeSection.setAttribute("role", "group");
      timeSection.setAttribute("aria-labelledby", timeHeadingId);
      const timeHeading = document.createElement("h3");
      timeHeading.id = timeHeadingId;
      timeHeading.textContent = "Time";
      timeSection.appendChild(timeHeading);
      const timeRow = document.createElement("div");
      timeRow.className = "workshop-phone-control-row";
      // No `aria-pressed` here, deliberately \u2014 `currentTime` is a continuously
      // easing clock, not a discrete preset choice, so nothing ever stays
      // "the current selection" the way a weather state does above.
      const timeIcons = { 6: "timeDawn", 12: "weatherClear", 18: "timeDusk", 0: "timeNight" };
      for (const [hour, label] of [[6, "Dawn"], [12, "Noon"], [18, "Dusk"], [0, "Night"]]) {
        const btn = controlTile(timeIcons[hour], label, () => timeOfDaySystem.setTime(hour));
        timeRow.appendChild(btn);
      }
      timeSection.appendChild(timeRow);
      container.appendChild(timeSection);

      // --- Lighting ---
      const lightingSection = document.createElement("div");
      lightingSection.className = "workshop-phone-section";
      const lightingHeadingId = nextDomId("phone-workshop-lighting-heading");
      lightingSection.setAttribute("role", "group");
      lightingSection.setAttribute("aria-labelledby", lightingHeadingId);
      const lightingHeading = document.createElement("h3");
      lightingHeading.id = lightingHeadingId;
      lightingHeading.textContent = "Lighting";
      lightingSection.appendChild(lightingHeading);
      const lightBtn = document.createElement("button");
      lightBtn.type = "button";
      lightBtn.className = "workshop-phone-primary-button workshop-phone-icon-button";
      const lightIcon = document.createElement("span");
      lightIcon.className = "workshop-phone-icon-button-icon";
      lightIcon.innerHTML = iconMarkup("lightBulb");
      const lightLabel = document.createElement("span");
      lightBtn.append(lightIcon, lightLabel);
      const refreshLightBtn = () => {
        lightLabel.textContent = lightingSystem.lightsOn ? "Turn Lights Off" : "Turn Lights On";
        lightBtn.setAttribute("aria-pressed", String(lightingSystem.lightsOn));
      };
      refreshLightBtn();
      lightBtn.addEventListener("click", () => {
        lightingSystem.setLightsOn(!lightingSystem.lightsOn);
        refreshLightBtn();
      });
      lightingSection.appendChild(lightBtn);
      container.appendChild(lightingSection);

      // --- Music ---
      const musicSection = document.createElement("div");
      musicSection.className = "workshop-phone-section";
      const musicHeadingId = nextDomId("phone-workshop-music-heading");
      musicSection.setAttribute("role", "group");
      musicSection.setAttribute("aria-labelledby", musicHeadingId);
      const musicHeading = document.createElement("h3");
      musicHeading.id = musicHeadingId;
      musicHeading.textContent = "Music";
      musicSection.appendChild(musicHeading);
      const musicRow = document.createElement("div");
      musicRow.className = "workshop-phone-button-row";
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "workshop-phone-small-button workshop-phone-icon-button";
      const playIcon = document.createElement("span");
      playIcon.className = "workshop-phone-icon-button-icon";
      const playLabel = document.createElement("span");
      playBtn.append(playIcon, playLabel);
      const refreshPlayBtn = () => {
        playIcon.innerHTML = iconMarkup(musicSystem.isPlaying ? "musicPause" : "musicPlay");
        playLabel.textContent = musicSystem.isPlaying ? "Pause" : "Play";
        playBtn.setAttribute("aria-pressed", String(musicSystem.isPlaying));
      };
      refreshPlayBtn();
      playBtn.addEventListener("click", () => {
        musicSystem.togglePlayPause();
        refreshPlayBtn();
      });
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "workshop-phone-small-button workshop-phone-icon-button";
      const nextIcon = document.createElement("span");
      nextIcon.className = "workshop-phone-icon-button-icon";
      nextIcon.innerHTML = iconMarkup("musicNext");
      const nextLabel = document.createElement("span");
      nextLabel.textContent = "Next";
      nextBtn.append(nextIcon, nextLabel);
      nextBtn.addEventListener("click", () => musicSystem.next());
      musicRow.append(playBtn, nextBtn);
      musicSection.appendChild(musicRow);
      container.appendChild(musicSection);

      // --- Return Home / Future Workshop Projects ---
      const utilitySection = document.createElement("div");
      utilitySection.className = "workshop-phone-section";
      const lostBtn = document.createElement("button");
      lostBtn.type = "button";
      lostBtn.className = "workshop-phone-primary-button workshop-phone-icon-button";
      const lostIcon = document.createElement("span");
      lostIcon.className = "workshop-phone-icon-button-icon";
      lostIcon.innerHTML = iconMarkup("compass");
      const lostLabel = document.createElement("span");
      lostLabel.textContent = "I'm Lost!";
      lostBtn.append(lostIcon, lostLabel);
      lostBtn.addEventListener("click", () => cameraSystem?.recoverToSpawn());
      utilitySection.appendChild(lostBtn);
      const projectsNote = document.createElement("p");
      projectsNote.className = "app-subtitle";
      projectsNote.textContent = "Workshop Projects \u2014 coming in a future phase.";
      utilitySection.appendChild(projectsNote);
      container.appendChild(utilitySection);

      const offMusic = musicSystem.engine.events.on("music:playbackStateChanged", refreshPlayBtn);
      const offWeather = musicSystem.engine.events.on("environment:changed", refreshWeatherButtons);
      return () => {
        offMusic();
        offWeather();
      };
    },
  };
}
