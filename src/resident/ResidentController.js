import * as THREE from "three";
import { CameraSystem } from "../systems/CameraSystem.js";
import { EnvironmentSystem } from "../systems/EnvironmentSystem.js";
import { TimeOfDaySystem } from "../systems/TimeOfDaySystem.js";
import { ResidentMovement, IDLE_LOCATIONS, MIN_REST_SECONDS } from "./ResidentMovement.js";
import { ResidentRenderer } from "./ResidentRenderer.js";
import { createResidentEntity } from "./ResidentEntity.js";
import { getPersonalityModifiers } from "./ResidentContext.js";
import { isRainingNow, isGoldenHourNow, currentTimeBucket, currentWeatherId } from "./ResidentWorldSignals.js";
import { FURNITURE_LAYOUT } from "../data/layoutDefault.js";
import { AudioSystem } from "../systems/AudioSystem.js";

const EXPRESSION_CHECK_INTERVAL = 0.5; // seconds — expression/awake checks don't need to run every single frame
const FOLLOW_DISTANCE = 1.3; // metres — "Follow Me" stops closing the gap once this near, hovering companionably rather than stepping right up to the player's own eye position
const DRAG_LOOK_COS_THRESHOLD = Math.cos((10 * Math.PI) / 180); // ~10° cone — a little more forgiving than the interaction one, since grabbing hold of something is a coarser gesture than a precise "talk to this" click
const DRAG_REACH = 3; // metres — how far away Bubble can be and still be grabbed
const DRAG_DISTANCE = 1.4; // metres in front of the camera Bubble is held at while dragged
const PATTERN_SAMPLE_INTERVAL = 25; // seconds — how often player-position/preference affinity samples are taken; deliberately infrequent, this is about long-run patterns, not a live tracker
const MOOD_DRIFT_MIN_SECONDS = 120; // "medium-term emotional state" — mood reconsiders itself every couple of minutes, not every frame
const MOOD_DRIFT_MAX_SECONDS = 300;
const MOOD_CANDIDATES = ["neutral", "curious", "happy", "excited"]; // "sleeping"/"thinking" are always situational, never a resting mood; see ResidentBehaviour.computeExpression's own priority order. "excited"'s own base weight is deliberately small (see _maybeDriftMood()) — rare by default, more common only when a resident's own dials actually lean that way.
const BEING_AWARENESS_RADIUS = 4; // metres — "who they spend time near," not "who is anywhere in the Workshop" — roughly the same generous, comfortable radius PlayerPatternMemory.js's own zones already use

/**
 * ResidentController
 * ---------------------
 * "This is not an AI assistant. It is the Workshop's first resident." The
 * one engine system that makes the others (`ResidentMovement`,
 * `ResidentBehaviour`, `ResidentRenderer`) actually happen every frame —
 * itself owning as little logic as possible, mostly just reading one
 * system's output and feeding it into the next: player distance into
 * `ResidentBehaviour.update()`, its own `awarenessBlend` into the look
 * target `ResidentRenderer.update()` receives, `ResidentConnection.isAwake`
 * into both `ResidentBehaviour.computeExpression()` and
 * `ResidentRenderer.setAwake()`.
 *
 * **Version 2 additions** follow the exact same "read one thing, feed it
 * onward" shape rather than growing this file into a second behaviour
 * system of its own:
 *   - **Personality traits** (`ResidentTraits.getTraitModifiers()`) are
 *     read once per profile change (`_onProfileChanged()`, below), cached,
 *     and simply handed to `ResidentMovement`/blended into player
 *     distance — this file doesn't know what "curious" means, only that
 *     some profile produced a rest-duration multiplier and an awareness
 *     multiplier.
 *   - **Preferences and behaviour memory** (`ResidentPreferences`,
 *     `PlayerPatternMemory`) are sampled on a slow timer
 *     (`_maybeSamplePatterns()`) — a plain bump on each, no interpretation
 *     happening here either.
 *   - **Mood** (`_maybeDriftMood()`) is a slow, weighted reconsideration of
 *     `ResidentState.mood` — medium-term, distinct from the momentary
 *     "emotion" `ResidentBehaviour.triggerEmotion()` handles (that's
 *     called from `ResidentConversation.js`, at the one moment — opening
 *     a conversation — where a short-term reaction actually makes sense).
 *
 * "The resident should exist inside the Workshop at all times... when
 * the player enters the Workshop the resident should already be
 * present." There's no spawn/despawn logic anywhere in this file — the
 * resident is created once in `init()`, exactly like every piece of
 * furniture, and simply exists for the rest of the session.
 *
 * **Dragging** — "look directly at Bubble, click and hold, drag Bubble
 * naturally through 3D space, release anywhere" — is handled entirely
 * through raw mouse-button events (`pointerdown`/`pointerup` on the
 * canvas), deliberately never touching the "interact" key/action Talk
 * already uses. `InteractionSystem.js`'s own pipeline fires `onInteract`
 * immediately on key-down, with no way to tell a quick press from the
 * start of a hold before it's already happened — routing dragging
 * through an entirely separate input (the mouse button, not a bound
 * game action) sidesteps that rather than complicating the shared
 * interaction system for one object's own special case. While dragging,
 * Bubble is held at a fixed distance in front of the camera and eased
 * toward wherever the player is currently looking, not warped there
 * instantly — "gently reposition," not teleport. Releasing simply stops
 * moving it — `ResidentMovement`'s own `currentPosition` (and
 * `ResidentState`'s persisted copy) already reflect wherever it was
 * let go, so "the next time it chooses to move, it should simply
 * continue from the nearest point" is true with no special-casing at
 * all: the next wander target is chosen relative to the resident's own
 * current position exactly like any other time.
 */
export class ResidentController {
  constructor({ residentState, residentBehaviour, residentConnection, residentProfileStore, expressionSetStore = null, residentPreferences = null, playerPatternMemory = null, musicSystem = null }) {
    this.residentState = residentState;
    this.residentBehaviour = residentBehaviour;
    this.residentConnection = residentConnection;
    this.residentProfileStore = residentProfileStore;
    this.expressionSetStore = expressionSetStore;
    this.residentPreferences = residentPreferences;
    this.playerPatternMemory = playerPatternMemory;
    this.musicSystem = musicSystem;
    this._wasAwake = null; // null so the very first frame always applies the correct awake/asleep visual, rather than assuming
    // Sound & Presence phase — see _maybeAnnounceThinking()'s own comment.
    this._wasThinking = false;
    this._expressionTimer = 0;
    this._patternTimer = PATTERN_SAMPLE_INTERVAL;
    this._moodTimer = MOOD_DRIFT_MIN_SECONDS + Math.random() * (MOOD_DRIFT_MAX_SECONDS - MOOD_DRIFT_MIN_SECONDS);
    this._traitModifiers = { restDurationMultiplier: 1, awarenessRadiusMultiplier: 1, locationWeights: {}, expressionBias: {}, movementSpeedMultiplier: 1, motionDamping: 1, favouriteLocationPullMultiplier: 1, conversationStyleLine: null };
    this._playerPos = new THREE.Vector3();
    this._dragging = false;
    this._dragTarget = new THREE.Vector3();
    this._scratchForward = new THREE.Vector3();
    this._scratchDirection = new THREE.Vector3();
    // "Stay Here, Follow Me, Return Home" (Bubble Phone app) — null is
    // ordinary autonomous wandering, "stay" simply skips ever picking a
    // new idle destination, "follow" steps toward the player every frame
    // instead. Return Home isn't a persistent mode at all — see
    // returnHome() below. "goto" is Version 3, Phase 8b's own addition —
    // see goTo() below.
    this.playerCommand = null; // null | "stay" | "follow" | "goto"
    this._goToTarget = null; // THREE.Vector3 — only set while playerCommand === "goto"
  }

  init(engine) {
    this.engine = engine;
    this._cameraSystem = engine.getSystem(CameraSystem);
    this._environmentSystem = engine.getSystem(EnvironmentSystem);
    this._timeOfDaySystem = engine.getSystem(TimeOfDaySystem);

    if (!this.residentState.idleLocationId) this.residentState.setIdleLocation(IDLE_LOCATIONS[0].id);
    // "Reloading the Workshop should restore the resident naturally to
    // where it was when the player last left" — passing the persisted
    // position resumes it exactly there (including mid-travel) rather
    // than snapping to idleLocationId's own fixed point; see
    // ResidentMovement.js's own constructor comment.
    this.movement = new ResidentMovement(this.residentState.idleLocationId, this.residentState.currentPosition);
    this.renderer = new ResidentRenderer(this.residentProfileStore.getActive()?.embodiment);
    createResidentEntity({ engine, root: this.renderer.root });

    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerUp = () => this._stopDragging();
    engine.canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointerup", this._onPointerUp);

    // "Behaviour settings should now genuinely influence Bubble" — traits
    // and embodiment both live on the active profile, so both need
    // refreshing whenever it changes, not just once at startup.
    this._offResidentsChanged = this.residentProfileStore.events.on("residents:changed", () => this._onProfileChanged());
    // Workshop Personality phase — editing the *contents* of the
    // currently-active Expression Set (drawing a new pixel expression in
    // the Expression Creator, say) doesn't change which profile is
    // active, so it wouldn't otherwise trigger "residents:changed" at
    // all — this is the one further place a live update needs to come
    // from, reusing the identical "just recompute _onProfileChanged()"
    // response either event already gets.
    this._offExpressionSetsChanged = this.expressionSetStore?.events.on("expressionSets:changed", () => this._onProfileChanged());
    this._onProfileChanged();

    // "Bubble should begin feeling like an independent resident...
    // continue moving between favourite locations... arrive at a
    // believable location when the Workshop loads." See
    // _applyContinuity()'s own comment for the actual reasoning.
    engine.events.on("world:continuity", (continuity) => this._applyContinuity(continuity));
  }

  /** Refreshes everything that depends on *which* profile is currently
   *  active, and on that profile's own traits/dials/embodiment — called
   *  once at startup and again every time `ResidentProfileStore` reports
   *  a change (a new active profile, or an edit to the current one's
   *  traits, behaviour dials, or embodiment in Mission Control).
   *  `getPersonalityModifiers()` (see `ResidentContext.js`) combines both
   *  personality sources — discrete traits and the continuous behaviour
   *  dials added this phase — into the one modifier object every method
   *  below reads from; neither this file nor `ResidentMovement.js` needs
   *  to know which source produced which number. */
  _onProfileChanged() {
    const profile = this.residentProfileStore.getActive();
    if (!profile) return;
    this._traitModifiers = getPersonalityModifiers(profile);
    this.movement?.setRestDurationMultiplier(this._traitModifiers.restDurationMultiplier);
    this.movement?.setMovementSpeedMultiplier(this._traitModifiers.movementSpeedMultiplier);
    this.movement?.setMotionDamping(this._traitModifiers.motionDamping);
    this.renderer?.setEmbodiment(profile.embodiment);
    // Workshop Personality phase — "future residents may have different
    // expression sets." "default" (or a set id that no longer resolves
    // to anything real — see ExpressionSetStore.js's own comment on why
    // that's an honest, expected possibility, not an error) both
    // correctly resolve to `null` here, which
    // `ResidentRenderer.setExpressionSet()` already treats as "use the
    // built-in procedural drawing" — no special-casing needed on this
    // side for either case.
    const expressionSet = profile.expressionSetId && profile.expressionSetId !== "default" ? this.expressionSetStore?.get(profile.expressionSetId) ?? null : null;
    this.renderer?.setExpressionSet(expressionSet);
  }

  /** "What should I have been doing while the player was away?" — not a
   *  real simulation of every idle-location hop that would have happened
   *  (the player never saw any of them, so modelling each one has no
   *  payoff), just a single, honest answer: has enough time passed that
   *  Bubble would plausibly have moved on from exactly where it was left?
   *  Below `MIN_REST_SECONDS` (the shortest it would ever actually rest
   *  somewhere), the answer is no — reopening the Workshop seconds after
   *  closing it should show Bubble exactly where it was, not somewhere
   *  new, or "nothing should feel scripted" stops being true. Past that,
   *  it picks one new idle location (never the one it was already at)
   *  and arrives there directly — no visible travel animation plays,
   *  since whatever journey led there happened while nobody was watching;
   *  only the destination needs to be believable, not the route. */
  _applyContinuity({ cappedElapsedSeconds, isFirstSession }) {
    // A brand-new resident's own light starting preference bias (see
    // ResidentPreferences.seedFromTraits' own comment) — harmless to call
    // every first session; the store itself no-ops after the first time.
    if (isFirstSession) this.residentPreferences?.seedFromTraits(this.residentProfileStore.getActive()?.traits);
    if (isFirstSession || cappedElapsedSeconds < MIN_REST_SECONDS) return;

    const currentId = this.residentState.idleLocationId;
    const candidates = IDLE_LOCATIONS.filter((loc) => loc.id !== currentId);
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? IDLE_LOCATIONS[0];
    this.residentState.setIdleLocation(next.id);
    this.movement.setDraggedPosition(next.position); // arrives directly — see comment above on why no travel animation plays
    this.movement.setDraggedLookAt(next.lookAt ?? next.position);
  }

  /** Phase 31C's own one small contribution (see docs/RESIDENT.md's "A
   *  quiet habit" section) grew into this phase's general-purpose
   *  location-weighting: window-watching during interesting weather is
   *  now one contributor among several rather than the only one —
   *  selected personality traits and behaviour dials (combined by
   *  `ResidentContext.getPersonalityModifiers()`'s own `locationWeights`),
   *  an accumulated favourite place (`ResidentPreferences.
   *  favourite("locations")`, itself scaled by the Independence dial's
   *  own `favouriteLocationPullMultiplier` — a more independent resident
   *  is pulled toward its favourite spot a little less insistently), and
   *  the music cabinet while something's actually playing all combine the
   *  same way, multiplicatively, into one weights object
   *  `ResidentMovement.maybePickNewLocation()` already knew how to
   *  accept. **Living World phase**: watching the player work (a plain
   *  proximity check, not anything the player did *to* Bubble), an
   *  active project pulling gently toward the workbench
   *  (`WorldAwareness.snapshot().activeProjects`), and a Quiet Corner
   *  pull at night all join the same mechanism, unchanged. **Atmosphere
   *  phase**: a windy day joins golden hour and rain as "worth watching
   *  from the window," and a storm specifically (not just any strong
   *  wind) adds its own pull toward the Quiet Corner — sheltering,
   *  reusing the exact pull night already established rather than a new
   *  one. "Everything should quietly observe, remember and respond" is
   *  true here by simply adding more real signals into a merge function
   *  that already existed, not a new decision system layered on top of
   *  it. Still never guaranteed, never scripted — an ordinary weighted
   *  pick among idle locations that already exist either way.
   *  **Version 2 Sign-Off phase — "One Contribution":** the wall clock's
   *  own hourly chime joins the same mechanism, the same way — see the
   *  comment on the check itself, just below. */
  _windowWatchWeights() {
    const weights = {};
    const merge = (extra) => {
      for (const [locId, weight] of Object.entries(extra)) weights[locId] = (weights[locId] ?? 1) * weight;
    };

    if (this._environmentSystem && this._timeOfDaySystem) {
      const worthWatching = isRainingNow(this._environmentSystem) || isGoldenHourNow(this._timeOfDaySystem) || this._environmentSystem.current === "windy";
      if (worthWatching) merge({ lookingOutWindow: 4 });
    }

    // Version 2 Sign-Off phase — "One Contribution." The wall clock
    // (Decorative Details phase) and its own hourly chime (Sound &
    // Presence phase) have coexisted with Bubble's own wandering since
    // each was built, without ever once acknowledging one another —
    // exactly the kind of already-real, already-meaningful signal this
    // method already exists to fold in. A gentle pull toward the clock
    // within a few minutes either side of the hour turning over, the
    // same "usually random, occasionally shaped by something real"
    // texture every other signal here already has. Never guaranteed —
    // Bubble might be anywhere else entirely when the chime actually
    // sounds — but on the times it does land here, a resident already
    // looking at the clock right as it chimes reads as attention, not
    // choreography; nothing new was built to make it *possible* for the
    // two to line up, only newly *likely* to, sometimes.
    if (this._timeOfDaySystem) {
      const minutesIntoHour = (this._timeOfDaySystem.currentTime % 1) * 60;
      if (minutesIntoHour < 4 || minutesIntoHour > 56) merge({ besideClock: 3 });
    }

    // "Residents should naturally respond to... wind... environmental
    // conditions." Not fear, just the same unhurried preference for
    // something calmer that already pulls the resident to the Quiet
    // Corner at night (below), now also triggered by weather worth
    // sheltering from — a real named state (`storm`), not an arbitrary
    // wind-speed threshold invented for this.
    if (this._environmentSystem?.current === "storm") merge({ besideQuietCorner: 1.6 });

    merge(this._traitModifiers.locationWeights);

    const favouriteLocation = this.residentPreferences?.favourite("locations");
    if (favouriteLocation) merge({ [favouriteLocation]: 1.8 * (this._traitModifiers.favouriteLocationPullMultiplier ?? 1) });

    if (this.musicSystem?.isPlaying) merge({ byMusicPlayer: 1.6 });

    // "A resident watching the player work." A plain proximity check
    // against the same real furniture positions `PlayerPatternMemory.js`'s
    // own zones already use — the player doesn't need to be doing
    // anything in particular, just genuinely standing there, the same
    // "quiet noticing, not a scripted reaction" the whole phase asks for.
    const playerPos = this._cameraSystem?.position;
    if (playerPos) {
      if (this._nearFurniture(playerPos, FURNITURE_LAYOUT.computerDesk.position, 2.4)) merge({ besideComputer: 3 });
      else if (this._nearFurniture(playerPos, FURNITURE_LAYOUT.workbench.position, 2.4)) merge({ aboveWorkbench: 3 });
    }

    // "Remaining near ongoing projects." An active project (Workshop's
    // own Notebook status, not anything Bubble was told directly) pulls
    // gently toward the workbench, the same way a favourite location
    // already does — never a guarantee, just one more real signal in the
    // same weighted pick.
    if ((this.worldAwareness?.snapshot().activeProjects.length ?? 0) > 0) merge({ aboveWorkbench: 2 });

    // "Becoming quieter at night." Not a movement-speed change (which
    // risks fighting with the trait/dial multipliers already applied
    // elsewhere) — a gentle pull toward the Quiet Corner specifically,
    // the one idle spot already named for exactly this.
    if (currentTimeBucket(this._timeOfDaySystem) === "night") merge({ besideQuietCorner: 2 });

    return Object.keys(weights).length ? weights : null;
  }

  _nearFurniture(playerPos, [fx, , fz], radius) {
    return Math.hypot(playerPos.x - fx, playerPos.z - fz) <= radius;
  }

  /** "The player often builds near the workbench... usually visits in the
   *  evening... Bubble should begin developing gentle daily habits."
   *  A slow, shared timer (see `PATTERN_SAMPLE_INTERVAL`) bumps the
   *  player's own position/time-of-day pattern and Bubble's own
   *  weather/time/activity affinities together — deliberately skipped
   *  while a conversation is open, since the player is necessarily
   *  standing right next to Bubble at that moment, which would otherwise
   *  skew "where the player usually is" toward wherever Bubble happens to
   *  be idling. */
  _maybeSamplePatterns(dt) {
    this._patternTimer -= dt;
    if (this._patternTimer > 0) return;
    this._patternTimer = PATTERN_SAMPLE_INTERVAL;
    if (this.residentBehaviour.mode === "conversing") return;

    const bucket = currentTimeBucket(this._timeOfDaySystem);
    if (this._cameraSystem) this.playerPatternMemory?.sample(this._cameraSystem.position, bucket);

    const weatherId = currentWeatherId(this._environmentSystem);
    this.residentPreferences?.bump("weather", weatherId);
    this.residentPreferences?.bump("timeOfDay", bucket);
    if (this.musicSystem?.isPlaying) this.residentPreferences?.bump("activities", "listeningToMusic");
    if (this.residentState.idleLocationId === "lookingOutWindow") {
      if (isRainingNow(this._environmentSystem)) this.residentPreferences?.bump("activities", "watchingRain");
      else if (isGoldenHourNow(this._timeOfDaySystem)) this.residentPreferences?.bump("activities", "watchingTheSky");
    }

    // "Residents should become aware of one another... who they spend
    // time near." The same slow, infrequent sampling as everything else
    // in this method — a relationship is a pattern noticed over many
    // quiet moments, not something worth checking every frame.
    const bubblePos = this.movement.currentPosition;
    for (const being of this.worldAwareness?.snapshot().nearbyBeings ?? []) {
      const dx = (being.position?.[0] ?? 0) - bubblePos.x;
      const dz = (being.position?.[2] ?? 0) - bubblePos.z;
      if (Math.hypot(dx, dz) <= BEING_AWARENESS_RADIUS) this.residentPreferences?.bump("relationships", String(being.id));
    }
  }

  /** "Mood — medium-term emotional state... subtle behaviour changes are
   *  preferable to obvious state changes." A slow, weighted reconsider —
   *  never every frame, never instant — biased toward staying whatever it
   *  already is (see `weights[currentMood] *= ...` below), nudged by
   *  selected traits' own `expressionBias`, and by whether the resident's
   *  own accumulated favourite weather/time-of-day happens to match right
   *  now (a resident actually getting to enjoy a preference it's formed
   *  reads as happy, not merely neutral). */
  _maybeDriftMood(dt) {
    this._moodTimer -= dt;
    if (this._moodTimer > 0) return;
    this._moodTimer = MOOD_DRIFT_MIN_SECONDS + Math.random() * (MOOD_DRIFT_MAX_SECONDS - MOOD_DRIFT_MIN_SECONDS);

    const weights = { neutral: 2, curious: 1, happy: 1, excited: 0.4 };
    for (const [expr, bias] of Object.entries(this._traitModifiers.expressionBias)) {
      if (weights[expr] !== undefined) weights[expr] *= bias;
    }
    if (isGoldenHourNow(this._timeOfDaySystem)) weights.curious *= 1.3;
    const favouriteWeather = this.residentPreferences?.favourite("weather");
    if (favouriteWeather && favouriteWeather === currentWeatherId(this._environmentSystem)) weights.happy *= 1.5;
    const favouriteTime = this.residentPreferences?.favourite("timeOfDay");
    if (favouriteTime && favouriteTime === currentTimeBucket(this._timeOfDaySystem)) weights.happy *= 1.3;
    weights[this.residentState.mood] = (weights[this.residentState.mood] ?? 1) * 2.5; // stability — mood shouldn't flicker every reconsideration

    const picked = weightedPick(weights);
    if (picked !== this.residentState.mood) this.residentState.setMood(picked);
  }

  /** Sound & Presence phase — "Residents... Thinking... should
   *  communicate life without becoming distracting." Bubble had no audio
   *  at all before this phase — reviewed and found genuinely absent, not
   *  just quiet. A single soft cue exactly on the false→true edge of
   *  `isThinking` (never on every frame it stays true, and never on the
   *  way back to false — thinking *ending* has no equivalent moment
   *  worth marking) is the smallest possible presence this state could
   *  have: enough to notice if you're already looking at Bubble, easy to
   *  miss entirely otherwise, which is exactly the register "communicate
   *  life without becoming distracting" asks for. Uses `motion.position`
   *  — Bubble's own real, current position for this frame — for genuine
   *  distance falloff via the same mechanism every other interaction
   *  sound in the Workshop already uses. */
  _maybeAnnounceThinking(isThinking, position) {
    if (isThinking === this._wasThinking) return;
    this._wasThinking = isThinking;
    if (!isThinking) return;
    this.engine.getSystem(AudioSystem)?.playInteractionSound("residentThinking", { position });
  }

  _handlePointerDown(event) {
    if (event.button !== 0) return; // left button only
    if (!this.engine.input?.pointerLocked) return; // "using the normal interaction reticle (not mouse cursor mode)"
    if (this.residentBehaviour.mode === "conversing") return; // don't start dragging out from under an open conversation
    if (!this._isLookingAtBubble()) return;
    this._dragging = true;
  }

  _isLookingAtBubble() {
    if (!this._cameraSystem || !this.engine.camera) return false;
    const playerPos = this._cameraSystem.position;
    const bubblePos = this.movement.currentPosition;
    const dist = playerPos.distanceTo(bubblePos);
    if (dist > DRAG_REACH) return false;
    this.engine.camera.getWorldDirection(this._scratchForward);
    this._scratchDirection.subVectors(bubblePos, playerPos).normalize();
    return this._scratchDirection.dot(this._scratchForward) >= DRAG_LOOK_COS_THRESHOLD;
  }

  _stopDragging() {
    this._dragging = false;
  }

  /** "Stay Here" (Bubble Phone app) — simply stops ever picking a new
   *  idle destination; whatever it's doing right now (resting, or
   *  mid-journey) finishes naturally, it just never starts another one
   *  on its own until told otherwise. */
  stayHere() {
    this.playerCommand = "stay";
  }

  /** "Follow Me" — steps toward the player every frame (see
   *  `ResidentMovement.stepToward()`) instead of choosing its own idle
   *  destinations, stopping a comfortable distance short rather than
   *  overlapping the player. */
  followMe() {
    this.playerCommand = "follow";
  }

  /** Version 3, Phase 8b ("Bubble Gains Hands") — the one Workshop
   *  Function with no existing single-call equivalent (unlike
   *  `travelTo()`, which only ever accepts one of the fixed
   *  `IDLE_LOCATIONS`, not an arbitrary point). A one-time request, the
   *  same shape as `followMe()`: `update()`'s own "goto" branch below
   *  keeps calling `ResidentMovement.stepToward()` every frame toward
   *  `_goToTarget` until close enough to count as arrived, then clears
   *  itself back to ordinary autonomous wandering — never a *persistent*
   *  mode the way Follow Me is. */
  goTo(position) {
    this.playerCommand = "goto";
    this._goToTarget = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(position.x, position.y, position.z);
  }

  /** "Return Home" — not a persistent mode at all, just a one-time
   *  request: clears whatever command was active and starts an ordinary
   *  idle-location journey toward the very first idle location
   *  (`IDLE_LOCATIONS[0]`, "beside the computer") — after arriving, it
   *  simply resumes normal autonomous wandering, exactly like any other
   *  idle-location arrival. */
  returnHome() {
    this.playerCommand = null;
    this.movement.travelTo(IDLE_LOCATIONS[0].id);
    this.residentState.setIdleLocation(IDLE_LOCATIONS[0].id);
  }

  /** Clears Stay/Follow, returning to ordinary autonomous wandering
   *  without also forcing a trip home the way returnHome() does. */
  resumeWandering() {
    this.playerCommand = null;
  }

  update(dt) {
    if (!this.renderer) return;

    const isAwake = this.residentConnection.isAwake;
    if (isAwake !== this._wasAwake) {
      this._wasAwake = isAwake;
      this.renderer.setAwake(isAwake);
    }

    this._maybeSamplePatterns(dt);
    this._maybeDriftMood(dt);

    if (this._dragging) {
      this._updateDragging(dt);
      return;
    }

    const rawPlayerDistance = this._computePlayerDistance();
    // A trait-driven awareness-radius multiplier is applied here, on the
    // distance itself, rather than inside `ResidentBehaviour` — dividing
    // by a multiplier greater than 1 makes the player read as closer than
    // they actually are (so a "cheerful" resident notices them sooner),
    // which needed no change at all to `ResidentBehaviour`'s own fixed
    // radii.
    const playerDistance = rawPlayerDistance !== null ? rawPlayerDistance / (this._traitModifiers.awarenessRadiusMultiplier || 1) : null;
    const isConversing = this.residentBehaviour.mode === "conversing";
    if (this.playerCommand === "follow" && rawPlayerDistance !== null && rawPlayerDistance > FOLLOW_DISTANCE) {
      this.movement.stepToward(this._playerPos, dt);
    } else if (this.playerCommand === "goto" && this._goToTarget) {
      // Version 3, Phase 8b — a one-time errand, not a persistent mode:
      // once close enough to count as arrived, clears itself back to
      // null so the very next frame falls through to ordinary
      // autonomous wandering below, the same way Return Home's own
      // one-time travelTo() naturally resumes wandering on arrival.
      // Horizontal distance only, matching stepToward()'s own movement
      // (it deliberately zeroes the Y component of its own direction
      // vector) — a real bug caught in verification: a full 3D distance
      // check here could never drop below the threshold when the
      // target's own Y didn't closely match the resident's natural
      // resting height, since nothing ever moves it vertically to close
      // that gap, leaving "goto" stuck active forever.
      const dx = this._goToTarget.x - this.movement.currentPosition.x;
      const dz = this._goToTarget.z - this.movement.currentPosition.z;
      if (Math.hypot(dx, dz) < 0.15) {
        this.playerCommand = null;
        this._goToTarget = null;
      } else {
        this.movement.stepToward(this._goToTarget, dt);
      }
    } else if (!isConversing && this.playerCommand !== "stay") {
      const currentId = this.residentState.idleLocationId;
      const newId = this.movement.maybePickNewLocation(dt, currentId, this._windowWatchWeights());
      if (newId) {
        this.residentState.setIdleLocation(newId);
        this.residentPreferences?.bump("locations", newId);
      }
    }

    this.residentBehaviour.update(dt, playerDistance);

    const activeProfile = this.residentProfileStore.getActive();
    const motion = this.movement.update(dt, { thinking: this.residentBehaviour.isThinking, idleBehaviour: activeProfile?.embodiment?.idleBehaviour });
    this._maybeAnnounceThinking(this.residentBehaviour.isThinking, motion.position);
    const lookTarget = motion.lookAt.clone();
    if (rawPlayerDistance !== null) lookTarget.lerp(this._playerPos, this.residentBehaviour.awarenessBlend);

    this._syncPersistedState();
    this.renderer.update(dt, { position: motion.position, idleRotationY: motion.idleRotationY, scale: motion.scale, lookTarget });

    this._expressionTimer -= dt;
    if (this._expressionTimer <= 0) {
      this._expressionTimer = EXPRESSION_CHECK_INTERVAL;
      const expression = this.residentBehaviour.computeExpression(isAwake, this.residentState.mood);
      this.renderer.setExpression(expression);
      this.residentState.expression = expression;
    }
  }

  /** "Drag Bubble naturally through 3D space" — held at a fixed distance
   *  in front of the camera, eased toward that point rather than snapped
   *  there instantly, matching "gently reposition." Movement/idle-location
   *  logic is entirely bypassed for the duration (see `update()`'s own
   *  early return above) — a dragged Bubble isn't wandering or resting,
   *  it's being carried. */
  _updateDragging(dt) {
    if (!this.engine.input?.pointerLocked || !this.engine.camera) {
      this._stopDragging();
      return;
    }
    this.engine.camera.getWorldDirection(this._scratchForward);
    this._dragTarget.copy(this._cameraSystem.position).addScaledVector(this._scratchForward, DRAG_DISTANCE);
    this.movement.currentPosition.lerp(this._dragTarget, Math.min(1, dt * 6));
    this.movement.setDraggedPosition(this.movement.currentPosition);
    this.movement.setDraggedLookAt(this._cameraSystem.position);

    this._syncPersistedState();
    this.renderer.update(dt, {
      position: this.movement.currentPosition,
      idleRotationY: this.renderer.root.rotation.y,
      scale: new THREE.Vector3(1, 1, 1),
      lookTarget: this._cameraSystem.position,
    });
  }

  /** The plain-field persistence writes shared by both the normal update
   *  path and dragging — see ResidentState.js's own comment on why these
   *  don't emit "persistence:saveRequested" every frame, and on why
   *  facingDirection/expression/connectionState are snapshots only. */
  _syncPersistedState() {
    const p = this.movement.currentPosition;
    this.residentState.currentPosition = { x: p.x, y: p.y, z: p.z };
    this.residentState.facingDirection = this.renderer.root.rotation.y;
    this.residentState.connectionState = this.residentConnection.status;
  }

  _computePlayerDistance() {
    if (!this._cameraSystem) return null;
    this._playerPos.copy(this._cameraSystem.position);
    return this._playerPos.distanceTo(this.movement.currentPosition);
  }

  /** Workshop Diagnostics phase — "residents should expose diagnostic
   *  information... future residents should naturally inherit this
   *  architecture." One flat, plain object, read by
   *  `DiagnosticsService.js`'s own `getReport()` — every field already
   *  lived somewhere real (`residentBehaviour`/`residentState`
   *  /`residentConnection`/`movement`/the active profile); this is the
   *  first place anything asks for all of it together, the identical
   *  "nothing new computed, just gathered" shape
   *  `WorldAwareness.snapshot()` already established for "what does the
   *  world look like right now." A future second resident's own
   *  `ResidentController` instance would return the same shape from the
   *  same method — nothing here assumes there's only ever one. */
  getDiagnostics() {
    const profile = this.residentProfileStore.getActive();
    return {
      name: profile?.name ?? "Unknown",
      behaviourMode: this.residentBehaviour.mode, // "idle" | "conversing"
      isThinking: this.residentBehaviour.isThinking,
      mood: this.residentState.mood,
      expression: this.residentState.expression,
      isAwake: this.residentConnection.isAwake,
      connectionState: this.residentConnection.status,
      idleLocationId: this.residentState.idleLocationId,
      position: this.movement?.currentPosition ? { x: this.movement.currentPosition.x, y: this.movement.currentPosition.y, z: this.movement.currentPosition.z } : null,
      playerDistance: this._computePlayerDistance(),
    };
  }

  dispose() {
    this.engine.canvas.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointerup", this._onPointerUp);
    this._offResidentsChanged?.();
    this._offExpressionSetsChanged?.();
  }
}

/** A plain `{key: weight}` weighted pick — `ResidentMovement.js`'s own
 *  `randomIdleLocationId()` already has one shaped around location ids
 *  specifically; this is the same idea, generic, for `_maybeDriftMood()`'s
 *  small, fixed candidate set. Kept local rather than promoted to a
 *  shared utility since nothing else in this file's own neighbourhood
 *  needs a generic weighted pick yet — see this project's own
 *  "extend before you generalise" habit. */
function weightedPick(weights) {
  const entries = Object.entries(weights).filter(([key]) => MOOD_CANDIDATES.includes(key));
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? "neutral";
}
