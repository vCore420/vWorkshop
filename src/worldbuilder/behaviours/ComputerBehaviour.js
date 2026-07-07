import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Computer
 * --------
 * Marks an object as a computer-like screen. This is *not* wired into the
 * real ComputerSystem (see src/computer/) — that object is a specific,
 * hand-built piece of furniture, not a template. This behaviour is an
 * honest placeholder for "a custom object that could one day run real
 * workstation apps", not a shortcut to the real thing.
 */
registerBehaviour("computer", {
  label: "Computer",
  ownsInteractable: true,
  // screenColor is flavour metadata for now (a future pass could use it for
  // an actual emissive glow, the way the real computer's monitor works —
  // see src/computer/ComputerSystem.js for that pattern already existing).
  propsSchema: [{ key: "screenColor", label: "Screen glow", type: "color", default: "#7fd8c4" }],
  apply({ entity, engine, definition }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: "Turn it on",
        radius: 1.3,
        onInteract: () =>
          engine.events.emit("hud:toast", {
            text: `${definition.name} — a custom computer screen. Running real workstation apps on custom screens is a future update.`,
          }),
      })
    );
  },
});
