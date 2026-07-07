import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Storage
 * -------
 * Same honest-placeholder spirit as phase 1's tool storage cabinet: this
 * doesn't pretend to hold real items yet, it says so.
 */
registerBehaviour("storage", {
  label: "Storage",
  ownsInteractable: true,
  propsSchema: [
    { key: "prompt", label: "Prompt", type: "text", default: "Check storage" },
    { key: "capacity", label: "Capacity (flavour only)", type: "number", default: 10 },
  ],
  apply({ entity, properties, engine, definition }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: properties.prompt || "Check storage",
        radius: 1.4,
        onInteract: () =>
          engine.events.emit("hud:toast", {
            text: `${definition.name} — holds around ${properties.capacity ?? 10} items (a real inventory system isn't built yet).`,
          }),
      })
    );
  },
});
