/**
 * createEmotesPhoneApp
 * -----------------------
 * "Rather than immediately opening the radial wheel, create a dedicated
 * Emotes application. The application should display the player's
 * available emotes in a clean list. Selecting an emote should
 * immediately trigger it. Please keep this interface lightweight and
 * consistent with the rest of the phone." A plain list, the same
 * `workshop-phone-list` pattern every other phone app already uses —
 * reading `animationLibraryStore` and triggering through
 * `playerAnimationSystem.play(id)` directly, the exact same two calls
 * `EmoteWheelSystem.js`'s own grid already makes, just presented as a
 * phone screen instead of a radial menu. The direct "G" key shortcut
 * still opens the wheel exactly as it always did — this is a second,
 * equally valid way to reach the same gestures, not a replacement.
 */
export function createEmotesPhoneApp({ animationLibraryStore, playerAnimationSystem, engine }) {
  return {
    id: "emotes",
    label: "Emotes",
    glyph: "\uD83D\uDC4B",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Emotes";
      container.appendChild(heading);

      const list = document.createElement("div");
      list.className = "workshop-phone-list";
      container.appendChild(list);

      function render() {
        list.innerHTML = "";
        const clips = animationLibraryStore.all().filter((c) => c.category !== "movement");
        if (clips.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No gestures yet \u2014 create one in the Animation Editor.";
          list.appendChild(empty);
          return;
        }
        for (const clip of clips) {
          const row = document.createElement("div");
          row.className = "workshop-phone-list-row";
          const label = document.createElement("span");
          label.className = "workshop-phone-list-label";
          label.textContent = clip.name;
          const playBtn = document.createElement("button");
          playBtn.type = "button";
          playBtn.className = "workshop-phone-small-button";
          playBtn.textContent = "Play";
          playBtn.addEventListener("click", () => {
            playerAnimationSystem?.play(clip.id);
            engine.events.emit("phone:closeRequested");
          });
          row.append(label, playBtn);
          list.appendChild(row);
        }
      }

      render();
      const off = animationLibraryStore.events.on("library:changed", render);
      return () => off();
    },
  };
}
