import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Interactable
 * ------------
 * The generic default: walk up, press interact, and a small toast shows
 * the object's own name and description (from its library metadata). This
 * is what makes *any* custom object — regardless of what it's "for" —
 * immediately demonstrate its metadata being used for something, without
 * every behaviour needing its own bespoke response.
 */
registerBehaviour("interactable", {
  label: "Interactable",
  ownsInteractable: true,
  propsSchema: [
    { key: "prompt", label: "Prompt", type: "text", default: "Look closer" },
    { key: "radius", label: "Radius (m)", type: "number", default: 1.4 },
  ],
  apply({ entity, properties, engine, definition }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: properties.prompt || "Look closer",
        radius: properties.radius || 1.4,
        onInteract: () =>
          engine.events.emit("hud:toast", {
            text: definition.description ? `${definition.name} — ${definition.description}` : definition.name,
          }),
      })
    );
  },
});
