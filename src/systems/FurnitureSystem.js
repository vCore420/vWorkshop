import * as THREE from "three";
import { FURNITURE_REGISTRY } from "../entities/furniture/registry.js";
import { FURNITURE_LAYOUT } from "../data/layoutDefault.js";
import { Entity } from "../core/Entity.js";
import { MeshComponent } from "../core/components/MeshComponent.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";

/**
 * FurnitureSystem
 * ---------------
 * Turns FURNITURE_REGISTRY + layoutDefault.FURNITURE_LAYOUT into real
 * entities: builds each definition's placeholder mesh, places it according
 * to the layout, and attaches an InteractableComponent using the
 * definition's `interaction` config. It also computes a simple footprint
 * box per piece for CameraSystem's walk-collision.
 *
 * Persistence hook: furniture *positions* are saved even though nothing in
 * this phase lets the player move furniture. That seam is intentional —
 * "customisable layouts" (brief, future philosophy) becomes "let the player
 * drag this and FurnitureSystem writes the new transform back into the
 * layout", with the save/load path already working on day one.
 */
export class FurnitureSystem {
  constructor() {
    /** @type {Map<string, {entity: Entity, definition: object, footprintBox: THREE.Box3}>} */
    this.pieces = new Map();
  }

  init(engine) {
    this.engine = engine;

    for (const definition of FURNITURE_REGISTRY) {
      const layout = FURNITURE_LAYOUT[definition.id] ?? { position: [0, 0, 0], rotationY: 0 };
      const object3D = definition.build();
      object3D.position.set(...layout.position);
      object3D.rotation.y = layout.rotationY ?? 0;
      object3D.updateMatrixWorld(true);

      const entity = new Entity(definition.id).tag("furniture");
      entity.userData.definition = definition;
      entity.addComponent(new MeshComponent(object3D, engine.scene));

      if (definition.interaction) {
        const cfg = definition.interaction;
        const focusPose = this._resolveFocusPose(definition, object3D);
        // Two ways a furniture piece can wire up its interaction:
        //   - `overlayId` (most furniture): FurnitureSystem auto-emits
        //     `interaction:trigger` and OverlayManager takes it from there.
        //   - `onInteract`/`onExit` (e.g. the computer desk): the
        //     definition provides its own callbacks and owns the event(s)
        //     it emits, bypassing OverlayManager entirely. This is how the
        //     computer stays "one self-contained object" — nothing here
        //     needs to know what a computer is.
        const onInteract = cfg.onInteract
          ? () => cfg.onInteract({ engine, entity, definition })
          : () =>
              engine.events.emit("interaction:trigger", {
                overlayId: cfg.overlayId,
                context: { furnitureId: definition.id, definition },
              });
        const onExit = cfg.onExit ? () => cfg.onExit({ engine, entity, definition }) : null;

        entity.addComponent(
          new InteractableComponent({
            prompt: cfg.prompt,
            radius: cfg.radius,
            focusPose,
            opensOverlay: cfg.overlayId ? true : !!cfg.opensOverlay,
            onInteract,
            onExit,
          })
        );
      }

      engine.entities.create(entity);

      const footprintBox = this._computeFootprintBox(definition, layout);
      this.pieces.set(definition.id, { entity, definition, footprintBox });
    }

    engine.events.on("persistence:save", (bag) => {
      bag.furniture = {};
      for (const [id, piece] of this.pieces) {
        const obj = piece.entity.object3D;
        bag.furniture[id] = {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotationY: obj.rotation.y,
        };
      }
    });
    engine.events.on("persistence:load", (bag) => {
      if (!bag?.furniture) return;
      for (const [id, transform] of Object.entries(bag.furniture)) {
        const piece = this.pieces.get(id);
        if (!piece) continue;
        piece.entity.object3D.position.set(...transform.position);
        piece.entity.object3D.rotation.y = transform.rotationY;
      }
    });
  }

  _resolveFocusPose(definition, object3D) {
    const local = definition.interaction.focusPoseLocal;
    if (!local) return null;
    const toWorld = (arr) => {
      const v = new THREE.Vector3(...arr);
      object3D.localToWorld(v);
      return [v.x, v.y, v.z];
    };
    return { position: toWorld(local.position), lookAt: toWorld(local.lookAt) };
  }

  _computeFootprintBox(definition, layout) {
    const { width = 0.6, depth = 0.6 } = definition.footprint ?? {};
    const [x, , z] = layout.position;
    const theta = layout.rotationY ?? 0;
    const hw0 = width / 2, hd0 = depth / 2;
    // Axis-aligned bounding box of a (hw0 x hd0) rectangle rotated by theta —
    // an approximation (a true oriented box would be tighter), which is fine
    // for a "don't walk through the desk" collision check.
    const hw = Math.abs(hw0 * Math.cos(theta)) + Math.abs(hd0 * Math.sin(theta)) + 0.05;
    const hd = Math.abs(hw0 * Math.sin(theta)) + Math.abs(hd0 * Math.cos(theta)) + 0.05;
    return new THREE.Box3(
      new THREE.Vector3(x - hw, 0, z - hd),
      new THREE.Vector3(x + hw, 2.2, z + hd)
    );
  }

  /** All footprint boxes, for CameraSystem's walk-collision. */
  getFootprints() {
    return [...this.pieces.values()].map((p) => p.footprintBox);
  }

  getPiece(id) {
    return this.pieces.get(id) ?? null;
  }
}
