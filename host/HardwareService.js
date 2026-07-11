/**
 * HardwareService
 * -----------------
 * "Future capabilities may include: USB devices, controllers, external
 * displays, IoT devices. Do not implement hardware support. Simply
 * establish a location within the architecture." This class exists so
 * `ServiceRegistry.register("hardware", ...)` has something real to
 * register, and so the Host Dashboard's "Services" list has a genuine
 * entry rather than a hardcoded placeholder row — nothing more.
 */
export class HardwareService {
  getStatus() {
    return { available: false, summary: "No hardware integration exists yet — this is a reserved location in the architecture, not a working feature." };
  }
}
