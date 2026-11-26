// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// the renderer paints what is there. Screens: title, play, paused, over.
// ?seed=N fixes the island. ?shot=cover|rally|landing|tour stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, BEST_KEY, SEED } from './config.js';
import { createRandom } from './random.js';
import { createFlight, EVENT_RING, EVENT_CRASH, EVENT_LANDED, EVENT_WIN } from './flight.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESET, ACTION_CAMERA, ACTION_FLAPS, ACTION_MUTE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;

const canvas = document.getElementById('scene');
const menu = document.getElementById('menu');
const status = document.getElementById('status');
const rand = createRandom(seed);
void rand;

const flight = createFlight(null, 'rally');
window.__skylark = flight;
// The flight needs the island before it steps; the renderer builds it.
const renderer = createRenderer(canvas, seed);
flight.setIsland(renderer.island);
renderer.setCourse('rally');

const hud = createHud();
const sound = createSound();
const input = createInput(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); }
  catch { /* storage off: the best score lasts this visit only */ }
}

let screen = 'title';
let best = readBest();
let missionId = 'rally';
let accumulator = 0;
let last = performance.now();
let muted = false;

function announce(message) { status.textContent = message; }

function startMission(id) {
  missionId = id;
  flight.setMission(id);
  renderer.setCourse(id);
  menu.style.display = 'none';
  hud.hideBanner();
  screen = 'play';
  flight.startTakeoff();
  sound.unlock();
  announce(`Flying ${flight.state.missionTitle}.`);
}

function endFlight(won) {
  screen = 'over';
  if (flight.state.score > best) { best = flight.state.score; saveBest(best); }
  const title = won ? 'COURSE COMPLETE!' : 'FLIGHT OVER';
  const sub = won
    ? `Score ${flight.state.score} · Best ${best} — press Space to fly again`
    : `${flight.state.crashReason || 'Out of fuel.'} Score ${flight.state.score} · Best ${best} — press Space to fly again`;
  hud.showBanner(title, sub);
  if (won) sound.win();
  announce(`${title} Score ${flight.state.score}.`);
}

function runShot(name) {
  menu.style.display = 'none';
  const scene = stageShot(name, flight, renderer);
  void scene;
  // Snap the instruments to the staged state first: the lag filters would
  // need seconds of frames to settle, and the shot paints only six.
  hud.snap(flight.state);
  // Paint a few frames so the camera smoothing and the HUD settle on the staged
  // scene before the screenshot is taken.
  let painted = 0;
  function paint() {
    renderer.draw(flight.state, flight.state.time || 1, STEP);
    hud.update(flight.state, STEP);
    painted += 1;
    if (painted < 6) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  document.querySelectorAll('#menu button[data-mission]').forEach((button) => {
    button.addEventListener('click', () => startMission(button.dataset.mission));
  });

  function handleActions() {
    const { actions, mission } = input.takeActions();
    if (mission) { startMission(mission); return; }
    if (actions & ACTION_MUTE) { muted = sound.toggleMute(); announce(muted ? 'Sound off.' : 'Sound on.'); }
    if (actions & ACTION_CAMERA && screen === 'play') {
      const mode = renderer.toggleCamera();
      announce(mode === 'cockpit' ? 'Cockpit view.' : mode === 'tower' ? 'Tower view.' : 'Chase view.');
    }
    if (actions & ACTION_FLAPS && screen === 'play') {
      flight.state.flaps = !flight.state.flaps;
      announce(flight.state.flaps ? 'Flaps down.' : 'Flaps up.');
    }
    if (actions & ACTION_RESET && screen !== 'title') {
      flight.respawn(); screen = 'play'; hud.hideBanner(); announce('Back on the runway.');
    }
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'over')) {
      startMission(missionId);
    } else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused'; hud.showBanner('PAUSED', 'Press P or Space to keep flying'); announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play'; hud.hideBanner(); announce('Flying.');
    }
  }

  function step() {
    const steering = input.steering();
    const events = flight.step(STEP, steering);
    if (events & EVENT_RING) sound.ring();
    if (events & EVENT_LANDED) sound.thud();
    if (events & EVENT_CRASH) { sound.crash(); endFlight(false); }
    else if (events & EVENT_WIN) endFlight(true);
    sound.setEngine(flight.state.throttle, flight.state.speed, flight.state.airborne);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    // The real frame time, not STEP: the camera smoothing in draw() must
    // converge in wall-clock time, or on a slow machine the plane outruns
    // its own chase camera and shrinks to a speck. At 60 fps this equals STEP.
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += frameDt;
    handleActions();
    if (screen === 'play') {
      while (accumulator >= STEP && screen === 'play') { step(); accumulator -= STEP; }
    } else {
      accumulator = 0;
    }
    if (screen !== 'title') {
      renderer.draw(flight.state, flight.state.time, frameDt);
      hud.update(flight.state, frameDt);
    } else {
      // Title screen: the parked plane on the strip, town behind it. The HUD
      // updates here too, or the instruments sit dead at 0 ft / 0 kt / 000°
      // with black dials until the first mission starts.
      flight.state.time += STEP;
      renderer.draw(flight.state, flight.state.time, frameDt);
      hud.update(flight.state, frameDt);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused'; hud.showBanner('PAUSED', 'Press P or Space to keep flying');
    }
  });

  announce('Skylark Island Rally. Choose a mission to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
