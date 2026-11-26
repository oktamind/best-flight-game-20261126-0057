// Seeded randomness: the same seed always builds the same island, the same rings
// and the same weather, so screenshots and replays are reproducible.
export function createRandom(seed) {
  let state = seed >>> 0 || 1;
  function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  }
  function range(min, max) { return min + (max - min) * next(); }
  function pick(list) { return list[Math.floor(next() * list.length)]; }
  return { next, range, pick, seed };
}

// Smooth value noise over a grid, for the island's hills. Deterministic in (x, z).
export function createNoise(seed) {
  const rand = createRandom(seed ^ 0x9e3779b9);
  const grid = new Float32Array(64 * 64);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand.next();
  function smooth(t) { return t * t * (3 - 2 * t); }
  function at(ix, iz) {
    const x = ((ix % 64) + 64) % 64;
    const z = ((iz % 64) + 64) % 64;
    return grid[z * 64 + x];
  }
  return function noise(x, z) {
    const fx = Math.floor(x); const fz = Math.floor(z);
    const tx = smooth(x - fx); const tz = smooth(z - fz);
    const a = at(fx, fz); const b = at(fx + 1, fz);
    const c = at(fx, fz + 1); const d = at(fx + 1, fz + 1);
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz);
  };
}
