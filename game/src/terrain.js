// Coral Island: one seeded heightfield, a sea, a beach, a town, a runway and the
// clouds above it. groundHeight is the single source of truth — flight, the
// renderer and the autopilot all ask it how high the ground is here.
import * as THREE from 'three';
import { ISLAND_SIZE, RUNWAY, PALETTE } from './config.js';
import { createNoise } from './random.js';

const HALF = ISLAND_SIZE / 2;
const SEA_Y = 0.4;

export function makeIsland(seed) {
  const noise = createNoise(seed);
  // Distance from the runway rectangle, for the flattened airfield: weight 1
  // on the strip itself, fading to 0 three hundred metres out, so the strip,
  // its lights and the town's edge all sit on level ground and the runway is
  // never buried by a hill at its ends.
  function runwayFalloff(x, z) {
    const dx = Math.max(Math.abs(x - RUNWAY.x) - RUNWAY.length / 2, 0);
    const dz = Math.max(Math.abs(z - RUNWAY.z) - RUNWAY.width / 2, 0);
    const d = Math.hypot(dx, dz);
    return Math.max(0, 1 - d / 300);
  }
  // Final-approach corridor: keep the glidepath west of Runway 09 clear, so a
  // landing flown through the gate meets flat ground, not a hillside. The
  // hills right before the threshold peak near 80 m, and the touchdown sink
  // limit (6 m/s) leaves no descent that clears them — so the corridor is
  // fully flat from 350 m west of the threshold to the strip, fading back to
  // the hills over the next 250 m west and 90 m either side of the centreline.
  // It reads as the flat valley the airfield was built in.
  function approachFalloff(x, z) {
    const west = RUNWAY.x - RUNWAY.length / 2 - x;
    if (west < 0) return 0;
    const along = west <= 350 ? 1 : Math.max(0, 1 - (west - 350) / 250);
    const across = Math.max(0, 1 - Math.abs(z - RUNWAY.z) / 90);
    return along * across;
  }
  function groundHeight(x, z) {
    const r = Math.hypot(x, z) / HALF;
    if (r >= 1.15) return -6; // open sea floor, far out
    const coast = Math.max(0, 1 - Math.pow(Math.max(0, r - 0.72) / 0.28, 2));
    const hills = noise(x / 260 + 7, z / 260 + 3) * 0.65 + noise(x / 90 + 31, z / 90 + 17) * 0.35;
    // Hills stay low enough that a climbing prop plane can always clear them:
    // the island tops out near 170 m, the rings fly at 180–300 m.
    let h = 4 + hills * hills * 115 * coast;
    // A ridge along the north-west, so the island reads as land from the air.
    const ridge = Math.max(0, 1 - Math.hypot(x + 620, z - 620) / 520);
    h += ridge * ridge * 70;
    // Beach ring where the land meets the sea.
    if (r > 0.86 && h < 9) h = Math.max(h, 3.2);
    // Flatten the airfield so the runway sits on level ground, and the final
    // approach corridor with it — the gate is the start of the landing, not
    // a hillside to crash into on the way down.
    const flat = Math.max(runwayFalloff(x, z), approachFalloff(x, z));
    return h * (1 - flat) + 2.2 * flat;
  }
  return { groundHeight, noise };
}

// Ring courses: rally threads the island, the tour visits the sights, the landing
// mission has one gate on final approach to Runway 09.
export function ringCourse(missionId) {
  if (missionId === 'tour') {
    return [
      { x: -760, z: 420, y: 150, name: 'Lighthouse Point' },
      { x: -420, z: 760, y: 120, name: 'Harbour' },
      { x: 240, z: 880, y: 110, name: 'Coral Beach' },
      { x: 620, z: 620, y: 140, name: 'Old Town' },
      { x: -620, z: -620, y: 260, name: 'Ridge Pass' },
    ];
  }
  if (missionId === 'landing') {
    // Final Gate: 660 m west of the threshold at 80 m — a real final-approach
    // fix. The old gate (620 m out at 150 m) was unflyable: no descent that
    // respected the 6 m/s touchdown sink limit could reach the 520 m strip
    // in time, so the mission could only be won by flying through the hoop.
    return [{ x: RUNWAY.x - 920, z: RUNWAY.z, y: 80, name: 'Final Gate' }];
  }
  return [
    { x: 180, z: 420, y: 180, name: 'Ring 1' },
    { x: -320, z: 620, y: 220, name: 'Ring 2' },
    { x: -760, z: 240, y: 200, name: 'Ring 3' },
    { x: -640, z: -420, y: 280, name: 'Ring 4' },
    { x: -80, z: -760, y: 300, name: 'Ring 5' },
    { x: 480, z: -560, y: 240, name: 'Ring 6' },
    { x: 820, z: -120, y: 200, name: 'Ring 7' },
    { x: 700, z: 420, y: 170, name: 'Ring 8' },
  ];
}

export function buildTerrain(scene, island, rand) {
  const { groundHeight } = island;
  const group = new THREE.Group();
  group.name = 'coral-island';

  // Heightfield: vertex colours paint grass, sand, rock and town by height.
  const segments = 128;
  const geo = new THREE.PlaneGeometry(ISLAND_SIZE * 2.3, ISLAND_SIZE * 2.3, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(PALETTE.grass);
  const hill = new THREE.Color(PALETTE.hill);
  const sand = new THREE.Color(PALETTE.sand);
  const rock = new THREE.Color(PALETTE.rock);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    if (h < 4.5) tmp.copy(sand);
    else if (h < 60) tmp.copy(grass).lerp(hill, h / 90);
    else tmp.copy(hill).lerp(rock, Math.min(1, (h - 60) / 120));
    // Speckle, so the ground is not a flat wash of colour from the air.
    const speck = 0.92 + 0.16 * island.noise(x / 18, z / 18);
    colors[i * 3] = tmp.r * speck; colors[i * 3 + 1] = tmp.g * speck; colors[i * 3 + 2] = tmp.b * speck;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.name = 'ground';
  group.add(ground);

  // Sea: a big flat disc just under the beach, slightly transparent.
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(ISLAND_SIZE * 2.4, 48),
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92, shininess: 90 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y;
  sea.name = 'sea';
  group.add(sea);

  buildRunway(group);
  buildTown(group, island, rand);
  buildTrees(group, island, rand);
  buildLighthouse(group, island);
  buildBoats(group);
  buildClouds(group, rand);
  scene.add(group);
  return group;
}

function buildRunway(group) {
  const strip = new THREE.Group();
  strip.name = 'runway-09';
  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 1.2, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  surface.position.set(RUNWAY.x, 2.4, RUNWAY.z);
  strip.add(surface);
  // Centreline dashes and threshold bars, slightly above the strip so they never z-fight.
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine });
  for (let d = -RUNWAY.length / 2 + 40; d < RUNWAY.length / 2 - 20; d += 46) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.4), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(RUNWAY.x + d, 3.1, RUNWAY.z);
    strip.add(dash);
  }
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), lineMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(RUNWAY.x - RUNWAY.length / 2 + 18, 3.1, RUNWAY.z + side * 14);
    strip.add(bar);
  }
  // Edge lights: warm dots the pilot can follow home at dusk.
  const lightGeo = new THREE.SphereGeometry(1.6, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27f });
  for (let d = -RUNWAY.length / 2; d <= RUNWAY.length / 2; d += 52) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(RUNWAY.x + d, 4.2, RUNWAY.z + side * (RUNWAY.width / 2 + 3));
      strip.add(light);
    }
  }
  // A windsock near the threshold.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 14, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.set(RUNWAY.x - RUNWAY.length / 2 - 30, 9, RUNWAY.z - 40);
  strip.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xff7a59 }),
  );
  sock.rotation.z = Math.PI / 2; sock.position.set(RUNWAY.x - RUNWAY.length / 2 - 24, 15, RUNWAY.z - 40);
  strip.add(sock);
  group.add(strip);
}

function buildTown(group, island, rand) {
  const town = new THREE.Group(); town.name = 'old-town';
  const wallMat = new THREE.MeshLambertMaterial({ color: PALETTE.townWall });
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.townRoof });
  const roofMat2 = new THREE.MeshLambertMaterial({ color: 0x3f7fb8 });
  for (let i = 0; i < 42; i += 1) {
    const x = RUNWAY.x - 260 + rand.range(-40, 320);
    const z = RUNWAY.z - 260 + rand.range(-40, 300);
    if (Math.hypot(x - RUNWAY.x, z - RUNWAY.z) < 190) continue; // keep the airfield clear
    const w = rand.range(10, 20); const d = rand.range(10, 18); const h = rand.range(8, 18);
    const y = island.groundHeight(x, z);
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    house.position.set(x, y + h / 2, z);
    house.rotation.y = rand.range(0, Math.PI);
    town.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, rand.range(4, 8), 4), i % 3 ? roofMat : roofMat2);
    roof.position.set(x, y + h + 2.5, z);
    roof.rotation.y = Math.PI / 4 + house.rotation.y;
    town.add(roof);
  }
  group.add(town);
}

function buildTrees(group, island, rand) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x6fae3f });
  const trees = new THREE.Group(); trees.name = 'palm-grove';
  for (let i = 0; i < 260; i += 1) {
    const x = rand.range(-HALF, HALF); const z = rand.range(-HALF, HALF);
    const y = island.groundHeight(x, z);
    if (y < 5 || y > 90) continue;
    if (Math.hypot(x - RUNWAY.x, z - RUNWAY.z) < 220) continue;
    const s = rand.range(0.7, 1.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.8 * s, 9 * s, 5), trunkMat);
    trunk.position.set(x, y + 4.5 * s, z);
    trees.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(4.5 * s, 8 * s, 7), i % 2 ? leafMat : leafMat2);
    crown.position.set(x, y + 11 * s, z);
    trees.add(crown);
  }
  group.add(trees);
}

// Three little sailboats anchored off the harbour. Their spots were
// measured, not guessed: groundHeight there is -6 (open sea), so the hulls
// float on the sea disc at SEA_Y instead of sitting on the beach.
function buildBoats(group) {
  const spots = [
    { x: -1000, z: 1150, heading: 0.6, sail: PALETTE.planeRed },
    { x: -900, z: 1280, heading: -0.9, sail: 0xf2e8d5 },
    { x: -1120, z: 1250, heading: 2.4, sail: PALETTE.ringIdle },
  ];
  for (const s of spots) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2e }),
    );
    hull.position.y = 0.4;
    boat.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
    );
    mast.position.y = 4.2;
    boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 6.2); sailShape.lineTo(3.4, 0.4); sailShape.lineTo(0, 0);
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshLambertMaterial({ color: s.sail, side: THREE.DoubleSide }),
    );
    sail.position.set(0.2, 1.4, 0.4);
    boat.add(sail);
    boat.position.set(s.x, SEA_Y, s.z);
    boat.rotation.y = s.heading;
    group.add(boat);
  }
}

function buildLighthouse(group, island) {
  const x = -760; const z = 420;
  const y = island.groundHeight(x, z);
  const tower = new THREE.Group(); tower.name = 'lighthouse';
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 7, 34, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  body.position.set(x, y + 17, z); tower.add(body);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.6, 5, 10),
    new THREE.MeshLambertMaterial({ color: PALETTE.planeRed }),
  );
  band.position.set(x, y + 26, z); tower.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(x, y + 36, z); tower.add(lamp);
  group.add(tower);
}

function buildClouds(group, rand) {
  const clouds = new THREE.Group(); clouds.name = 'clouds';
  // Basic material: clouds stay bright white in every light, like a clear day.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 26; i += 1) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rand.next() * 3);
    for (let j = 0; j < n; j += 1) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(rand.range(14, 30), 8, 6), mat);
      ball.position.set(rand.range(-30, 30), rand.range(-4, 6), rand.range(-14, 14));
      ball.scale.y = 0.55;
      puff.add(ball);
    }
    puff.position.set(rand.range(-1200, 1200), rand.range(340, 520), rand.range(-1200, 1200));
    clouds.add(puff);
  }
  group.add(clouds);
}
