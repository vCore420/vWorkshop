/**
 * AutomationService
 * -------------------
 * "This may simply exist as a placeholder for now. Future
 * responsibilities include: scheduled actions, local automation,
 * Workshop tasks, AI initiated actions." Exactly that — a placeholder,
 * not a working scheduler. `docs/AI.md`'s own Memory Configuration
 * "architecture, not implementation" framing applies just as much here;
 * the difference is Memory at least has a defined shape already
 * (`MemoryConfiguration.js`) to hang UI on, where Automation doesn't yet
 * have enough of a design to justify inventing one prematurely.
 */
export class AutomationService {
  getStatus() {
    return { available: false, summary: "Automation isn't implemented yet — this is a placeholder for a future phase." };
  }
}
