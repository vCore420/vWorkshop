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
 */
export function createWorkshopPhoneApp({ environmentSystem, timeOfDaySystem, musicSystem, lightingSystem, cameraSystem }) {
  return {
    id: "workshop",
    label: "Workshop",
    glyph: "\uD83C\uDFE1",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Workshop";
      container.appendChild(heading);

      // --- Weather ---
      const weatherSection = document.createElement("div");
      weatherSection.className = "workshop-phone-section";
      const weatherHeading = document.createElement("h3");
      weatherHeading.textContent = "Weather";
      weatherSection.appendChild(weatherHeading);
      const weatherRow = document.createElement("div");
      weatherRow.className = "workshop-phone-button-row";
      for (const [id, label] of [["clear", "Clear"], ["partlyCloudy", "Cloudy"], ["lightRain", "Rain"], ["storm", "Storm"]]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "workshop-phone-small-button";
        btn.textContent = label;
        btn.addEventListener("click", () => environmentSystem.setWeather(id));
        weatherRow.appendChild(btn);
      }
      weatherSection.appendChild(weatherRow);
      container.appendChild(weatherSection);

      // --- Time ---
      const timeSection = document.createElement("div");
      timeSection.className = "workshop-phone-section";
      const timeHeading = document.createElement("h3");
      timeHeading.textContent = "Time";
      timeSection.appendChild(timeHeading);
      const timeRow = document.createElement("div");
      timeRow.className = "workshop-phone-button-row";
      for (const [hour, label] of [[6, "Dawn"], [12, "Noon"], [18, "Dusk"], [0, "Night"]]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "workshop-phone-small-button";
        btn.textContent = label;
        btn.addEventListener("click", () => timeOfDaySystem.setTime(hour));
        timeRow.appendChild(btn);
      }
      timeSection.appendChild(timeRow);
      container.appendChild(timeSection);

      // --- Lighting ---
      const lightingSection = document.createElement("div");
      lightingSection.className = "workshop-phone-section";
      const lightingHeading = document.createElement("h3");
      lightingHeading.textContent = "Lighting";
      lightingSection.appendChild(lightingHeading);
      const lightBtn = document.createElement("button");
      lightBtn.type = "button";
      lightBtn.className = "workshop-phone-primary-button";
      const refreshLightBtn = () => (lightBtn.textContent = lightingSystem.lightsOn ? "Turn Lights Off" : "Turn Lights On");
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
      const musicHeading = document.createElement("h3");
      musicHeading.textContent = "Music";
      musicSection.appendChild(musicHeading);
      const musicRow = document.createElement("div");
      musicRow.className = "workshop-phone-button-row";
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "workshop-phone-small-button";
      const refreshPlayBtn = () => (playBtn.textContent = musicSystem.isPlaying ? "\u23F8 Pause" : "\u25B6 Play");
      refreshPlayBtn();
      playBtn.addEventListener("click", () => {
        musicSystem.togglePlayPause();
        refreshPlayBtn();
      });
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "workshop-phone-small-button";
      nextBtn.textContent = "\u23ED Next";
      nextBtn.addEventListener("click", () => musicSystem.next());
      musicRow.append(playBtn, nextBtn);
      musicSection.appendChild(musicRow);
      container.appendChild(musicSection);

      // --- Return Home / Future Workshop Projects ---
      const utilitySection = document.createElement("div");
      utilitySection.className = "workshop-phone-section";
      const lostBtn = document.createElement("button");
      lostBtn.type = "button";
      lostBtn.className = "workshop-phone-primary-button";
      lostBtn.textContent = "I'm Lost!";
      lostBtn.addEventListener("click", () => cameraSystem?.recoverToSpawn());
      utilitySection.appendChild(lostBtn);
      const projectsNote = document.createElement("p");
      projectsNote.className = "app-subtitle";
      projectsNote.textContent = "Workshop Projects \u2014 coming in a future phase.";
      utilitySection.appendChild(projectsNote);
      container.appendChild(utilitySection);

      const offMusic = musicSystem.engine.events.on("music:playbackStateChanged", refreshPlayBtn);
      return () => offMusic();
    },
  };
}
