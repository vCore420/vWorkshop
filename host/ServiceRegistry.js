/**
 * ServiceRegistry
 * -----------------
 * "Future services should be able to register themselves without
 * requiring modifications to existing systems." The same shape
 * `PageRegistry.js` already established for `workshop://` pages, applied
 * to Host services instead: a name maps to a service object, and nothing
 * that resolves a service (the Host Dashboard, a future automation rule)
 * needs to know the full list of what might exist ahead of time.
 *
 * A "service" here is just a plain object — `HostManager.js` doesn't
 * impose any base class or required shape beyond a service optionally
 * exposing its own `getStatus()` for the Dashboard's own "Available
 * Capabilities" listing (see `HostManager.js`'s own comment). Each
 * concrete service (`ProgramsService.js`, `FilesService.js`, and so on)
 * defines its own real shape independently; this registry only ever
 * cares about the name it's filed under.
 */
export class ServiceRegistry {
  constructor() {
    this._services = new Map();
  }

  register(name, service) {
    this._services.set(name, service);
  }

  get(name) {
    return this._services.get(name) ?? null;
  }

  has(name) {
    return this._services.has(name);
  }

  /** Every registered service name — the Host Dashboard's own "Services"
   *  section iterates this rather than hardcoding a list, so a future
   *  service (from a plugin, or a later phase) shows up there
   *  automatically the moment it registers, with no Dashboard change
   *  required. */
  list() {
    return [...this._services.keys()];
  }

  all() {
    return [...this._services.entries()].map(([name, service]) => ({ name, service }));
  }
}
