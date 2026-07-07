/**
 * createMediaApp
 * ----------------
 * The computer and the stereo share one AudioSystem — there's only one
 * "what's playing" in the workshop, not a separate one per object. This
 * app is a read/write reflection of that shared state, not a second player.
 * Photos and video have no system yet, so that half stays an honest
 * placeholder.
 */
export function createMediaApp({ audioSystem }) {
  return {
    id: "media",
    label: "Media",
    glyph: "\u266A",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Media";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Shares the stereo's playback — pause it here, or from across the room.";

      const nowPlaying = document.createElement("div");
      nowPlaying.className = "now-playing";

      const render = () => {
        const track = audioSystem.currentTrack;
        nowPlaying.innerHTML = "";
        const glyph = document.createElement("span");
        glyph.className = "glyph";
        glyph.textContent = "\u266A";
        const label = document.createElement("span");
        label.textContent = track && audioSystem.isPlaying ? track.title : "Nothing playing";
        const btn = document.createElement("button");
        btn.textContent = audioSystem.isPlaying ? "Pause" : "Play";
        btn.addEventListener("click", () => {
          audioSystem.resumeContext();
          audioSystem.togglePlay();
          render();
        });
        nowPlaying.append(glyph, label, btn);
      };
      render();

      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Photos and video will live here eventually — for now, this is just what the stereo is up to.";

      container.append(heading, subtitle, nowPlaying, empty);
      return audioSystem.engine.events.on("audio:trackChanged", render);
    },
  };
}
