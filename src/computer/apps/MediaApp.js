/**
 * createMediaApp
 * ----------------
 * Reflects `MusicSystem` — the same real music library the music cabinet opens —
 * rather than the old generative placeholder track. "There's only one
 * 'what's playing' in the workshop": whether you check from here or from
 * the music cabinet itself, you see and control the same session. Tapping the
 * title opens the full library the same way interacting with the cabinet
 * does, since a "now playing" strip with no way to actually browse a
 * library isn't much of a Media app.
 *
 * Photos and video have no system yet, so that half stays an honest
 * placeholder.
 */
export function createMediaApp({ musicSystem }) {
  return {
    id: "media",
    label: "Media",
    glyph: "media",
    mount(container) {
      const engine = musicSystem.engine;
      const heading = document.createElement("h2");
      heading.textContent = "Media";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Shares the workshop's music library — control it here, or from the music cabinet across the room.";

      const nowPlaying = document.createElement("div");
      nowPlaying.className = "now-playing";

      const render = () => {
        const song = musicSystem.currentSong;
        nowPlaying.innerHTML = "";
        const glyph = document.createElement("span");
        glyph.className = "glyph";
        glyph.textContent = "\u266A";
        const label = document.createElement("button");
        label.type = "button";
        label.className = "media-now-playing-title";
        label.textContent = song ? `${song.title} \u2014 ${song.artist}` : "Nothing playing";
        label.addEventListener("click", () => engine.events.emit("interaction:trigger", { overlayId: "music" }));
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = musicSystem.isPlaying ? "Pause" : "Play";
        btn.disabled = !song;
        btn.addEventListener("click", () => musicSystem.togglePlayPause());
        nowPlaying.append(glyph, label, btn);
      };
      render();

      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Photos and video will live here eventually — for now, this is just the music library.";

      const openLibraryBtn = document.createElement("button");
      openLibraryBtn.type = "button";
      openLibraryBtn.className = "media-open-library";
      openLibraryBtn.textContent = "Open the full library\u2026";
      openLibraryBtn.addEventListener("click", () => engine.events.emit("interaction:trigger", { overlayId: "music" }));

      container.append(heading, subtitle, nowPlaying, openLibraryBtn, empty);

      const offTrack = engine.events.on("music:trackChanged", render);
      const offState = engine.events.on("music:playbackStateChanged", render);
      return () => {
        offTrack();
        offState();
      };
    },
  };
}
