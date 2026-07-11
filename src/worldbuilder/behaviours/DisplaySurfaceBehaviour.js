import * as THREE from "three";
import { registerBehaviour } from "./registry.js";
import { ImageAssetStore } from "../../systems/ImageAssetStore.js";
import { configureFlatTexture } from "../../utils/TextureUtils.js";

/**
 * Display Surface
 * -----------------
 * "Allow any chosen face of a Builder object to display an image...
 * picture frames, posters, whiteboards, signs, computer screens,
 * decorative displays." Two properties — `partId` (which part; see
 * BuilderApp.js's own "partRef" field type, a dropdown of the object's
 * actual parts, the "any chosen face" this behaviour is named for) and
 * `imageId` (which uploaded image; see "imageRef", which also offers
 * uploading a brand new one inline).
 *
 * **"Images should be loaded from the player's local files using the
 * same design philosophy as the Music Library wherever practical."** The
 * specific piece of that philosophy this borrows: a library's own index
 * (`ImageLibraryStore.js` — names, ids) is never the same store as the
 * actual bytes (`ImageAssetStore.js` — an IndexedDB object store, the
 * same `HandleStore.js`/`TextureStore.js` split every binary asset in
 * this project already uses). One upload becomes one library entry,
 * reusable across as many Display Surfaces as anyone wants — a poster
 * uploaded once for one wall doesn't need re-uploading for a second copy
 * elsewhere.
 *
 * **"Design this behaviour so it can naturally expand... without
 * requiring architectural changes."** The image itself is applied as an
 * ordinary texture on the target part's own (cloned) material — nothing
 * here assumes a static image is the *only* thing a display surface
 * could ever show. A future version swapping in a video texture, a
 * live-rendered canvas, or a cycling slideshow only ever needs to change
 * what feeds `material.map`; the part-targeting, the property schema
 * shape, and the "any chosen face" idea this behaviour represents don't
 * change at all.
 */
registerBehaviour("displaySurface", {
  label: "Display surface",
  ownsInteractable: false,
  propsSchema: [
    { key: "partId", label: "Display on", type: "partRef", default: null },
    { key: "imageId", label: "Image", type: "imageRef", default: null },
  ],
  apply({ object3D, properties, engine }) {
    const mesh = findPart(object3D, properties.partId);
    if (!mesh || !properties.imageId) return;

    const imageAssetStore = engine.getSystem(ImageAssetStore);
    if (!imageAssetStore) return;

    // Cloned, never mutated in place — the same reasoning every other
    // behaviour that swaps a material already follows (see
    // ReflectiveBehaviour.js's own note): this part's original material
    // is very likely shared/cached, and every other object using that
    // colour must not suddenly start displaying this image too.
    const originalMaterial = mesh.material;
    const material = (Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial).clone();
    mesh.material = material;
    mesh.userData.displaySurfaceOriginalMaterial = originalMaterial;

    imageAssetStore
      .getAsImage(properties.imageId)
      .then((img) => {
        if (!img || mesh.material !== material) return; // behaviour was reconfigured or removed while this was loading
        const texture = new THREE.Texture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        configureFlatTexture(texture);
        texture.needsUpdate = true;
        material.map = texture;
        material.color.set("#ffffff"); // let the image show through at full, undamped colour
        material.needsUpdate = true;
        mesh.userData.displaySurfaceTexture = texture;
      })
      .catch((err) => console.warn(`[DisplaySurface] couldn't load image "${properties.imageId}":`, err));
  },
  dispose({ object3D, properties }) {
    const mesh = findPart(object3D, properties.partId);
    if (!mesh) return;
    mesh.userData.displaySurfaceTexture?.dispose();
    if (mesh.userData.displaySurfaceOriginalMaterial) {
      mesh.material.dispose();
      mesh.material = mesh.userData.displaySurfaceOriginalMaterial;
    }
  },
});

function findPart(object3D, partId) {
  if (!partId) return null;
  let found = null;
  object3D.traverse((child) => {
    if (!found && child.isMesh && child.userData.partId === partId) found = child;
  });
  return found;
}
