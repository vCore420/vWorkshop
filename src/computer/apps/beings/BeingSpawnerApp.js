/**
 * createBeingSpawnerApp
 * ------------------------
 * "This should behave similarly to the Builder placement workflow" —
 * this app is the computer-side half of that (choosing which Being),
 * `BeingSpawnerSystem.js` is the world-side half (the ghost preview
 * itself). Deliberately thin: this file never touches a `THREE.Object3D`
 * or the scene at all, only ever calling
 * `beingSpawnerSystem.beginPlacement(id)` and then getting out of the
 * way — placement itself happens back out in the 3D world, the same way
 * choosing a shape in the Builder Phone hands off to Build Mode rather
 * than placing anything from inside the computer screen itself.
 */
export function createBeingSpawnerApp({ beingLibrary, beingSpawnerSystem }) {
  return {
    id: "beingSpawner",
    label: "Place a Being",
    glyph: "\uD83D\uDCCD",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Place a Being";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Choose a saved Being, then click somewhere in the Workshop to place it.";
      container.append(heading, subtitle);

      const list = document.createElement("div");
      list.className = "being-spawner-grid";
      container.appendChild(list);

      function render() {
        list.innerHTML = "";
        const beings = beingLibrary.all();
        if (beings.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No Beings exist yet \u2014 create one in Being Creator first.";
          list.appendChild(empty);
          return;
        }
        for (const being of beings) {
          const tile = document.createElement("button");
          tile.type = "button";
          tile.className = "being-spawner-tile";
          const title = document.createElement("span");
          title.className = "being-spawner-tile-title";
          title.textContent = being.name;
          const meta = document.createElement("span");
          meta.className = "being-spawner-tile-meta";
          meta.textContent = being.description || being.beingType;
          tile.append(title, meta);
          tile.addEventListener("click", () => beingSpawnerSystem.beginPlacement(being.id));
          list.appendChild(tile);
        }
      }

      render();
      const offChanged = beingLibrary.events.on("beings:changed", render);
      return () => offChanged();
    },
  };
}
