// Screenshot scenes: each one flies the real flight model forward with the
// autopilot, so a screenshot is a frame a real game actually reaches.
// ?shot=cover — mid-rally, through a ring with the runway ahead.
// ?shot=rally — low over the harbour, next ring glowing amber.
// ?shot=landing — on final approach to Runway 09.
// ?shot=tour — chase view west of the lighthouse, the tower and its amber
//   sight ring dead ahead, Old Town and the sea on the horizon behind it.
import { STEP } from './config.js';
import { EVENT_CRASH } from './flight.js';

const SCENES = {
  cover: { mission: 'rally', seconds: 22, camera: 'chase' },
  rally: { mission: 'rally', seconds: 14, camera: 'chase' },
  landing: { mission: 'landing', seconds: 5, camera: 'chase' },
  tour: { mission: 'tour', seconds: 2, camera: 'chase' },
};

export function stageShot(name, flight, renderer) {
  const scene = SCENES[name] || SCENES.cover;
  flight.reset();
  // Switch the flight to the scene's mission by rebuilding its course.
  flight.setMission(scene.mission);
  renderer.setCourse(scene.mission);
  renderer.setCameraMode(scene.camera);
  if (name === 'landing') {
    // Stage the final approach directly: on the extended centreline, west of the
    // threshold, already through the gate and lined up on Runway 09. The gate
    // sits at 80 m, so the staged approach flies at 100 m, on the glidepath.
    const s = flight.state;
    s.x = -120; s.z = 620; s.y = 100;
    s.heading = Math.PI / 2; s.pitch = -0.06; s.bank = 0;
    s.speed = 50; s.throttle = 0.6; s.onGround = false; s.airborne = true;
    s.ringsDone = 1; s.ring = null;
  }
  if (name === 'tour') {
    // Stage the harbour tour at its best vantage instead of flying 20 s out of
    // it: west of the lighthouse on its latitude, heading east, so the tower
    // and its amber sight ring sit dead ahead with Old Town and the sea behind.
    // Only 2 s of autopilot run, so the plane barely drifts from this frame.
    const s = flight.state;
    s.x = -1000; s.z = 420; s.y = 210;
    s.heading = Math.PI / 2; s.pitch = -0.02; s.bank = 0;
    s.speed = 50; s.throttle = 0.6; s.onGround = false; s.airborne = true;
  }
  // Take off (or fly on, for the staged approach), then hand the stick to the autopilot.
  for (let i = 0; i < scene.seconds / STEP; i += 1) {
    const events = flight.step(STEP, flight.autopilot());
    if (events & EVENT_CRASH) {
      window.__shotCrash = `${flight.state.crashReason} at x=${Math.round(flight.state.x)} z=${Math.round(flight.state.z)} y=${Math.round(flight.state.y)} t=${flight.state.time.toFixed(1)}`;
      flight.respawn(); break;
    }
    if (flight.state.won && name !== 'landing') break;
  }
  renderer.snapCamera(flight.state);
  return scene;
}
