// Flight model and missions: the rules, not the pictures. One fixed step, so the
// autopilot, the screenshots and a real player all fly the same aeroplane.
import { PLANE, RUNWAY, MISSIONS, MAX_ALT } from './config.js';
import { ringCourse } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_WIN = 8;
export const EVENT_FUEL_EMPTY = 16;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export function createFlight(island, missionId) {
  let islandRef = island;
  let mission = MISSIONS[missionId] || MISSIONS.rally;
  let course = ringCourse(missionId);
  const state = freshState();
  let events = 0;

  function setIsland(next) { islandRef = next; }
  function setMission(id) {
    mission = MISSIONS[id] || MISSIONS.rally;
    course = ringCourse(mission.id);
    const keep = state.best;
    Object.assign(state, freshState());
    state.best = keep;
  }

  function freshState() {
    return {
      missionId: mission.id, missionTitle: mission.title,
      // Parked on the strip itself, 40 m past the western threshold, heading east.
      // y is the strip's ground (2.2 m) plus the gear height (2.4 m): exactly on
      // the ground, or the first step reads the parked plane as airborne.
      x: RUNWAY.x - RUNWAY.length / 2 + 40, z: RUNWAY.z, y: 4.6,
      heading: RUNWAY.heading * Math.PI / 180, pitch: 0, bank: 0,
      speed: 0, throttle: 0, fuel: PLANE.startFuel,
      flaps: false, onGround: true, airborne: false,
      ringIndex: 0, score: 0, ringsDone: 0, time: 0, best: 0,
      damage: 0, landed: false, won: false, crashed: false, crashReason: '',
      stalled: false, message: mission.intro, messageTime: 0,
      ring: course[0], course,
    };
  }

  function reset() {
    const keep = state.best;
    Object.assign(state, freshState());
    state.best = keep;
  }

  function startTakeoff() {
    state.message = 'Full throttle, ease back on the stick at 45 knots.';
    state.messageTime = 4;
  }

  // Steering input: pitch -1..1 (pull up positive), roll -1..1, throttle 0..1 target.
  function step(dt, input) {
    if (state.won || state.crashed) return 0;
    events = 0;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    // Throttle and fuel.
    state.throttle = clamp(state.throttle + (input.throttleTarget - state.throttle) * Math.min(1, dt * 2.2), 0, 1);
    if (state.fuel > 0) state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * state.throttle * dt);
    if (state.fuel <= 0 && state.throttle > 0.15) {
      state.throttle = Math.max(0.15, state.throttle - dt * 0.2);
      events |= EVENT_FUEL_EMPTY;
    }

    // Speed: thrust minus drag, plus a little help from a dive, minus a climb's cost.
    const targetSpeed = PLANE.cruiseSpeed * (0.25 + 0.75 * state.throttle) * (state.flaps ? 0.82 : 1);
    let accel = (targetSpeed - state.speed) * 0.35;
    accel += -Math.sin(state.pitch) * 9 * dt * 60 * 0.016;
    state.speed = clamp(state.speed + accel * dt, 0, PLANE.maxSpeed);
    state.stalled = !state.onGround && state.speed < PLANE.minFlySpeed;

    // Attitude: stick moves pitch and bank toward the commanded values.
    const pitchTarget = clamp(input.pitch, -1, 1) * 0.5;
    const bankTarget = clamp(input.roll, -1, 1) * 1.1;
    state.pitch += (pitchTarget - state.pitch) * Math.min(1, dt * PLANE.pitchRate * 2.4);
    state.bank += (bankTarget - state.bank) * Math.min(1, dt * PLANE.rollRate * 1.6);
    // A banked wing turns the nose; a stalled wing drops it.
    state.heading = wrapAngle(state.heading + state.bank * PLANE.turnFromBank * dt * (state.stalled ? 0.4 : 1));
    if (state.stalled) state.pitch = Math.max(state.pitch - dt * 0.5, -0.6);

    // Climb and sink: pitch trades speed for height; flaps add lift low and slow.
    const lift = state.onGround ? 0 : Math.sin(state.pitch) * state.speed * PLANE.climbFromPitch;
    const sink = state.stalled ? -14 : -1.2;
    let vertical = lift + (state.speed < PLANE.minFlySpeed && !state.onGround ? sink : 0);
    if (state.flaps && state.speed > 18) vertical += 1.5;

    // Move.
    const forward = state.speed * dt;
    state.x += Math.sin(state.heading) * Math.cos(state.pitch) * forward;
    state.z += -Math.cos(state.heading) * Math.cos(state.pitch) * forward;
    state.y += vertical * dt;
    if (state.y > MAX_ALT) { state.y = MAX_ALT; state.pitch = Math.min(state.pitch, 0); }

    // Ground: rolling on the strip, or a landing, or a crash.
    const ground = islandRef.groundHeight(state.x, state.z);
    const overRunway = Math.abs(state.z - RUNWAY.z) < RUNWAY.width / 2 + 6
      && Math.abs(state.x - RUNWAY.x) < RUNWAY.length / 2 + 30;
    state.peakAboveGround = Math.max(state.peakAboveGround || 0, state.y - ground);
    if (state.y <= ground + 2.4) {
      state.y = ground + 2.4;
      if (!state.onGround) {
        // Touchdown: judge it like a landing — but only when the plane really
        // flew (a fast roll on the strip is a take-off roll, not 500 landings).
        const sinkRate = -vertical;
        const aligned = Math.abs(wrapAngle(state.heading - RUNWAY.heading * Math.PI / 180)) < 0.35;
        const realFlight = state.airborne && (state.peakAboveGround || 0) > 15;
        if (!realFlight) {
          state.onGround = true; state.airborne = false;
        } else if (overRunway && sinkRate < 6 && Math.abs(state.bank) < 0.35 && aligned && state.speed < 55) {
          state.onGround = true; state.airborne = false;
          state.landed = true;
          state.score += Math.round(500 - sinkRate * 40 - Math.abs(state.bank) * 100);
          state.message = sinkRate < 3 ? 'Butter-smooth touchdown!' : 'Down — a firm one, but she is in one piece.';
          state.messageTime = 5;
          events |= EVENT_LANDED;
          if (state.missionId === 'landing') { state.won = true; events |= EVENT_WIN; }
        } else {
          return crash(overRunway ? 'You ran off the runway.' : 'You hit the ground.');
        }
        state.peakAboveGround = 0;
      }
      state.onGround = true;
      // Rotate: lift off only when the pilot actually pulls back on the stick.
      // (Checked before the ground zeroes the pitch — a parked plane's pitch
      // is 0, and zeroing it first would make rotation impossible.)
      const rotating = state.speed > 38 && state.throttle > 0.6 && state.pitch > 0.08;
      if (state.speed < 20) state.pitch = 0;
      state.bank *= 0.85;
      // Rolling: friction bleeds speed unless the throttle holds it, and rough
      // grass past the strip's end bleeds it fast — a failed take-off stops.
      state.speed = Math.max(0, state.speed - (state.throttle < 0.3 ? 14 : -2) * dt);
      if (!overRunway) state.speed = Math.max(0, state.speed - 25 * dt);
      if (rotating) {
        state.onGround = false; state.airborne = true; state.peakAboveGround = 0;
      }
    } else {
      state.onGround = false;
      if (state.y > ground + 4) state.airborne = true;
    }

    // Out of the island: turn the pilot back with a warning, not a wall.
    if (Math.hypot(state.x, state.z) > 1900) {
      state.message = 'You are leaving Coral Island — turn back!';
      state.messageTime = 2;
    }

    // Rings: fly through the centre and the ring counts.
    const ring = state.ring;
    if (ring && !state.won) {
      const dx = state.x - ring.x; const dy = state.y - ring.y; const dz = state.z - ring.z;
      if (Math.hypot(dx, dy, dz) < 26) {
        state.ringsDone += 1;
        state.score += state.missionId === 'landing' ? 200 : 250;
        state.fuel = Math.min(100, state.fuel + PLANE.fuelPerRing);
        state.message = state.missionId === 'tour'
          ? `Sight seen: ${ring.name} — ${state.ringsDone} of ${course.length}`
          : `Ring ${state.ringsDone} of ${course.length}!`;
        state.messageTime = 3;
        events |= EVENT_RING;
        if (state.ringsDone >= course.length) {
          state.won = true; events |= EVENT_WIN;
          state.score += Math.max(0, Math.round(1000 - state.time * 2));
          state.message = state.missionId === 'tour'
            ? 'Tour complete! Now bring her home to Runway 09.'
            : 'Course complete! Fly home to Runway 09 to finish.';
          state.messageTime = 6;
        } else {
          state.ring = course[state.ringsDone];
        }
      }
    }

    // Low-altitude warning over land (not while rolling on the strip).
    if (!state.onGround && state.airborne && state.y - ground < 25 && state.speed > 30) {
      state.message = 'PULL UP — terrain!';
      state.messageTime = 1;
    }
    return events;
  }

  function crash(reason) {
    state.crashed = true; state.crashReason = reason;
    state.score = Math.max(0, state.score - 150);
    state.message = `${reason} Press R to fly again.`;
    state.messageTime = 8;
    return EVENT_CRASH;
  }

  function respawn() {
    const keep = state.best; const score = state.score;
    Object.assign(state, freshState());
    state.best = Math.max(keep, score);
    state.message = 'Back on Runway 09. Full throttle and go again.';
    state.messageTime = 4;
  }

  // A simple autopilot for screenshots and the demo: steer at the next ring,
  // or at the runway threshold when the course is done. It climbs straight
  // ahead first — banking hard at low altitude toward a ring behind the
  // take-off direction is how a screenshot ends in a hillside.
  function autopilot() {
    const target = state.won || !state.ring
      ? { x: RUNWAY.x - RUNWAY.length / 2, y: 120, z: RUNWAY.z }
      : state.ring;
    const dx = target.x - state.x; const dz = target.z - state.z;
    const wantHeading = Math.atan2(dx, -dz);
    const headingError = wrapAngle(wantHeading - state.heading);
    const wantAlt = Math.max(target.y, state.onGround ? 180 : target.y);
    const altError = wantAlt - state.y;
    // Gentle bank while low or while the turn is a big one; full bank only
    // once the plane is high and the ring is roughly ahead.
    const bankLimit = state.y < 120 || Math.abs(headingError) > 1 ? 0.45 : 0.9;
    // Terrain clearance beats the ring's altitude: climb hard while the
    // ground is close underneath, whatever the target height says.
    const clearance = state.y - islandRef.groundHeight(state.x, state.z);
    const pitch = clearance < 50 ? 0.8 : clamp(altError / 40, -0.7, 0.7);
    return {
      pitch,
      roll: clamp(headingError * 1.2, -bankLimit, bankLimit),
      throttleTarget: state.onGround || clearance < 50 ? 1 : (state.speed < 55 ? 0.9 : 0.65),
    };
  }

  return { state, reset, step, respawn, autopilot, startTakeoff, setIsland, setMission, mission };
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function headingDegrees(heading) {
  const deg = Math.round(((heading * 180) / Math.PI) % 360);
  return ((deg % 360) + 360) % 360;
}
