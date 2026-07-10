import * as THREE from "three";

const WANDER_MIN_REST = 4;
const WANDER_MAX_REST = 12;
const PATROL_POINT_COUNT = 4;
const OTHER_BEING_AVOID_RADIUS = 0.6;

/**
 * BeingMovementSystem
 * ----------------------
 * The Movement and Idle halves of `BeingBehaviours.js`'s own vocabulary,
 * turned into actual motion. Deliberately a set of small, stateless
 * functions rather than a class instantiated per Being — `BeingController.js`
 * owns the one small piece of *runtime* state each placed Being actually
 * needs (a wander/patrol target, a rest timer, a bob phase — none of it
 * persisted, since it's meaningless the moment the Workshop reloads
 * anyway; see `BeingInstanceStore.js`'s own comment on what *is*
 * persisted) and calls straight into these.
 *
 * "Beings should naturally avoid walls, furniture, other Beings... avoid
 * overcomplicating pathfinding." `avoidObstacles()` is a simple steering
 * nudge, not real pathfinding — a wander/patrol target is validated
 * against known collision boxes when it's first chosen (retried a few
 * times if it lands inside one), and the straight-line step toward it
 * each frame gets a small repulsion push away from anything it's
 * currently overlapping. A believable illusion of care, not a solved
 * navigation problem — a Being can still occasionally end up motionless
 * near an obstacle it can't step around, which reads as "waiting" rather
 * than as a bug.
 */

/** Picks a random point within `homeRadius` of `homePosition`, retried
 *  up to `attempts` times if the point falls inside a known collider —
 *  `colliders` is a plain array of `THREE.Box3`. Falls back to
 *  `homePosition` itself if nothing valid turns up, which simply means
 *  no visible movement that cycle rather than a crash. */
export function pickWanderTarget(homePosition, homeRadius, colliders, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * homeRadius;
    const point = new THREE.Vector3(homePosition.x + Math.cos(angle) * radius, homePosition.y, homePosition.z + Math.sin(angle) * radius);
    if (!isInsideAny(point, colliders)) return point;
  }
  return homePosition.clone();
}

/** A small, fixed loop of points around the home position — "Patrol
 *  follows a loop around its home area." Regenerated only once per
 *  instance (cached by the caller), not every cycle, so a patrol
 *  actually reads as a stable route rather than a new random walk each
 *  time it completes. */
export function buildPatrolRoute(homePosition, homeRadius, colliders) {
  const points = [];
  for (let i = 0; i < PATROL_POINT_COUNT; i++) {
    const angle = (i / PATROL_POINT_COUNT) * Math.PI * 2 + Math.random() * 0.3;
    const radius = homeRadius * (0.6 + Math.random() * 0.3);
    const point = new THREE.Vector3(homePosition.x + Math.cos(angle) * radius, homePosition.y, homePosition.z + Math.sin(angle) * radius);
    points.push(isInsideAny(point, colliders) ? homePosition.clone() : point);
  }
  return points;
}

function isInsideAny(point, colliders) {
  if (!colliders) return false;
  return colliders.some((box) => box.containsPoint(point));
}

/** A gentle push away from anything `position` currently overlaps —
 *  furniture/wall colliders and nearby other Beings alike, added to
 *  whatever direction movement was already heading. Small and continuous
 *  rather than a hard stop, so it reads as "stepping around" instead of
 *  visibly bouncing off a wall. */
export function avoidObstacles(position, colliders, otherBeingPositions) {
  const push = new THREE.Vector3();
  for (const box of colliders ?? []) {
    if (!box.containsPoint(position)) continue;
    const center = box.getCenter(new THREE.Vector3());
    push.add(position.clone().sub(center).setY(0).normalize());
  }
  for (const other of otherBeingPositions ?? []) {
    const dist = position.distanceTo(other);
    if (dist > 0 && dist < OTHER_BEING_AVOID_RADIUS) {
      push.add(position.clone().sub(other).setY(0).normalize().multiplyScalar((OTHER_BEING_AVOID_RADIUS - dist) / OTHER_BEING_AVOID_RADIUS));
    }
  }
  return push;
}

export function randomRestDuration() {
  return WANDER_MIN_REST + Math.random() * (WANDER_MAX_REST - WANDER_MIN_REST);
}

/** Idle-only procedural motion — "movement should feel relaxed rather
 *  than robotic" applies just as much standing still as it does while
 *  travelling. `idleBehaviour` only changes the *shape* of the motion
 *  (float bobs more; sit/sleep barely move at all), not whether it
 *  happens. */
export function idleMotionOffset(idleBehaviour, phase) {
  switch (idleBehaviour) {
    case "float":
      return { y: Math.sin(phase * 0.7) * 0.06, rotationY: Math.sin(phase * 0.2) * 0.15 };
    case "sleep":
      return { y: Math.sin(phase * 0.3) * 0.01, rotationY: 0 };
    case "sit":
    case "read":
      return { y: 0, rotationY: Math.sin(phase * 0.15) * 0.05 };
    case "lookAround":
      return { y: 0, rotationY: Math.sin(phase * 0.35) * 0.6 };
    default:
      return { y: Math.sin(phase * 0.5) * 0.015, rotationY: 0 };
  }
}
