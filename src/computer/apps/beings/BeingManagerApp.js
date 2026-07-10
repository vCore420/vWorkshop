import { CameraSystem } from "../../../systems/CameraSystem.js";

/**
 * createBeingManagerApp
 * ------------------------
 * "Think of this as the Workshop's population manager." Every row is one
 * placed `BeingInstanceStore` entry, cross-referenced against its own
 * `BeingLibrary` definition for a name/type to actually display — this
 * file never renders or moves anything itself, every action is a plain
 * store call (`beingInstanceStore.update()`/`.remove()`, or
 * `beingController.replaceTemplate()`), with `BeingController.js`'s own
 * `instances:changed` listener picking up the result a moment later. The
 * same "app renders a store, doesn't duplicate it" shape every other
 * Workshop app already follows.
 */
export function createBeingManagerApp({ beingLibrary, beingInstanceStore, beingController }) {
  const engine = beingController.engine; // same trick MediaApp.js uses via musicSystem.engine — avoids a dedicated engine dependency just for this
  return {
    id: "beingManager",
    label: "Being Manager",
    glyph: "\uD83D\uDC65",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Being Manager";
      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "Every Being currently placed in the Workshop.";
      container.append(heading, subtitle);

      const list = document.createElement("div");
      container.appendChild(list);

      function render() {
        list.innerHTML = "";
        const instances = beingInstanceStore.all();
        if (instances.length === 0) {
          const empty = document.createElement("p");
          empty.className = "app-subtitle";
          empty.textContent = "Nothing placed yet \u2014 use Place a Being to add one.";
          list.appendChild(empty);
          return;
        }
        for (const instance of instances) list.appendChild(buildRow(instance));
      }

      function buildRow(instance) {
        const definition = beingLibrary.get(instance.definitionId);
        const row = document.createElement("div");
        row.className = "builder-section being-manager-row";
        if (instance.despawned) row.classList.add("despawned");

        const title = document.createElement("h3");
        title.textContent = instance.name || definition?.name || "(deleted Being)";
        if (instance.despawned) {
          const badge = document.createElement("span");
          badge.className = "ai-future-badge";
          badge.textContent = "Despawned";
          title.appendChild(document.createTextNode(" "));
          title.appendChild(badge);
        }
        row.appendChild(title);

        const meta = document.createElement("p");
        meta.className = "app-subtitle";
        const pos = instance.position;
        const dist = playerDistanceTo(pos);
        meta.textContent = `${definition?.beingType ?? "unknown"} \u00b7 (${pos[0].toFixed(1)}, ${pos[2].toFixed(1)}) \u00b7 ${dist !== null ? `${dist.toFixed(1)}m away` : ""} \u00b7 ${instance.currentState}`;
        row.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "builder-inline-row";

        actions.appendChild(actionButton("Rename", () => {
          const name = window.prompt("Rename this Being:", instance.name || definition?.name || "");
          if (name !== null) {
            beingInstanceStore.update(instance.id, { name: name.trim() || null });
            render();
          }
        }));

        actions.appendChild(actionButton("Move to me", () => {
          const camera = engine.getSystem(CameraSystem);
          if (!camera) return;
          const p = camera.position;
          beingInstanceStore.update(instance.id, { position: [p.x, instance.position[1], p.z], homePosition: [p.x, instance.position[1], p.z] });
          render();
        }));

        if (definition) {
          actions.appendChild(actionButton("Replace Template\u2026", () => {
            const others = beingLibrary.all().filter((b) => b.id !== instance.definitionId);
            if (others.length === 0) {
              window.alert("No other Beings exist to replace this with.");
              return;
            }
            const choice = window.prompt(`Replace with which Being?\n${others.map((b, i) => `${i + 1}. ${b.name}`).join("\n")}`, "1");
            const index = parseInt(choice, 10) - 1;
            if (others[index]) {
              beingController.replaceTemplate(instance.id, others[index].id);
              render();
            }
          }));
        }

        actions.appendChild(actionButton(instance.despawned ? "Respawn" : "Despawn", () => {
          beingInstanceStore.setDespawned(instance.id, !instance.despawned);
          render();
        }));

        actions.appendChild(actionButton("Remove", () => {
          if (window.confirm(`Remove "${instance.name || definition?.name}" from the Workshop? This can't be undone.`)) {
            beingInstanceStore.remove(instance.id);
            render();
          }
        }));

        row.appendChild(actions);
        return row;
      }

      function playerDistanceTo(pos) {
        const camera = engine.getSystem(CameraSystem);
        if (!camera) return null;
        const dx = camera.position.x - pos[0];
        const dz = camera.position.z - pos[2];
        return Math.sqrt(dx * dx + dz * dz);
      }

      function actionButton(label, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "builder-icon-button";
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
      }

      render();
      const offInstances = beingInstanceStore.events.on("instances:changed", render);
      return () => offInstances();
    },
  };
}
