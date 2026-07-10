import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";

/**
 * createResidentEntity
 * -----------------------
 * The resident isn't furniture — it moves on its own, it isn't placed
 * through the Builder — so it doesn't go through `FurnitureSystem`. It's
 * still an ordinary ECS `Entity`, with the same two components almost
 * everything visible and interactable in the Workshop already has:
 * `MeshComponent` (the bubble's own root group, built by
 * `ResidentRenderer.js`) and `InteractableComponent`, wired the exact
 * same way `FurnitureSystem.js` wires an `overlayId`-based piece of
 * furniture — `onInteract` emits `interaction:trigger` and
 * `OverlayManager` takes it from there. "Walking up to the resident
 * should allow the player to begin chatting" needed no new interaction
 * mechanism at all, only a new interactable object using the one that
 * already existed.
 */
export function createResidentEntity({ engine, root }) {
  const entity = new Entity("resident");
  entity.addComponent(new MeshComponent(root, engine.scene));
  entity.addComponent(
    new InteractableComponent({
      prompt: "Talk",
      radius: 1.6,
      opensOverlay: true,
      onInteract: () => engine.events.emit("interaction:trigger", { overlayId: "residentConversation", context: {} }),
    })
  );
  engine.entities.create(entity);
  return entity;
}
