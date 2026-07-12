/**
 * HardwareService
 * -----------------
 * "Please begin preparing for future hardware integration... game
 * controllers, microphones, serial devices, USB devices, Bluetooth,
 * network devices, future Arduino support, future workshop hardware...
 * the architecture should be established without requiring complete
 * implementations during this phase." This class exists so
 * `ServiceRegistry.register("hardware", ...)` has something real to
 * register, and so the Host Dashboard's "Services" list has a genuine
 * entry rather than a hardcoded placeholder row — nothing more.
 *
 * `CATEGORIES` names every device class the brief lists explicitly —
 * not because each needs its own bespoke code path yet, but so a future
 * phase implementing, say, controller support specifically has an
 * obvious, already-agreed-upon name to build against rather than
 * inventing one at that point.
 */
const CATEGORIES = ["Game controllers", "Microphones", "Serial devices", "USB devices", "Bluetooth", "Network devices", "Arduino", "Future Workshop hardware"];

export class HardwareService {
  categories() {
    return [...CATEGORIES];
  }

  getStatus() {
    return { available: false, summary: `No hardware integration exists yet — reserved categories: ${CATEGORIES.join(", ")}. This is a location in the architecture, not a working feature.` };
  }
}
