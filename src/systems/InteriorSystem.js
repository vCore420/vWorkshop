/**
 * InteriorSystem
 * ----------------
 * "Weather should correctly recognise interior spaces... future
 * Builder-created buildings should naturally support this system without
 * requiring special cases. Please think about this architecturally rather
 * than specifically for the Workshop building." The entire capability is
 * one function, `registerVolume(box)` — the same "one small, generic
 * thing multiple independent callers use" shape `ReflectionSystem`
 * and `LadderSystem` already established. The Workshop's own room
 * registers its own volume directly (see `RoomLayoutSystem.js`); a future
 * Builder-created enclosed structure would register its own the exact
 * same way, through `InteriorBehaviour.js` — neither one is a special
 * case the other needs to know about.
 *
 * `isInside(position)` is the one thing anything else ever needs to ask —
 * `WorldEnvironmentSystem`'s own rain uses it to stop precipitation from
 * spawning inside an enclosed space it's standing in, but nothing about
 * this system is specific to rain; a future system wanting to know "is
 * the player currently indoors" (muffling outdoor sound, say) has exactly
 * the same one question to ask.
 */
export class InteriorSystem {
  constructor() {
    /** @type {THREE.Box3[]} */
    this._volumes = [];
  }

  init(engine) {
    this.engine = engine;
  }

  /** Registers `box` (a `THREE.Box3`, already in world space) as an
   *  enclosed interior volume. Returns a disposer; call it if the
   *  structure defining this volume is ever removed. */
  registerVolume(box) {
    this._volumes.push(box);
    return () => {
      const index = this._volumes.indexOf(box);
      if (index !== -1) this._volumes.splice(index, 1);
    };
  }

  isInside(position) {
    for (const box of this._volumes) {
      if (box.containsPoint(position)) return true;
    }
    return false;
  }
}
