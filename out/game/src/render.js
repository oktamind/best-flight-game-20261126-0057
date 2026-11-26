// The picture: sky, sun, sea fog, the island, the Kitefin-9, the glowing rings
// and a chase camera that never fights the pilot.
import * as THREE from 'three';
import { ISLAND_SIZE, RUNWAY, PALETTE, MAX_ALT } from './config.js';
import { makeIsland, buildTerrain, ringCourse } from './terrain.js';
import { buildAircraft } from './aircraft.js';

export const CAMERA_CHASE = 'chase';
export const CAMERA_COCKPIT = 'cockpit';

export function createRenderer(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyTop);
  scene.fog = new THREE.Fog(PALETTE.fog, 700, 3400);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 9000);
  camera.position.set(RUNWAY.x - 120, 40, RUNWAY.z + 60);

  // Late-afternoon sun over the sea, plus a soft sky fill.
  const sun = new THREE.DirectionalLight(0xffe6b0, 2.4);
  sun.position.set(-800, 900, -600);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe6f5, 0x3a5a3a, 1.1));

  // A big gradient sky dome, so the horizon is never a hard line.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      bottom: { value: new THREE.Color(PALETTE.skyBottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(vP.y / 4200.0 * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky-dome';
  scene.add(sky);

  // Sun disc and a few far clouds are part of the sky, not the terrain.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-2600, 1150, -2600);
  sunDisc.lookAt(camera.position);
  scene.add(sunDisc);

  const island = makeIsland(seed);
  // Seeded scatter for trees and town, separate from the island's own noise.
  let scatterState = (seed ^ 0x51ab) >>> 0;
  const scatter = {
    next() { scatterState = (scatterState * 1664525 + 1013904223) >>> 0; return scatterState / 4294967296; },
    range(min, max) { return min + (max - min) * this.next(); },
  };
  buildTerrain(scene, island, scatter);

  const plane = buildAircraft();
  scene.add(plane);

  // Rings: torus hoops with a pulsing glow sprite at the centre.
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  scene.add(ringGroup);
  let ringMeshes = [];

  function setCourse(missionId) {
    for (const mesh of ringMeshes) ringGroup.remove(mesh);
    ringMeshes = [];
    const course = ringCourse(missionId);
    course.forEach((ring, index) => {
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(24, 2.2, 10, 40),
        new THREE.MeshBasicMaterial({ color: PALETTE.ringIdle, transparent: true, opacity: 0.9 }),
      );
      hoop.position.set(ring.x, ring.y, ring.z);
      hoop.userData.index = index;
      ringGroup.add(hoop);
      ringMeshes.push(hoop);
    });
    return course;
  }

  function updateRings(state, time) {
    ringMeshes.forEach((hoop, index) => {
      const done = index < state.ringsDone;
      const next = index === state.ringsDone;
      hoop.material.color.setHex(done ? PALETTE.ringDone : next ? PALETTE.ringNext : PALETTE.ringIdle);
      hoop.material.opacity = next ? 0.95 + Math.sin(time * 4) * 0.05 : 0.75;
      // The next ring slowly turns to face the pilot, so it reads as a gate.
      hoop.lookAt(state.x, state.y, state.z);
      const s = next ? 1 + Math.sin(time * 3) * 0.04 : 1;
      hoop.scale.setScalar(s);
    });
  }

  // Chase camera: behind and above the tail, smoothed, widening with speed.
  // Cockpit camera: at the canopy, looking down the nose.
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  let cameraMode = CAMERA_CHASE;
  function updateCamera(state, dt) {
    const heading = state.heading;
    const fx = Math.sin(heading); const fz = -Math.cos(heading);
    const px = Math.sin(state.pitch);
    if (cameraMode === CAMERA_COCKPIT) {
      // At the nose, just ahead of the canopy, looking down the flight path.
      camPos.set(
        state.x + fx * 4.5, state.y + 1.1,
        state.z + fz * 4.5,
      );
      camTarget.set(state.x + fx * 60, state.y + px * 30 - 2, state.z + fz * 60);
      camera.position.copy(camPos);
      camera.lookAt(camTarget);
      camera.fov = 74;
    } else {
      const back = 20 + state.speed * 0.06;
      const up = 6.5 + state.speed * 0.02;
      camPos.set(state.x - fx * back, state.y + up - px * 6, state.z - fz * back);
      // Keep the camera out of the sea and the hills.
      const ground = island.groundHeight(camPos.x, camPos.z);
      camPos.y = Math.max(camPos.y, ground + 6);
      camera.position.lerp(camPos, Math.min(1, dt * 5));
      camTarget.set(state.x + fx * 40, state.y + px * 18, state.z + fz * 40);
      camera.lookAt(camTarget);
      camera.fov = 62 + state.speed * 0.16;
    }
    camera.updateProjectionMatrix();
    // The plane itself: position, then bank, pitch and heading as one rotation.
    // The nose points along local -Z, so the yaw is -heading: rotating (0,0,-1)
    // by -heading about Y gives (sin heading, 0, -cos heading), the flight direction.
    plane.position.set(state.x, state.y, state.z);
    plane.rotation.set(0, 0, 0);
    plane.rotateY(-heading);
    plane.rotateX(-state.pitch);
    plane.rotateZ(-state.bank);
    // Cockpit view: the pilot sits in the plane, so the plane itself stays out of shot.
    plane.visible = cameraMode !== CAMERA_COCKPIT;
    plane.userData.propeller.rotation.z += dt * (4 + state.throttle * 42);
  }

  function draw(state, time, dt) {
    updateCamera(state, dt);
    updateRings(state, time);
    renderer.render(scene, camera);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Put the camera exactly where the chase view belongs, at once — screenshots
  // paint only a couple of frames, too few for the smoothing lerp to catch up.
  function snapCamera(state) {
    const heading = state.heading;
    const fx = Math.sin(heading); const fz = -Math.cos(heading);
    const back = 20 + state.speed * 0.06;
    const up = 6.5 + state.speed * 0.02;
    camera.position.set(state.x - fx * back, state.y + up - Math.sin(state.pitch) * 6, state.z - fz * back);
    const ground = island.groundHeight(camera.position.x, camera.position.z);
    camera.position.y = Math.max(camera.position.y, ground + 6);
    camera.lookAt(state.x + fx * 40, state.y + Math.sin(state.pitch) * 18, state.z + fz * 40);
  }

  return {
    draw, resize, setCourse, island, snapCamera,
    toggleCamera() { cameraMode = cameraMode === CAMERA_CHASE ? CAMERA_COCKPIT : CAMERA_CHASE; return cameraMode; },
    cameraMode() { return cameraMode; },
    setCameraMode(mode) { cameraMode = mode; },
  };
}
