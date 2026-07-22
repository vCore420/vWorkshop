import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";

/**
 * Pickupable
 * -----------
 * Version 4, Phase 8b ("The Rest of IK") — "world objects that can be
 * picked up, only allowing one item to be picked up at a time... this
 * give you something to reach for and use the hand placement." The
 * interaction half only — walk up, press interact, and this fires
 * `item:pickupRequested` for `HandInteractionSystem.js` (`src/systems/`)
 * to actually act on (despawning the world instance, attaching a held
 * mesh to the player's own right-hand pivot, playing `HandIK.js`'s own
 * hold pose). Deliberately thin, the same "attach an InteractableComponent,
 * emit one event, let a dedicated system own the actual behaviour" shape
 * `BeingController.js`'s own `aiResident` interaction already established
 * — this file has no opinion on *where* a picked-up item goes or how many
 * a player can carry; that's `HandInteractionSystem.js`'s own single-item
 * rule to enforce, not this behaviour's.
 */
registerBehaviour("pickupable", {
  label: "Pickupable",
  ownsInteractable: true,
  propsSchema: [{ key: "prompt", label: "Prompt", type: "text", default: "Pick up" }],
  apply({ entity, properties, engine, instance, definition }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: properties.prompt || "Pick up",
        radius: 1.6,
        onInteract: () => engine.events.emit("item:pickupRequested", { instanceId: instance.id, definitionId: definition.id }),
      })
    );
  },
});
