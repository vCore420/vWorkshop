import { CameraSystem } from "../../systems/CameraSystem.js";
import { MOVEMENT_STYLES } from "../../beings/BeingBehaviours.js";
import { nextDomId } from "../../utils/domIds.js";
import { iconMarkup } from "../../utils/ProceduralIcons.js";

/**
 * createBeingsPhoneApp
 * -----------------------
 * "The Computer should remain responsible for creating Beings, editing
 * Being Definitions. The Phone should become responsible for managing
 * placed Beings." Two sections, reusing exactly the same stores the
 * computer's own (now-removed) Spawner/Manager apps already used —
 * `BeingSpawnerSystem` for placement, `BeingInstanceStore` for the list
 * of what's currently placed, `BeingLibrary` read-only, just to know
 * which saved Being an instance actually is.
 *
 * "Quick Behaviour Changes" edits the *definition's* own movement style
 * directly (the same field the Being Creator itself edits) rather than
 * inventing a separate per-instance override — every instance of that
 * Being shares one movement style already, and a quick phone-side toggle
 * changing all of them at once is the simpler, more honest behaviour
 * than a divergent per-instance copy nothing else in the Workshop's own
 * Being architecture currently supports.
 *
 * Version 3, Phase 13 ("The Phone Becomes a Device"), Wave 2 — "Spawn a
 * Being" reads as a roster, so it's a tap-to-place tile grid (the shared
 * `beings` paw-print icon, since no per-Being icon exists) rather than a
 * plain list of rows. "Placed Beings" stays a list: each instance carries
 * real per-instance controls (movement select, move/despawn/remove) a
 * tile has no room for, so a list is the honest shape for that content,
 * not a limitation to work around.
 */
export function createBeingsPhoneApp({ beingLibrary, beingInstanceStore, beingSpawnerSystem, beingController }) {
  const engine = beingController.engine; // same trick MediaApp.js uses via musicSystem.engine

  return {
    id: "beings",
    label: "Beings",
    glyph: "beings",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Beings";
      container.appendChild(heading);

      const spawnSection = document.createElement("div");
      spawnSection.className = "workshop-phone-section";
      const spawnHeadingId = nextDomId("phone-beings-spawn-heading");
      const spawnHeading = document.createElement("h3");
      spawnHeading.id = spawnHeadingId;
      spawnHeading.textContent = "Spawn a Being";
      spawnSection.appendChild(spawnHeading);
      spawnSection.setAttribute("role", "group");
      spawnSection.setAttribute("aria-labelledby", spawnHeadingId);
      const spawnHint = document.createElement("p");
      spawnHint.className = "app-subtitle";
      spawnHint.textContent = "Choose one, then look where you want it and click.";
      spawnSection.appendChild(spawnHint);
      const spawnList = document.createElement("div");
      spawnList.className = "workshop-phone-being-grid";
      spawnList.setAttribute("role", "list");
      spawnSection.appendChild(spawnList);
      container.appendChild(spawnSection);

      const manageHeadingId = nextDomId("phone-beings-manage-heading");
      const manageSection = document.createElement("div");
      manageSection.className = "workshop-phone-section";
      manageSection.setAttribute("role", "group");
      manageSection.setAttribute("aria-labelledby", manageHeadingId);
      const manageHeading = document.createElement("h3");
      manageHeading.id = manageHeadingId;
      manageHeading.textContent = "Placed Beings";
      manageSection.appendChild(manageHeading);
      const manageList = document.createElement("div");
      manageList.className = "workshop-phone-list";
      manageList.setAttribute("role", "list");
      manageSection.appendChild(manageList);
      container.appendChild(manageSection);

      function renderSpawnList() {
        spawnList.innerHTML = "";
        const beings = beingLibrary.all();
        if (beings.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "No Beings exist yet \u2014 create one at the computer's Being Creator first.";
          spawnList.appendChild(empty);
          return;
        }
        for (const being of beings) spawnList.appendChild(buildSpawnTile(being));
      }

      function buildSpawnTile(being) {
        const cell = document.createElement("div");
        cell.className = "workshop-phone-being-cell";
        cell.setAttribute("role", "listitem");
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "workshop-phone-being-tile";
        tile.setAttribute("aria-label", `Place ${being.name}`);
        const icon = document.createElement("span");
        icon.className = "workshop-phone-being-tile-icon";
        icon.innerHTML = iconMarkup("beings");
        icon.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "workshop-phone-being-tile-name";
        name.textContent = being.name;
        tile.append(icon, name);
        tile.addEventListener("click", () => {
          beingSpawnerSystem.beginPlacement(being.id);
          engine.events.emit("phone:closeRequested");
        });
        cell.appendChild(tile);
        return cell;
      }

      function renderManageList() {
        manageList.innerHTML = "";
        const instances = beingInstanceStore.all();
        if (instances.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "Nothing placed yet.";
          manageList.appendChild(empty);
          return;
        }
        for (const instance of instances) manageList.appendChild(buildInstanceRow(instance));
      }

      function buildInstanceRow(instance) {
        const definition = beingLibrary.get(instance.definitionId);
        const row = document.createElement("div");
        row.className = "workshop-phone-being-row";
        row.setAttribute("role", "listitem");
        if (instance.despawned) row.classList.add("despawned");

        const displayName = instance.name || definition?.name || "(deleted Being)";
        const topRow = document.createElement("div");
        topRow.className = "workshop-phone-list-row";
        const name = document.createElement("span");
        name.className = "workshop-phone-list-label";
        name.textContent = displayName;
        topRow.appendChild(name);
        row.appendChild(topRow);

        if (definition) {
          const behaviourRow = document.createElement("div");
          behaviourRow.className = "panel-row";
          const movementId = nextDomId("phone-being-movement");
          const label = document.createElement("label");
          label.htmlFor = movementId;
          label.textContent = "Movement";
          const select = document.createElement("select");
          select.id = movementId;
          for (const style of MOVEMENT_STYLES) {
            const opt = document.createElement("option");
            opt.value = style.id;
            opt.textContent = style.label;
            if (definition.movementStyle === style.id) opt.selected = true;
            select.appendChild(opt);
          }
          select.title = "Changes every placed copy of this Being, not just this one";
          select.addEventListener("change", () => beingLibrary.update(definition.id, { movementStyle: select.value }));
          behaviourRow.append(label, select);
          row.appendChild(behaviourRow);
        }

        const actions = document.createElement("div");
        actions.className = "builder-inline-row";

        const moveBtn = document.createElement("button");
        moveBtn.type = "button";
        moveBtn.className = "builder-icon-button";
        moveBtn.textContent = "Move to me";
        moveBtn.setAttribute("aria-label", `Move ${displayName} to me`);
        moveBtn.addEventListener("click", () => {
          const camera = engine.getSystem(CameraSystem);
          if (!camera) return;
          const p = camera.position;
          beingInstanceStore.update(instance.id, { position: [p.x, instance.position[1], p.z], homePosition: [p.x, instance.position[1], p.z] });
        });
        actions.appendChild(moveBtn);

        const despawnBtn = document.createElement("button");
        despawnBtn.type = "button";
        despawnBtn.className = "builder-icon-button";
        despawnBtn.textContent = instance.despawned ? "Respawn" : "Despawn";
        despawnBtn.setAttribute("aria-label", `${instance.despawned ? "Respawn" : "Despawn"} ${displayName}`);
        despawnBtn.addEventListener("click", () => beingInstanceStore.setDespawned(instance.id, !instance.despawned));
        actions.appendChild(despawnBtn);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "builder-icon-button";
        removeBtn.textContent = "Remove";
        removeBtn.setAttribute("aria-label", `Remove ${displayName}`);
        removeBtn.addEventListener("click", () => {
          if (window.confirm(`Remove "${displayName}" from the Workshop?`)) beingInstanceStore.remove(instance.id);
        });
        actions.appendChild(removeBtn);

        row.appendChild(actions);
        return row;
      }

      renderSpawnList();
      renderManageList();
      const offBeings = beingLibrary.events.on("beings:changed", () => {
        renderSpawnList();
        renderManageList();
      });
      const offInstances = beingInstanceStore.events.on("instances:changed", renderManageList);
      return () => {
        offBeings();
        offInstances();
      };
    },
  };
}
