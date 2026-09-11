import * as T from "three/webgpu";
import type { FlightController } from "./flight";
import type { InputManager } from "./input";
import { damp, clamp } from "./config.ts";

export type WalkSurface = {
  id: string;
  radius: number;
  center: T.Vector3;
  frame: T.Quaternion;
  up: T.Vector3;
  height: (x: number, z: number) => number;
  water: (x: number, z: number) => number;
};

/** Human-scale, grounded motion; independent of orbital flight's clearance envelope. */
export class SurfaceWalker {
  active = false;
  distance = 0;
  eyeHeight = 1.8;
  surface?: WalkSurface;
  private local = new T.Vector3();
  private velocity = new T.Vector2();
  private pending = new T.Vector2();
  private yaw = 0;
  private pitch = 0;
  private dial = 1;
  private jump = 0;
  private jumpVelocity = 0;
  private wasJump = false;
  private viewFrame = new T.Quaternion();
  private gravityUp = new T.Vector3();
  private direction = new T.Vector3();
  private previous = new T.Vector3();
  localPosition(surface: WalkSurface, world: T.Vector3) {
    return world
      .clone()
      .sub(surface.center)
      .divideScalar(surface.radius)
      .sub(surface.up)
      .applyQuaternion(surface.frame.clone().invert());
  }
  canStart(surface: WalkSurface, world: T.Vector3) {
    const p = this.localPosition(surface, world);
    const h = surface.height(p.x, p.z);
    return (
      Math.max(Math.abs(p.x), Math.abs(p.z)) < 0.285 &&
      (surface.water(p.x, p.z) - h) * surface.radius < 0.7 &&
      Math.abs(p.y - h) * surface.radius < 100
    );
  }
  start(surface: WalkSurface, flight: FlightController) {
    if (!this.canStart(surface, flight.position)) return false;
    flight.cancel();
    this.surface = surface;
    this.local.copy(this.localPosition(surface, flight.position));
    this.eyeHeight = Math.max(
      1.8,
      (this.local.y - surface.height(this.local.x, this.local.z)) *
        surface.radius,
    );
    this.setFrame();
    this.direction
      .set(0, 0, -1)
      .applyQuaternion(flight.quaternion)
      .applyQuaternion(this.viewFrame.clone().invert());
    this.yaw = Math.atan2(-this.direction.x, -this.direction.z);
    this.pitch = Math.asin(clamp(this.direction.y, -0.98, 0.98));
    this.pending.set(0, 0);
    this.velocity.set(0, 0);
    this.jump = this.jumpVelocity = 0;
    this.wasJump = false;
    this.dial = 1;
    flight.velocity.set(0, 0, 0);
    this.active = true;
    return true;
  }
  stop() {
    this.active = false;
    this.surface = undefined;
    this.velocity.set(0, 0);
  }
  private setFrame() {
    this.gravityUp
      .set(this.local.x, 1 + this.local.y, this.local.z)
      .normalize();
    this.viewFrame
      .setFromUnitVectors(new T.Vector3(0, 1, 0), this.gravityUp)
      .premultiply(this.surface!.frame);
  }
  update(dt: number, input: InputManager, flight: FlightController) {
    const surface = this.surface!;
    const keys = input.keys;
    this.previous.copy(flight.position);
    this.dial = clamp(this.dial * Math.exp(input.wheel), 0.5, 2.2);
    input.learning.speed += Math.abs(input.wheel);
    this.pending.x -= input.look.x * 0.0016 * flight.sensitivity;
    this.pending.y -= input.look.y * 0.0016 * flight.sensitivity;
    const smoothing = damp(flight.gentle || flight.quiet ? 11 : 20, dt);
    const yawStep = clamp(this.pending.x * smoothing, -2.6 * dt, 2.6 * dt);
    const pitchStep = clamp(this.pending.y * smoothing, -2.6 * dt, 2.6 * dt);
    this.yaw += yawStep;
    this.pitch = clamp(this.pitch + pitchStep, -1.35, 1.35);
    this.pending.sub(new T.Vector2(yawStep, pitchStep));
    input.learning.look += Math.abs(yawStep) + Math.abs(pitchStep);
    const forward =
      Number(keys.has("KeyW")) - Number(keys.has("KeyS")) + input.touchMove.y;
    const right =
      Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + input.touchMove.x;
    const speed =
      6.5 *
      this.dial *
      (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1.8 : 1) *
      (keys.has("ControlLeft") || keys.has("ControlRight") ? 0.25 : 1);
    const desired = new T.Vector2(
      right * Math.cos(this.yaw) - forward * Math.sin(this.yaw),
      -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw),
    );
    desired.clampLength(0, 1).multiplyScalar(speed);
    this.velocity.lerp(desired, damp(10, dt));
    const dx = (this.velocity.x * dt) / surface.radius,
      dz = (this.velocity.y * dt) / surface.radius;
    const beforeGround = surface.height(this.local.x, this.local.z);
    const passable = (x: number, z: number) => {
      if (Math.hypot(x, z) > 0.7) return false;
      const h = surface.height(x, z);
      return (
        (surface.water(x, z) - h) * surface.radius <= 0.7 &&
        (h - beforeGround) * surface.radius <
          Math.hypot(dx, dz) * surface.radius * 1.2 + 0.15
      );
    };
    if (passable(this.local.x + dx, this.local.z + dz)) {
      this.local.x += dx;
      this.local.z += dz;
    } else {
      if (passable(this.local.x + dx, this.local.z)) this.local.x += dx;
      else this.velocity.x = 0;
      if (passable(this.local.x, this.local.z + dz)) this.local.z += dz;
      else this.velocity.y = 0;
    }
    const jumping = keys.has("Space");
    if (jumping && !this.wasJump && this.jump === 0 && this.eyeHeight < 2)
      this.jumpVelocity = 4.4;
    this.wasJump = jumping;
    this.jumpVelocity -= 8.5 * dt;
    this.jump = Math.max(0, this.jump + this.jumpVelocity * dt);
    if (this.jump === 0) this.jumpVelocity = 0;
    this.eyeHeight += (1.8 - this.eyeHeight) * damp(2.8, dt);
    this.local.y =
      surface.height(this.local.x, this.local.z) +
      (this.eyeHeight + this.jump) / surface.radius;
    flight.position
      .copy(this.local)
      .applyQuaternion(surface.frame)
      .add(surface.up)
      .multiplyScalar(surface.radius)
      .add(surface.center);
    this.setFrame();
    flight.quaternion
      .setFromEuler(new T.Euler(this.pitch, this.yaw, 0, "YXZ"))
      .premultiply(this.viewFrame);
    flight.velocity
      .copy(flight.position)
      .sub(this.previous)
      .divideScalar(Math.max(0.001, dt));
    flight.speed = speed;
    this.distance += this.velocity.length() * dt;
    input.learning.move += this.velocity.length() * dt;
    input.consume();
  }
}
