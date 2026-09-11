import { Vector3 } from "three";
export type SurfaceSample = {
  height: number;
  water: boolean;
  normal: Vector3;
  blocked?: boolean;
};
export type ContactWorld = {
  sample: (x: number, z: number) => SurfaceSample;
  blocked?: (p: Vector3) => boolean;
};
export type Drive = {
  throttle: number;
  steer: number;
  lift: boolean;
  precision: boolean;
  boost: boolean;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** The physical response the scenic planner and the host system must both speak in. */
export const HOVER_HEIGHT = 2.8;
export const CRUISE_SPEED = 12;
export const STEER_YAW_RATE = 0.52;
/** Boarding limit. Above the spring zone only the clearance-scaled descent remains (peak 14 u/s), which
 *  settles a hand-over at this height in about 21 s; higher up it would be a long uncontrollable fall. */
export const BOARD_CLEARANCE = 150;
/** Fixed-step, damped hover dynamics. Contact truth belongs here, never in the scenic planner. */
export class PilgrimDynamics {
  position = new Vector3();
  velocity = new Vector3();
  yaw = 0;
  angularVelocity = 0;
  bank = 0;
  pitch = 0;
  water = false;
  gliding = false;
  contact = 1;
  distance = 0;
  recoveries = 0;
  liftReserve = 3;
  time = 0;
  private remainder = 0;
  reset(p: Vector3, yaw: number) {
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.angularVelocity = this.bank = this.pitch = 0;
    this.remainder = 0;
    this.distance = 0;
    this.contact = 1;
    this.liftReserve = 3;
    this.recoveries = 0;
  }
  advance(dt: number, drive: Drive, world: ContactWorld) {
    this.remainder += Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    while (this.remainder >= 1 / 120 - 1e-10) {
      this.step(1 / 120, drive, world);
      this.remainder = Math.max(0, this.remainder - 1 / 120);
    }
  }
  private step(dt: number, drive: Drive, world: ContactWorld) {
    this.time += dt;
    const ground = world.sample(this.position.x, this.position.z),
      clearance = this.position.y - ground.height;
    this.water = ground.water;
    this.contact = clamp(1 - (clearance - HOVER_HEIGHT) / 9, 0, 1);
    this.gliding = clearance > 12;
    const angularTarget =
      -drive.steer * STEER_YAW_RATE * (drive.precision ? 0.4 : 1);
    this.angularVelocity +=
      (angularTarget - this.angularVelocity) * (1 - Math.exp(-5 * dt));
    this.yaw += this.angularVelocity * dt;
    const speed =
        CRUISE_SPEED * (drive.precision ? 0.3 : 1) * (drive.boost ? 1.65 : 1),
      targetX = -Math.sin(this.yaw) * drive.throttle * speed,
      targetZ = -Math.cos(this.yaw) * drive.throttle * speed;
    const drag = this.gliding ? 1.2 : 3.2;
    this.velocity.x += clamp((targetX - this.velocity.x) * drag, -9, 9) * dt;
    this.velocity.z += clamp((targetZ - this.velocity.z) * drag, -9, 9) * dt;
    const lift = drive.lift && this.liftReserve > 0;
    this.liftReserve = clamp(
      this.liftReserve + (lift ? -1 : this.contact * 0.6) * dt,
      0,
      3,
    );
    const desiredHeight =
      HOVER_HEIGHT +
      (ground.water ? 0.15 * Math.sin(this.time * 0.6) : 0) +
      (lift ? 6 : 0);
    // Spring only near a surface. Aloft, glide and controlled descent replace terrain snapping.
    const spring = (desiredHeight - clearance) * 14 - this.velocity.y * 7;
    const ay = clearance < 14 ? clamp(spring, -7, 12) : -2.8 + (lift ? 3.6 : 0);
    // Fall faster the higher the hand-over, so a boarding at the limit still settles in ~12 s.
    const descent = clamp(clearance * 0.12, 5.5, 14);
    this.velocity.y = clamp(this.velocity.y + ay * dt, -descent, 7);
    const next = this.position.clone().addScaledVector(this.velocity, dt),
      ahead = world.sample(next.x, next.z);
    const obstructed =
      ahead.height > this.position.y - 0.6 || world.blocked?.(next);
    if (obstructed) {
      const xFree =
        world.sample(next.x, this.position.z).height < this.position.y - 0.6 &&
        !world.blocked?.(new Vector3(next.x, next.y, this.position.z));
      const zFree =
        world.sample(this.position.x, next.z).height < this.position.y - 0.6 &&
        !world.blocked?.(new Vector3(this.position.x, next.y, next.z));
      if (!xFree) {
        next.x = this.position.x;
        this.velocity.x *= 0.7;
      }
      if (!zFree) {
        next.z = this.position.z;
        this.velocity.z *= 0.7;
      }
      if (xFree && zFree) {
        next.x = this.position.x;
        next.z = this.position.z;
        this.velocity.x *= 0.75;
        this.velocity.z *= 0.75;
      }
    }
    const landing = world.sample(next.x, next.z);
    if (next.y < landing.height + 1) {
      next.y = landing.height + 1;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.recoveries++;
    }
    this.distance += Math.hypot(
      next.x - this.position.x,
      next.z - this.position.z,
    );
    this.position.copy(next);
    const lateral =
      this.angularVelocity * Math.hypot(this.velocity.x, this.velocity.z);
    this.bank +=
      (clamp(-lateral * 0.027, -0.14, 0.14) - this.bank) *
      (1 - Math.exp(-3 * dt));
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const slope = Math.atan2(
      -ground.normal.dot(forward),
      Math.max(0.3, ground.normal.y),
    );
    this.pitch +=
      (clamp(slope * this.contact, -0.2, 0.2) - this.pitch) *
      (1 - Math.exp(-2 * dt));
  }
}
