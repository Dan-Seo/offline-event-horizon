export type Quality = "ULTRA" | "HIGH" | "BALANCED" | "BATTERY";
// What a tier costs, in one place, so no module keeps its own copy of the four names.
// Renderer: display scale, GPU matter, asteroids, nebula ray-march steps.
// Reflections: the Nacre lagoon and the mirror sea, which deliberately differ at ULTRA.
// Populations: region motes, Nacre grass blades, ocean-life and foliage fractions, life agents.
// Remaining ray marches: sanctuary atmosphere steps, and the relativity pass's render width.
export const QUALITY = {
  ULTRA: {
    dpr: 1.75,
    particles: 160000,
    asteroids: 7000,
    steps: 72,
    lagoonReflection: 1,
    seaReflection: 0.85,
    regionMotes: 440,
    nacreGrass: 900,
    oceanLife: 1,
    lifeAgents: 8192,
    foliage: 1,
    atmosphereSteps: 40,
    relativityWidth: 1440,
  },
  HIGH: {
    dpr: 1.5,
    particles: 80000,
    asteroids: 4000,
    steps: 52,
    lagoonReflection: 0.65,
    seaReflection: 0.65,
    regionMotes: 340,
    nacreGrass: 650,
    oceanLife: 0.8,
    lifeAgents: 8192,
    foliage: 1,
    atmosphereSteps: 28,
    relativityWidth: 1200,
  },
  BALANCED: {
    dpr: 1.15,
    particles: 36000,
    asteroids: 1800,
    steps: 32,
    lagoonReflection: 0.45,
    seaReflection: 0.45,
    regionMotes: 220,
    nacreGrass: 420,
    oceanLife: 0.55,
    lifeAgents: 6144,
    foliage: 0.68,
    atmosphereSteps: 20,
    relativityWidth: 900,
  },
  BATTERY: {
    dpr: 0.85,
    particles: 12000,
    asteroids: 650,
    steps: 18,
    lagoonReflection: 0.3,
    seaReflection: 0.3,
    regionMotes: 100,
    nacreGrass: 230,
    oceanLife: 0.3,
    lifeAgents: 4096,
    foliage: 0.36,
    atmosphereSteps: 12,
    relativityWidth: 600,
  },
} as const;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function sectorSeed(x: number, y: number, z: number) {
  return (
    (Math.imul(x, 73856093) ^
      Math.imul(y, 19349663) ^
      Math.imul(z, 83492791) ^
      81726) >>>
    0
  );
}
