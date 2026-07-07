/**
 * createStereoOverlay
 * --------------------
 * "Interacting with the stereo controls music." Every track here is a
 * generative placeholder (see AudioSynth.js) standing in for real recorded
 * music later — the overlay only knows about id/title, so swapping the
 * synth for real audio files changes nothing here.
 */
export function createStereoOverlay({ audioSystem }) {
  return {
    materialClass: "panel",
    mount(panelEl) {
      const heading = document.createElement("h2");
      heading.textContent = "Stereo";
      panelEl.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "track-list";
      panelEl.appendChild(list);

      const renderList = () => {
        list.innerHTML = "";
        for (const track of audioSystem.getTrackList()) {
          const li = document.createElement("li");
          li.textContent = track.title;
          if (audioSystem.currentTrack?.id === track.id && audioSystem.isPlaying) li.classList.add("active");
          li.addEventListener("click", () => {
            audioSystem.resumeContext();
            audioSystem.playTrack(track.id);
            renderList();
          });
          list.appendChild(li);
        }
      };
      renderList();

      const transportRow = document.createElement("div");
      transportRow.className = "panel-row";
      const playBtn = document.createElement("button");
      playBtn.className = "dial-button";
      playBtn.textContent = audioSystem.isPlaying ? "\u275A\u275A" : "\u25B6";
      playBtn.addEventListener("click", () => {
        audioSystem.resumeContext();
        audioSystem.togglePlay();
        playBtn.textContent = audioSystem.isPlaying ? "\u275A\u275A" : "\u25B6";
        renderList();
      });
      transportRow.appendChild(playBtn);
      panelEl.appendChild(transportRow);

      const volumeRow = document.createElement("div");
      volumeRow.className = "panel-row";
      const label = document.createElement("label");
      label.textContent = "Volume";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "1";
      slider.step = "0.01";
      slider.value = String(audioSystem.volume);
      slider.addEventListener("input", () => audioSystem.setVolume(parseFloat(slider.value)));
      volumeRow.append(label, slider);
      panelEl.appendChild(volumeRow);

      const unsubscribe = audioSystem.engine.events.on("audio:trackChanged", renderList);
      return unsubscribe;
    },
  };
}
