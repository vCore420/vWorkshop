import { buildRoom } from "../entities/room/WorkshopRoom.js";
import { ROOM_DIMENSIONS, WINDOWS, WORKSHOP_DOOR } from "../data/layoutDefault.js";
import { Entity } from "../core/Entity.js";
import { InteractableComponent } from "../core/components/InteractableComponent.js";
import { damp } from "../utils/MathUtils.js";

/**
 * RoomLayoutSystem
 * ----------------
 * Owns the room shell (floor/walls/ceiling/windows/door) and the workshop
 * door's open/closed state. Other systems read `room.windowPanes` and
 * `room.wallColliders` from here rather than reaching into the scene graph
 * themselves — e.g. TimeOfDaySystem no longer needs to touch this at all
 * now that the windows are real glass, and CameraSystem collides against
 * `getWallColliders()` exactly the way it already collides against
 * furniture footprints, rather than clamping to a hard rectangle. That
 * clamp is gone entirely — see docs/WORLD.md for why removing it (in
 * favour of real wall collision with real gaps at the door/windows) was
 * the actual fix for the doorway being blocked, not a cosmetic patch.
 *
 * This system is also the natural place a future "multiple rooms" or
 * "additional buildings" feature would grow from: instead of one `buildRoom`
 * call, it would hold a small collection of rooms and a notion of which one
 * is active. Nothing outside this file needs to know that today.
 */
export class RoomLayoutSystem {
  constructor() {
    this.room = null;
    this.doorOpen = false;
    this._doorTargetAngle = 0;
  }

  init(engine) {
    this.engine = engine;
    this.room = buildRoom(ROOM_DIMENSIONS, WINDOWS, WORKSHOP_DOOR);
    engine.scene.add(this.room.group);
    this._doorTargetAngle = 0; // closed

    // The door panels already live inside room.group (added to the scene as
    // part of the room shell), so this entity skips MeshComponent — it only
    // needs `object3D` set for InteractableComponent's proximity check, and
    // owns no separate scene-graph lifecycle of its own. doorFrame (not
    // either panel) is the anchor: it's fixed and centred on the doorway,
    // where either swinging panel's own position moves as it opens.
    const doorEntity = new Entity("workshopDoor").tag("structural");
    doorEntity.object3D = this.room.doorFrame;

    doorEntity.addComponent(
      new InteractableComponent({
        prompt: "Open the front doors",
        // The interaction anchor (doorFrame, below) sits at ground level
        // (y=0) — but interaction distance is a real 3D distance from the
        // camera's eye height (1.65m), not a horizontal-only one. A
        // smaller radius here already broke the door entirely: even
        // standing exactly in the doorway, the vertical distance *alone*
        // (1.65m) already exceeded a 1.6m radius, so there was no
        // position anywhere the door could actually be reached from. 2.2m
        // comfortably covers that fixed vertical offset with real
        // horizontal reach left over, while staying well below the
        // original, untightened 2.4m "large/structural" tier — see
        // docs/REFINEMENT.md for the pass that introduced the bug, and
        // docs/WORLDBUILDER.md for this fix.
        radius: 2.2,
        onInteract: () => this.toggleDoor(),
      })
    );
    engine.entities.create(doorEntity);
    this.doorEntity = doorEntity;

    // Each window is also a small interactable — "look outside" is where
    // weather gets checked and changed, keeping WeatherSystem's controls
    // spatial rather than a menu bolted onto the HUD.
    this.room.windowPanes.forEach((pane, index) => {
      const windowEntity = new Entity(`window-${index}`).tag("structural");
      windowEntity.object3D = pane.mesh;
      windowEntity.addComponent(
        new InteractableComponent({
          prompt: "Look outside",
          radius: 1.3, // deliberately tighter than the standard "small object" 2.0m tier; see docs/REFINEMENT.md
          opensOverlay: true,
          onInteract: () =>
            engine.events.emit("interaction:trigger", {
              overlayId: "window",
              context: { paneIndex: index },
            }),
        })
      );
      engine.entities.create(windowEntity);
    });

    engine.events.on("persistence:save", (bag) => {
      bag.room = { doorOpen: this.doorOpen };
    });
    engine.events.on("persistence:load", (bag) => {
      if (bag?.room) {
        this.doorOpen = !!bag.room.doorOpen;
        this._doorTargetAngle = this.doorOpen ? this.room.doorOpenAngle : 0;
        this.room.doorPanels.left.rotation.y = -this._doorTargetAngle;
        this.room.doorPanels.right.rotation.y = this._doorTargetAngle;
      }
    });
  }

  toggleDoor() {
    this.doorOpen = !this.doorOpen;
    this._doorTargetAngle = this.doorOpen ? this.room.doorOpenAngle : 0;
    const interactable = this.doorEntity.getComponent(InteractableComponent);
    interactable.prompt = this.doorOpen ? "Close the front doors" : "Open the front doors";
  }

  getBounds() {
    return this.room.bounds;
  }

  getWindowPanes() {
    return this.room.windowPanes;
  }

  /** Used by BuildModeSystem to raycast for object placement. */
  getFloorMesh() {
    return this.room.floorMesh;
  }

  /** THREE.Box3 list for CameraSystem's walk-collision — real gaps at the door/windows already excluded. */
  getWallColliders() {
    return this.room.wallColliders;
  }

  update(dt) {
    if (!this.room) return;
    const left = this.room.doorPanels.left;
    const right = this.room.doorPanels.right;
    left.rotation.y = damp(left.rotation.y, -this._doorTargetAngle, 4, dt);
    right.rotation.y = damp(right.rotation.y, this._doorTargetAngle, 4, dt);
  }
}
