import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { registerBehaviour } from "./registry.js";
import { WorldObjectsSystem } from "../WorldObjectsSystem.js";

/**
 * Door
 * ----
 * A generic swing: toggling rotates the whole compiled object by
 * `openOffset` degrees around its own Y axis. This works for any shape —
 * it doesn't know or care which part is "the door leaf" — which is the
 * right level of generality for a foundation-phase behaviour system, at
 * the cost of not being a true hinge-on-one-edge swing. A future,
 * fancier Door behaviour could add a "hinge offset" property instead.
 *
 * Version 3, Phase 5 ("Beyond One Building") — swinging the mesh open
 * used to be the whole story, but its own cached collision (see
 * `WorldObjectsSystem`'s own per-part footprints) stayed frozen at
 * whatever it was when the door was placed, closed. A player could watch
 * the door swing open and still walk into thin air where it used to be —
 * or, worse, still be blocked by where it no longer visually is.
 * `refreshFootprint()` recomputes collision from the object3D's *current*
 * transform without persisting "open" as if it were the door's own
 * placement — see that method's own comment for why that distinction
 * matters. Covers Double Door and Gate too, both sharing this exact
 * behaviour.
 */
registerBehaviour("door", {
  label: "Door",
  ownsInteractable: true,
  propsSchema: [{ key: "openOffset", label: "Open angle (degrees)", type: "number", default: 90 }],
  apply({ entity, object3D, properties, engine, instance }) {
    const closedY = object3D.rotation.y;
    const openY = closedY + ((properties.openOffset ?? 90) * Math.PI) / 180;
    let isOpen = false;

    const interactable = new InteractableComponent({
      prompt: "Open the door",
      radius: 1.3,
      onInteract: () => {
        isOpen = !isOpen;
        object3D.rotation.y = isOpen ? openY : closedY;
        interactable.prompt = isOpen ? "Close the door" : "Open the door";
        engine.getSystem(WorldObjectsSystem)?.refreshFootprint(instance.id);
      },
    });
    entity.addComponent(interactable);
  },
});
