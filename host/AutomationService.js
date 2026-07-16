/**
 * AutomationService
 * -------------------
 * "Please introduce the foundations for Workshop automation... scheduled
 * tasks, background jobs, future automation rules, asset processing,
 * project maintenance, resident maintenance. The goal is simply to
 * establish the architecture. Please avoid implementing large automation
 * systems during this phase."
 *
 * **A real, if deliberately narrow, capability: task descriptors.**
 * Nothing here actually *runs* anything on a schedule — there's no timer
 * loop, no execution engine, and that's a considered choice, not a gap
 * ("avoid implementing large automation systems"). What genuinely works
 * is the *data model* a future scheduler would need: describing a task
 * (a name, a category, freeform details), listing every task currently
 * described, and cancelling one. This is real in the same limited sense
 * `PermissionsService.js`'s own grants are real — ordinary, working data,
 * honestly not yet connected to anything that acts on it.
 *
 * `scheduleTask()` deliberately does not accept a callback or a cron
 * expression — accepting either would imply this actually schedules
 * something, which it doesn't. A task descriptor is inert data until a
 * real automation engine exists to read it.
 */
export class AutomationService {
  constructor() {
    this._tasks = new Map();
    this._nextId = 1;
  }

  /** `descriptor` is `{ name, category, details }` — `category` is a
   *  free label (e.g. "asset processing", "project maintenance",
   *  "resident maintenance" — the brief's own examples), not a fixed
   *  enum, since there's no real scheduler yet to validate against.
   *  Returns the new task's id. */
  scheduleTask(descriptor) {
    const id = `task-${this._nextId++}`;
    this._tasks.set(id, { id, name: descriptor?.name ?? "Untitled task", category: descriptor?.category ?? "general", details: descriptor?.details ?? "", createdAt: new Date().toISOString() });
    return id;
  }

  listTasks() {
    return [...this._tasks.values()];
  }

  cancelTask(id) {
    return this._tasks.delete(id);
  }

  getStatus() {
    const count = this._tasks.size;
    return {
      available: false,
      summary: count > 0
        ? `${count} task descriptor${count === 1 ? "" : "s"} recorded — nothing executes them yet, this is architecture only.`
        : "Automation isn't implemented yet — this is a placeholder for a future phase.",
    };
  }
}
