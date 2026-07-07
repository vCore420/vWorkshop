import { formatTime, buildCoverArt } from "./domHelpers.js";

/**
 * PlaybackBar
 * -------------
 * The one part of the music UI that stays exactly the same no matter which
 * sidebar section you're looking at — because what's playing doesn't
 * change just because you switched from browsing Albums to a Playlist.
 * Built once per overlay mount and updated in place (never torn down and
 * rebuilt) so a seek-bar drag in progress, for instance, is never
 * interrupted by an unrelated re-render elsewhere in the panel.
 */
export function buildPlaybackBar({ musicSystem }) {
  const bar = document.createElement("div");
  bar.className = "music-playback-bar";

  const coverSlot = document.createElement("div");
  coverSlot.className = "music-playback-cover-slot";
  bar.appendChild(coverSlot);

  const info = document.createElement("div");
  info.className = "music-playback-info";
  const title = document.createElement("div");
  title.className = "music-playback-title";
  const artist = document.createElement("div");
  artist.className = "music-playback-artist";
  info.append(title, artist);
  bar.appendChild(info);

  const transport = document.createElement("div");
  transport.className = "music-playback-transport";

  const shuffleBtn = iconButton("\u{1F500}", "Shuffle");
  const prevBtn = iconButton("\u23EE", "Previous");
  const playBtn = iconButton("\u25B6", "Play");
  playBtn.classList.add("music-playback-play");
  const nextBtn = iconButton("\u23ED", "Next");
  const repeatBtn = iconButton("\u{1F501}", "Repeat");
  transport.append(shuffleBtn, prevBtn, playBtn, nextBtn, repeatBtn);
  bar.appendChild(transport);

  const seekRow = document.createElement("div");
  seekRow.className = "music-seek-row";
  const currentTimeEl = document.createElement("span");
  currentTimeEl.className = "music-seek-time";
  const seekInput = document.createElement("input");
  seekInput.type = "range";
  seekInput.min = "0";
  seekInput.max = "100";
  seekInput.value = "0";
  seekInput.className = "music-seek-bar";
  const durationEl = document.createElement("span");
  durationEl.className = "music-seek-time";
  seekRow.append(currentTimeEl, seekInput, durationEl);
  bar.appendChild(seekRow);

  const volumeRow = document.createElement("div");
  volumeRow.className = "music-volume-row";
  const muteBtn = iconButton("\u{1F50A}", "Mute");
  const volumeInput = document.createElement("input");
  volumeInput.type = "range";
  volumeInput.min = "0";
  volumeInput.max = "1";
  volumeInput.step = "0.01";
  volumeInput.className = "music-volume-bar";
  volumeRow.append(muteBtn, volumeInput);
  bar.appendChild(volumeRow);

  // --- wiring ---
  playBtn.addEventListener("click", () => musicSystem.togglePlayPause());
  prevBtn.addEventListener("click", () => musicSystem.previous());
  nextBtn.addEventListener("click", () => musicSystem.next());
  shuffleBtn.addEventListener("click", () => musicSystem.toggleShuffle());
  repeatBtn.addEventListener("click", () => musicSystem.cycleRepeat());
  muteBtn.addEventListener("click", () => musicSystem.toggleMute());
  volumeInput.addEventListener("input", () => musicSystem.setVolume(parseFloat(volumeInput.value)));

  let seeking = false;
  seekInput.addEventListener("input", () => {
    seeking = true;
    const duration = musicSystem.audio.duration || 0;
    currentTimeEl.textContent = formatTime((parseFloat(seekInput.value) / 100) * duration);
  });
  seekInput.addEventListener("change", () => {
    const duration = musicSystem.audio.duration || 0;
    musicSystem.seekTo((parseFloat(seekInput.value) / 100) * duration);
    seeking = false;
  });

  let currentAlbumId = null;

  function renderTrack() {
    const song = musicSystem.currentSong;
    title.textContent = song ? song.title : "Nothing playing";
    artist.textContent = song ? song.artist : "Choose something from the library";

    const albumId = song?.album ?? null;
    if (albumId !== currentAlbumId) {
      currentAlbumId = albumId;
      coverSlot.innerHTML = "";
      if (albumId) coverSlot.appendChild(buildCoverArt(albumId, musicSystem, { size: "small" }));
    }
  }

  function renderPlaybackState() {
    playBtn.textContent = musicSystem.isPlaying ? "\u23F8" : "\u25B6";
    playBtn.setAttribute("aria-label", musicSystem.isPlaying ? "Pause" : "Play");
    shuffleBtn.classList.toggle("active", musicSystem.shuffle);
    repeatBtn.classList.toggle("active", musicSystem.repeat !== "off");
    repeatBtn.textContent = musicSystem.repeat === "one" ? "\u{1F501}\u00B9" : "\u{1F501}";
    muteBtn.textContent = musicSystem.muted || musicSystem.volume === 0 ? "\u{1F507}" : "\u{1F50A}";
    volumeInput.value = String(musicSystem.muted ? 0 : musicSystem.volume);
  }

  function renderTime({ currentTime, duration } = {}) {
    if (seeking) return;
    const t = currentTime ?? musicSystem.audio.currentTime ?? 0;
    const d = duration || musicSystem.audio.duration || 0;
    currentTimeEl.textContent = formatTime(t);
    durationEl.textContent = formatTime(d);
    seekInput.value = d > 0 ? String((t / d) * 100) : "0";
  }

  renderTrack();
  renderPlaybackState();
  renderTime();

  const offTrack = musicSystem.engine.events.on("music:trackChanged", renderTrack);
  const offState = musicSystem.engine.events.on("music:playbackStateChanged", renderPlaybackState);
  const offTime = musicSystem.engine.events.on("music:timeUpdate", renderTime);

  bar.dispose = () => {
    offTrack();
    offState();
    offTime();
  };

  return bar;
}

function iconButton(glyph, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "music-icon-button";
  btn.textContent = glyph;
  btn.setAttribute("aria-label", label);
  return btn;
}
