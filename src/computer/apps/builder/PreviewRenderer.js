import * as THREE from "three";

/**
 * PreviewRenderer
 * -----------------
 * A small, fully self-contained Three.js scene just for previewing
 * whatever object is handed to it via `setObject()`. Deliberately
 * independent of the main Engine (its own renderer, its own
 * requestAnimationFrame loop) — the object being edited isn't part of the
 * workshop yet, so it shouldn't share the workshop's scene, camera, or
 * lighting. `dispose()` must be called when the owning tab is switched
 * away from, or this loop would keep running forever in the background.
 *
 * Originally built for the Builder app's live object preview; the
 * Wardrobe app reuses it unchanged for the character preview (see
 * `WardrobeApp.js`) — the same isolated-mini-scene need, just previewing a
 * different kind of object. `lookAtHeight`/`distance` are configurable
 * specifically so the Wardrobe can frame a person-sized figure properly;
 * their defaults are exactly the Builder's original hardcoded values, so
 * its own usage is completely unaffected.
 */
export class PreviewRenderer {
  constructor(container, { lookAtHeight = 0.3, distance = 3.2 } = {}) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "builder-preview-canvas";
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#10171a");

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
    this._theta = Math.PI * 0.25;
    this._phi = Math.PI * 0.35;
    this._distance = distance;
    this._lookAtHeight = lookAtHeight;
    this._updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight("#bcd7e6", "#2a231d", 0.7);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight("#fff2df", 1.1);
    key.position.set(2, 3, 2);
    this.scene.add(key);

    const grid = new THREE.GridHelper(4, 8, 0x3c5a53, 0x24302c);
    this.scene.add(grid);

    this.currentObject = null;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onPointerDown = (e) => { this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY; };
    this._onPointerMove = (e) => {
      if (!this._dragging) return;
      this._theta -= (e.clientX - this._lastX) * 0.008;
      this._phi = Math.max(0.15, Math.min(Math.PI - 0.15, this._phi - (e.clientY - this._lastY) * 0.008));
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._updateCameraPosition();
    };
    this._onPointerUp = () => { this._dragging = false; };
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);

    this._resize();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(container);

    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  _updateCameraPosition() {
    this.camera.position.set(
      this._distance * Math.sin(this._phi) * Math.sin(this._theta),
      this._distance * Math.cos(this._phi) + this._lookAtHeight,
      this._distance * Math.sin(this._phi) * Math.cos(this._theta)
    );
    this.camera.lookAt(0, this._lookAtHeight, 0);
  }

  _resize() {
    const w = this.container.clientWidth || 200;
    const h = this.container.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Replaces whatever's currently previewed with a freshly compiled group. */
  setObject(object3D) {
    if (this.currentObject) this.scene.remove(this.currentObject);
    this.currentObject = object3D;
    if (object3D) this.scene.add(object3D);
  }

  dispose() {
    this._running = false;
    this._resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
