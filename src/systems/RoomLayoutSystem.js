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
    this._doorTargetY = 0;
  }

  init(engine) {
    this.engine = engine;
    this.room = buildRoom(ROOM_DIMENSIONS, WINDOWS, WORKSHOP_DOOR);
    engine.scene.add(this.room.group);
    this._doorTargetY = this.room.doorClosedY;

    // The door mesh already lives inside room.group (added to the scene as
    // part of the room shell), so this entity skips MeshComponent — it only
    // needs `object3D` set for InteractableComponent's proximity check, and
    // owns no separate scene-graph lifecycle of its own.
    const doorEntity = new Entity("workshopDoor").tag("structural");
    doorEntity.object3D = this.room.doorMesh;

    doorEntity.addComponent(
      new InteractableComponent({
        prompt: "Open the workshop door",
        radius: 2.4, // large/structural — see docs/WORLD.md's interaction-distance pass
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
          radius: 2.0, // small object
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
        this._doorTargetY = this.doorOpen ? this.room.doorOpenY : this.room.doorClosedY;
        this.room.doorMesh.position.y = this._doorTargetY;
      }
    });
  }

  toggleDoor() {
    this.doorOpen = !this.doorOpen;
    this._doorTargetY = this.doorOpen ? this.room.doorOpenY : this.room.doorClosedY;
    const interactable = this.doorEntity.getComponent(InteractableComponent);
    interactable.prompt = this.doorOpen ? "Close the workshop door" : "Open the workshop door";
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
    this.room.doorMesh.position.y = damp(this.room.doorMesh.position.y, this._doorTargetY, 4, dt);
  }
}
