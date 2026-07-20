import * as THREE from "three";
import { clamp } from "../../../utils/MathUtils.js";

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
 * Wardrobe app (`WardrobeApp.js`) and the Animation Editor
 * (`AnimationEditorApp.js`) both reuse it unchanged for their own
 * preview panes — the same isolated-mini-scene need, just previewing a
 * different kind of object each time. `lookAtHeight`/`distance` are
 * configurable specifically so the Wardrobe can frame a person-sized
 * figure properly; their defaults are exactly the Builder's original
 * hardcoded values, so its own usage is completely unaffected. Orbit
 * (drag) and zoom (scroll, bounded to a sensible range around the
 * starting `distance`) are both supported; every caller gets both for
 * free.
 *
 * **Version 3, Phase 10c ("Being Creator, Beyond the Prototype, Wave 2")
 * — click-to-select, opt-in.** `setOnObjectClick(handler)` is the whole
 * addition: nothing calls it automatically, so nothing changes for
 * Builder, Wardrobe, or the Animation Editor unless one of them
 * explicitly wires it in later — only `BeingCreatorApp.js` does today.
 * A "click" is distinguished from the same
 * pointer sequence orbit already uses by total movement between
 * pointerdown and pointerup — under `CLICK_DRAG_THRESHOLD_PX`, it's a
 * click; over it, it was always an orbit drag, so a person dragging the
 * view around never accidentally re-selects whatever's under their
 * cursor when they release the mouse. Only ever raycasts against
 * `currentObject` — whatever's actually being previewed — and only ever
 * resolves to a mesh carrying `userData.partId`, so a marker/helper mesh
 * a caller has added for its own purposes (a joint indicator, say) is
 * never mistaken for a genuine, selectable part.
 */
const CLICK_DRAG_THRESHOLD_PX = 4;
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
    this._onObjectClick = null;
    this._raycaster = new THREE.Raycaster();

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._downX = 0;
    this._downY = 0;
    this._onPointerDown = (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._downX = e.clientX;
      this._downY = e.clientY;
    };
    this._onPointerMove = (e) => {
      if (!this._dragging) return;
      this._theta -= (e.clientX - this._lastX) * 0.008;
      this._phi = clamp(this._phi - (e.clientY - this._lastY) * 0.008, 0.15, Math.PI - 0.15);
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._updateCameraPosition();
    };
    this._onPointerUp = (e) => {
      this._dragging = false;
      if (!this._onObjectClick) return;
      if (Math.hypot(e.clientX - this._downX, e.clientY - this._downY) > CLICK_DRAG_THRESHOLD_PX) return; // an orbit drag, not a click
      this._handleClick(e);
    };
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);

    // Zoom — bounded so you can't scroll the object out of view entirely,
    // or so close the near clip plane starts cutting through it.
    this._minDistance = distance * 0.35;
    this._maxDistance = distance * 3;
    this._onWheel = (e) => {
      e.preventDefault();
      this._distance = clamp(this._distance + e.deltaY * 0.003 * this._distance, this._minDistance, this._maxDistance);
      this._updateCameraPosition();
    };
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false });

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

  /** `handler(mesh)` fires on a genuine click (not an orbit drag — see
   *  this class's own module comment) against `currentObject`. `mesh` is
   *  the first intersected `THREE.Mesh` carrying `userData.partId`, or
   *  `null` for a click that hit nothing selectable (empty space, or
   *  only non-part helper meshes) — a caller typically treats `null` as
   *  "deselect." Pass `null` to remove a previously-set handler. */
  setOnObjectClick(handler) {
    this._onObjectClick = handler;
  }

  _handleClick(e) {
    if (!this.currentObject) {
      this._onObjectClick(null);
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pointer = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
    this._raycaster.setFromCamera(pointer, this.camera);
    const hit = this._raycaster.intersectObject(this.currentObject, true).find((i) => i.object.isMesh && i.object.userData?.partId);
    this._onObjectClick(hit ? hit.object : null);
  }

  dispose() {
    this._running = false;
    this._resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
