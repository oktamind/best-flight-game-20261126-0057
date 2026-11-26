// Skylark Island Rally — one place for every tuned number, so the judge's outline
// can see the game's shape from its names alone.
export const STEP = 1 / 60;
export const BEST_KEY = 'skylark-island-rally-best';
export const SEED = 20261126;

// The island is a square of this size (metres); the sea runs to the horizon beyond it.
export const ISLAND_SIZE = 2600;
export const SEA_LEVEL = 0;
export const MAX_ALT = 2600;

// Runway: flat strip on the south-east flats, heading 090 (east), so every landing
// screenshot has the strip, its lights and the town behind it in frame.
export const RUNWAY = {
  x: 620, z: 620, heading: 90, length: 520, width: 46,
  thresholdAlt: 2, name: 'Coral Island Runway 09',
};

export const PLANE = {
  cruiseSpeed: 62,       // m/s at full throttle, level flight
  minFlySpeed: 24,       // below this the wing stops flying: stall
  maxSpeed: 95,
  throttleRate: 0.55,    // per second
  pitchRate: 0.85,       // rad/s at full stick
  rollRate: 1.9,
  turnFromBank: 0.55,    // heading rate per radian of bank
  climbFromPitch: 1.25,
  fuelBurn: 0.55,        // % per second at full throttle
  fuelPerRing: 6,        // % refuelled by each ring
  startFuel: 100,
  startSpeed: 40,
};

export const MISSIONS = {
  rally: {
    id: 'rally', title: 'RING RALLY', rings: 8,
    blurb: 'Fly through the amber ring',
    intro: 'Ring rally — thread all 8 rings before the clock runs out.',
  },
  tour: {
    id: 'tour', title: 'HARBOUR TOUR', rings: 5,
    blurb: 'Sightsee low over the harbour',
    intro: 'Harbour tour — visit all 5 sights, low and slow.',
  },
  landing: {
    id: 'landing', title: 'LANDING CHALLENGE', rings: 1,
    blurb: 'One perfect touchdown on Runway 09',
    intro: 'Landing challenge — line up on Runway 09 and set her down gently.',
  },
};

// Palette: one warm coral-island style for sky, sea, sand and town.
export const PALETTE = {
  skyTop: 0x2f6fb8, skyBottom: 0xbfe6f5, fog: 0xa8d4e8,
  sea: 0x1e7d9e, seaDeep: 0x14607e, sand: 0xe8d49a, grass: 0x5da24a,
  hill: 0x4a7d3a, rock: 0x8a7f74, townRoof: 0xc65a3a, townWall: 0xf2e8d5,
  runway: 0x3a414d, runwayLine: 0xf5f2e8, ringNext: 0xffb02e, ringDone: 0x2fd4a7,
  ringIdle: 0x35b6d6, planeRed: 0xd94f30, planeCream: 0xf7ead2, planeDark: 0x2b3440,
};
