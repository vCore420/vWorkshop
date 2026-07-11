import { CameraSystem } from "../../systems/CameraSystem.js";
import { MOVEMENT_STYLES } from "../../beings/BeingBehaviours.js";

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
 */
export function createBeingsPhoneApp({ beingLibrary, beingInstanceStore, beingSpawnerSystem, beingController }) {
  const engine = beingController.engine; // same trick MediaApp.js uses via musicSystem.engine

  return {
    id: "beings",
    label: "Beings",
    glyph: "\uD83E\uDDDC",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Beings";
      container.appendChild(heading);

      const spawnSection = document.createElement("div");
      spawnSection.className = "workshop-phone-section";
      const spawnHeading = document.createElement("h3");
      spawnHeading.textContent = "Spawn a Being";
      spawnSection.appendChild(spawnHeading);
      const spawnHint = document.createElement("p");
      spawnHint.className = "app-subtitle";
      spawnHint.textContent = "Choose one, then look where you want it and click.";
      spawnSection.appendChild(spawnHint);
      const spawnList = document.createElement("div");
      spawnList.className = "workshop-phone-list";
      spawnSection.appendChild(spawnList);
      container.appendChild(spawnSection);

      const manageSection = document.createElement("div");
      manageSection.className = "workshop-phone-section";
      const manageHeading = document.createElement("h3");
      manageHeading.textContent = "Placed Beings";
      manageSection.appendChild(manageHeading);
      const manageList = document.createElement("div");
      manageList.className = "workshop-phone-list";
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
        for (const being of beings) {
          const row = document.createElement("div");
          row.className = "workshop-phone-list-row";
          const name = document.createElement("span");
          name.className = "workshop-phone-list-label";
          name.textContent = being.name;
          const spawnBtn = document.createElement("button");
          spawnBtn.type = "button";
          spawnBtn.className = "workshop-phone-small-button";
          spawnBtn.textContent = "Place";
          spawnBtn.addEventListener("click", () => {
            beingSpawnerSystem.beginPlacement(being.id);
            engine.events.emit("phone:closeRequested");
          });
          row.append(name, spawnBtn);
          spawnList.appendChild(row);
        }
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
        if (instance.despawned) row.classList.add("despawned");

        const topRow = document.createElement("div");
        topRow.className = "workshop-phone-list-row";
        const name = document.createElement("span");
        name.className = "workshop-phone-list-label";
        name.textContent = instance.name || definition?.name || "(deleted Being)";
        topRow.appendChild(name);
        row.appendChild(topRow);

        if (definition) {
          const behaviourRow = document.createElement("div");
          behaviourRow.className = "panel-row";
          const label = document.createElement("label");
          label.textContent = "Movement";
          const select = document.createElement("select");
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
        despawnBtn.addEventListener("click", () => beingInstanceStore.setDespawned(instance.id, !instance.despawned));
        actions.appendChild(despawnBtn);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "builder-icon-button";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          if (window.confirm(`Remove "${name.textContent}" from the Workshop?`)) beingInstanceStore.remove(instance.id);
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
