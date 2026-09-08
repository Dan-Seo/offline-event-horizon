// A small, deterministic test-particle model in horizon-radius units.
// Velocity Verlet, fixed steps, softened Newtonian force. No GR or N-body claim.
export type ReleaseKind = "fall" | "orbit" | "escape";
export const ORBIT_STEP = 1 / 120;
export const ORBIT_MU = 3.4;
const SOFTENING = 0.025;
export function gravityAcceleration(
  x: number,
  y: number,
  z: number,
  gravity = 1,
) {
  const f =
    (-ORBIT_MU * gravity) / Math.pow(x * x + y * y + z * z + SOFTENING, 1.5);
  return [x * f, y * f, z * f] as const;
}
export class OrbitModel {
  readonly capacity = 144;
  positions = new Float64Array(this.capacity * 3);
  velocities = new Float64Array(this.capacity * 3);
  states = new Uint8Array(this.capacity); // unused, active, absorbed, escaped, retired
  ages = new Float64Array(this.capacity);
  endedAt = new Float64Array(this.capacity);
  generations = new Uint32Array(this.capacity);
  gravity = 1;
  time = 0;
  launched = 0;
  absorbed = 0;
  escaped = 0;
  capturesThisStep = 0;
  private cursor = 0;
  private remainder = 0;
  private randomState = 987123;
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  setGravity(value: number) {
    if (Number.isFinite(value))
      this.gravity = Math.max(0.4, Math.min(2.5, value));
  }
  release(kind: ReleaseKind, angle = 0.7) {
    const r = 3.25;
    // Initial circular speed is consistent with the softened force used below.
    const circular = Math.sqrt(
      (ORBIT_MU * this.gravity * r * r) / Math.pow(r * r + SOFTENING, 1.5),
    );
    const speed =
      circular * (kind === "fall" ? 0.18 : kind === "escape" ? 1.8 : 1);
    for (let n = 0; n < 48; n++) {
      const i = this.cursor++ % this.capacity,
        j = i * 3;
      const a = angle + (this.random() - 0.5) * 0.065;
      const distance = r + (this.random() - 0.5) * 0.085;
      const velocity = speed * (0.995 + this.random() * 0.01);
      this.positions.set(
        [
          Math.cos(a) * distance,
          Math.sin(a) * distance,
          (this.random() - 0.5) * 0.06,
        ],
        j,
      );
      this.velocities.set(
        [
          -Math.sin(a) * velocity,
          Math.cos(a) * velocity,
          (this.random() - 0.5) * 0.005,
        ],
        j,
      );
      this.states[i] = 1;
      this.ages[i] = 0;
      this.endedAt[i] = -1;
      this.generations[i]++;
    }
    this.launched += 48;
  }
  advance(dt: number) {
    this.capturesThisStep = 0;
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.remainder += Math.min(dt, 0.05);
    while (this.remainder + 1e-10 >= ORBIT_STEP) {
      this.remainder -= ORBIT_STEP;
      this.time += ORBIT_STEP;
      const p = this.positions,
        v = this.velocities,
        h = ORBIT_STEP;
      for (let i = 0; i < this.capacity; i++) {
        if (this.states[i] !== 1) continue;
        const j = i * 3;
        const a = gravityAcceleration(p[j], p[j + 1], p[j + 2], this.gravity);
        for (let k = 0; k < 3; k++) {
          v[j + k] += a[k] * h * 0.5;
          p[j + k] += v[j + k] * h;
        }
        const next = gravityAcceleration(
          p[j],
          p[j + 1],
          p[j + 2],
          this.gravity,
        );
        for (let k = 0; k < 3; k++) v[j + k] += next[k] * h * 0.5;
        this.ages[i] += h;
        const radius = Math.hypot(p[j], p[j + 1], p[j + 2]);
        if (radius <= 1.035) {
          this.states[i] = 2;
          this.absorbed++;
          this.capturesThisStep++;
        } else if (radius > 16) {
          this.states[i] = 3;
          this.escaped++;
        } else if (this.ages[i] > 120) this.states[i] = 4;
        if (this.states[i] !== 1) this.endedAt[i] = this.time;
      }
    }
  }
  clear() {
    this.states.fill(0);
    this.ages.fill(0);
    this.generations.fill(0);
    this.cursor = 0;
    this.launched = 0;
    this.absorbed = 0;
    this.escaped = 0;
    this.capturesThisStep = 0;
    this.remainder = 0;
  }
  snapshot() {
    let active = 0;
    for (const state of this.states) if (state === 1) active++;
    return {
      active,
      absorbed: this.absorbed,
      escaped: this.escaped,
      launched: this.launched,
      gravity: this.gravity,
    };
  }
}
