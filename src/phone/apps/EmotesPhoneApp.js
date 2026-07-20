/**
 * createEmotesPhoneApp
 * -----------------------
 * "Rather than immediately opening the radial wheel, create a dedicated
 * Emotes application. The application should display the player's
 * available emotes in a clean list. Selecting an emote should
 * immediately trigger it. Please keep this interface lightweight and
 * consistent with the rest of the phone." Reads `animationLibraryStore`
 * and triggers through `playerAnimationSystem.play(id)` directly, the
 * exact same two calls `EmoteWheelSystem.js`'s own grid already makes,
 * just presented as a phone screen instead of a radial menu. The direct
 * "G" key shortcut still opens the wheel exactly as it always did — this
 * is a second, equally valid way to reach the same gestures, not a
 * replacement.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — a tap-to-
 * trigger tile grid (the shared `emotes` sparkle icon, since no
 * per-gesture icon exists, the same honest "one shared mark" choice
 * Beings' own roster tiles made) rather than a plain list of rows.
 */
import { iconMarkup } from "../../utils/ProceduralIcons.js";

export function createEmotesPhoneApp({ animationLibraryStore, playerAnimationSystem, engine }) {
  return {
    id: "emotes",
    label: "Emotes",
    glyph: "emotes",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Emotes";
      container.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "workshop-phone-emotes-grid";
      grid.setAttribute("role", "list");
      container.appendChild(grid);

      function render() {
        grid.innerHTML = "";
        const clips = animationLibraryStore.all().filter((c) => c.category !== "movement");
        if (clips.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No gestures yet \u2014 create one in the Animation Editor.";
          grid.appendChild(empty);
          return;
        }
        for (const clip of clips) grid.appendChild(buildTile(clip));
      }

      function buildTile(clip) {
        const cell = document.createElement("div");
        cell.className = "workshop-phone-emotes-cell";
        cell.setAttribute("role", "listitem");
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "workshop-phone-emotes-tile";
        tile.setAttribute("aria-label", `Play ${clip.name}`);
        const icon = document.createElement("span");
        icon.className = "workshop-phone-emotes-tile-icon";
        icon.innerHTML = iconMarkup("emotes");
        icon.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "workshop-phone-emotes-tile-name";
        name.textContent = clip.name;
        tile.append(icon, name);
        tile.addEventListener("click", () => {
          playerAnimationSystem?.play(clip.id);
          engine.events.emit("phone:closeRequested");
        });
        cell.appendChild(tile);
        return cell;
      }

      render();
      const off = animationLibraryStore.events.on("library:changed", render);
      return () => off();
    },
  };
}
