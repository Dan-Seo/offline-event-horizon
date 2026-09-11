import * as T from "three/webgpu";
import { clamp, damp, seeded } from "./config";
import {
  HOME,
  HOME_PITCH,
  SANCTUARIES,
  localPresence,
} from "./sanctuary-layout";
import type { InputManager } from "./input";
import { oceanRadialFloor, renderedSeaFloor } from "./ocean-depth";
export type Destination = {
  id: string;
  name: string;
  kind: string;
  position: T.Vector3;
  radius: number;
  solid?: boolean;
  surface?: boolean;
  arrival?: T.Vector3;
  gaze?: T.Vector3;
  approachArrival?: T.Vector3;
  approachGaze?: T.Vector3;
  approachUp?: T.Vector3;
  clearance?: (outward: T.Vector3) => number;
};
export class FlightController {
  position = HOME.clone();
  quaternion = new T.Quaternion().setFromEuler(new T.Euler(HOME_PITCH, 0, 0));
  velocity = new T.Vector3();
  angular = new T.Vector3();
  private pendingLook = new T.Vector2();
  speedDial = 1;
  speed = 0;
  sensitivity = 1;
  quiet = false;
  gentle = false;
  mode: "FREE" | "WANDER" | "TRAVEL" | "ORBIT" = "FREE";
  private orbitRadius = 0;
  private approaching = false;
  private approachWaypoint?: T.Vector3;
  private departure?: {
    id: string;
    ground: (position: T.Vector3) => number;
    time: number;
  };
  selected?: Destination;
  holdBeauty = false;
  private wanderTime = 0;
  private wanderRest = 0;
  private wanderGlide = 0;
  private wanderPoint = new T.Vector3();
  private wanderGaze = new T.Vector3();
  private random = seeded(4917);
  private desired = new T.Vector3();
  private offset = new T.Vector3();
  private rotation = new T.Quaternion();
  private targetRotation = new T.Quaternion();
  private dummy = new T.Object3D();
  private direction = new T.Vector3();
  reset() {
    this.departure = undefined;
    this.position.copy(HOME);
    this.quaternion.setFromEuler(new T.Euler(HOME_PITCH, 0, 0));
    this.velocity.set(0, 0, 0);
    this.angular.set(0, 0, 0);
    this.pendingLook.set(0, 0);
    this.mode = "FREE";
    this.speedDial = 1;
    this.selected = undefined;
  }
  cancel() {
    this.mode = "FREE";
    this.angular.set(0, 0, 0);
    this.pendingLook.set(0, 0);
    this.approaching = false;
    this.approachWaypoint = undefined;
  }
  departSurface(id: string, ground: (position: T.Vector3) => number) {
    this.departure = { id, ground, time: 0 };
  }
  focus(target = this.selected) {
    if (target) {
      this.selected = target;
      this.mode = "TRAVEL";
      this.angular.set(0, 0, 0);
      this.pendingLook.set(0, 0);
      this.approaching = false;
    }
  }
  approach(target = this.selected) {
    if (!target?.approachArrival || !target.approachGaze) return;
    this.focus(target);
    this.approaching = true;
    this.approachWaypoint = target.approachArrival
      .clone()
      .sub(target.position)
      .normalize()
      .multiplyScalar(target.radius * 1.65)
      .add(target.position);
  }
  orbit(target = this.selected) {
    if (this.mode === "ORBIT") {
      this.cancel();
      return;
    }
    if (
      !target ||
      target.solid === false ||
      target.kind === "Gravitational anomaly"
    )
      return;
    this.selected = target;
    this.orbitRadius = Math.max(
      target.radius * 1.3,
      this.position.distanceTo(target.position),
    );
    this.angular.set(0, 0, 0);
    this.pendingLook.set(0, 0);
    this.mode = "ORBIT";
  }
  wander() {
    if (this.mode === "WANDER") {
      this.cancel();
      return;
    }
    this.mode = "WANDER";
    this.wanderTime = 0;
    this.wanderRest = 10 + this.random() * 12;
    this.wanderGlide = 0;
    this.wanderPoint.copy(this.position);
    const near = SANCTUARIES.reduce((a, b) =>
      this.position.distanceTo(a.position) <
      this.position.distanceTo(b.position)
        ? a
        : b,
    );
    if (localPresence(this.position) > 0.1) this.wanderGaze.copy(near.gaze);
    else
      this.wanderGaze
        .set(0, 0, -10000)
        .applyQuaternion(this.quaternion)
        .add(this.position);
    this.velocity.multiplyScalar(0.1);
  }
  private lookAt(point: T.Vector3, dt: number, rate = 2, up?: T.Vector3) {
    this.dummy.position.copy(this.position);
    if (up) this.dummy.up.copy(up);
    else this.dummy.up.set(0, 1, 0);
    this.dummy.lookAt(point);
    // Object3D looks along +Z, camera along -Z.
    this.targetRotation
      .copy(this.dummy.quaternion)
      .multiply(
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI),
      );
    this.quaternion.slerp(this.targetRotation, damp(rate, dt));
  }
  update(dt: number, input: InputManager, bodies: Destination[]) {
    const keys = input.keys;
    const movement =
      input.manual ||
      [...keys].some((k) =>
        [
          "KeyW",
          "KeyS",
          "KeyA",
          "KeyD",
          "KeyQ",
          "KeyE",
          "Space",
          "KeyX",
        ].includes(k),
      ) ||
      input.touchMove.lengthSq() > 0.001;
    if (movement && this.mode !== "FREE") {
      this.cancel();
      this.velocity.multiplyScalar(0.15);
    }
    this.speedDial = clamp(this.speedDial * Math.exp(input.wheel), 0.03, 200);
    input.learning.speed += Math.abs(input.wheel);
    let clearance = 1e8;
    for (const b of bodies)
      if (b.solid !== false)
        clearance = Math.min(
          clearance,
          this.position.distanceTo(b.position) - b.radius,
        );
    const presence = localPresence(this.position);
    const contextual = clamp(
      Math.max(1, clearance) * 0.18,
      presence > 0.1 ? 28 : 2,
      260000,
    );
    const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5 : 1;
    const precision =
      keys.has("ControlLeft") || keys.has("ControlRight") ? 0.12 : 1;
    this.speed = contextual * this.speedDial * boost * precision;
    const softer = this.quiet || this.gentle;
    this.desired.set(0, 0, 0);
    if (this.mode === "FREE") {
      this.desired.set(
        Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + input.touchMove.x,
        Number(keys.has("Space")) - Number(keys.has("KeyX")),
        Number(keys.has("KeyS")) - Number(keys.has("KeyW")) - input.touchMove.y,
      );
      if (this.desired.lengthSq() > 1) this.desired.normalize();
      this.desired.applyQuaternion(this.quaternion).multiplyScalar(this.speed);
      this.pendingLook.x -= input.look.y * 0.0016 * this.sensitivity;
      this.pendingLook.y -= input.look.x * 0.0016 * this.sensitivity;
      const limit = (softer ? 1.4 : 3) * dt,
        smoothing = damp(softer ? 11 : 20, dt);
      const turnX = clamp(this.pendingLook.x * smoothing, -limit, limit),
        turnY = clamp(this.pendingLook.y * smoothing, -limit, limit);
      this.pendingLook.x -= turnX;
      this.pendingLook.y -= turnY;
      input.learning.look += Math.abs(turnX) + Math.abs(turnY);
      this.angular.x = turnX / Math.max(0.001, dt);
      this.angular.y = turnY / Math.max(0.001, dt);
      this.angular.z +=
        ((Number(keys.has("KeyQ")) - Number(keys.has("KeyE"))) * 0.7 -
          this.angular.z) *
        smoothing;
      this.rotation.setFromEuler(
        new T.Euler(
          this.angular.x * dt,
          this.angular.y * dt,
          this.angular.z * dt,
          "YXZ",
        ),
      );
      this.quaternion.multiply(this.rotation).normalize();
      if (this.selected && input.orbit.lengthSq() > 0) {
        this.offset.copy(this.position).sub(this.selected.position);
        this.rotation.setFromEuler(
          new T.Euler(-input.orbit.y * 0.002, -input.orbit.x * 0.002, 0, "YXZ"),
        );
        this.offset.applyQuaternion(this.rotation);
        this.position.copy(this.selected.position).add(this.offset);
        this.velocity.set(0, 0, 0);
        this.lookAt(this.selected.position, dt, 30);
      }
    } else if (this.mode === "ORBIT" && this.selected) {
      this.offset.copy(this.position).sub(this.selected.position);
      const distance = this.offset.length();
      this.direction
        .crossVectors(new T.Vector3(0, 1, 0), this.offset)
        .normalize();
      if (this.direction.lengthSq() < 0.01) this.direction.set(1, 0, 0);
      this.desired
        .copy(this.direction)
        .multiplyScalar(this.orbitRadius * (softer ? 0.008 : 0.012));
      this.desired.addScaledVector(
        this.offset.normalize(),
        (this.orbitRadius - distance) * 0.4,
      );
      this.lookAt(this.selected.position, dt, 0.8);
    } else if (this.mode === "WANDER") {
      // Wander stays with a place. It does not count down to the next attraction.
      this.wanderTime += dt;
      if (this.holdBeauty) {
        this.wanderRest = Math.max(this.wanderRest, this.wanderTime + 8);
      } else if (this.wanderTime > this.wanderRest) {
        const near = SANCTUARIES.reduce((a, b) =>
          this.position.distanceTo(a.position) <
          this.position.distanceTo(b.position)
            ? a
            : b,
        );
        const a = this.random() * Math.PI * 2;
        if (presence > 0.1) {
          const r = 70 + this.random() * 150;
          this.wanderPoint
            .copy(this.position)
            .add(
              new T.Vector3(
                Math.cos(a) * r,
                (this.random() - 0.5) * 15,
                Math.sin(a) * r,
              ),
            );
          this.wanderPoint.y = Math.max(16, this.wanderPoint.y);
          if (this.wanderPoint.distanceTo(near.arrival) > near.radius * 1.1)
            this.wanderPoint.lerp(near.arrival, 0.25);
          this.wanderGaze
            .copy(near.gaze)
            .add(
              new T.Vector3((this.random() - 0.5) * 220, this.random() * 80, 0),
            );
        } else {
          this.wanderPoint
            .set(Math.cos(a), Math.sin(a) * 0.1, Math.sin(a))
            .multiplyScalar(contextual * 0.15)
            .add(this.position);
        }
        this.wanderTime = 0;
        this.wanderRest = 45 + this.random() * 55;
        this.wanderGlide = 19 + this.random() * 9;
      }
      if (!this.holdBeauty && this.wanderTime < this.wanderGlide) {
        this.desired
          .copy(this.wanderPoint)
          .sub(this.position)
          .multiplyScalar(0.045);
        this.desired.clampLength(0, presence > 0.1 ? 7 : contextual * 0.025);
        if (this.desired.length() < 0.45) this.desired.set(0, 0, 0);
      }
      if (!this.holdBeauty) this.lookAt(this.wanderGaze, dt, 0.11);
    } else {
      const target = this.selected ?? bodies[0];
      if (target) {
        if (
          this.approachWaypoint &&
          this.position.distanceTo(this.approachWaypoint) < target.radius * 0.1
        )
          this.approachWaypoint = undefined;
        const arrival = this.approaching
          ? (this.approachWaypoint ?? target.approachArrival)
          : target.arrival;
        const gaze = this.approaching ? target.approachGaze : target.gaze;
        if (arrival && gaze) {
          this.desired.copy(arrival).sub(this.position);
          const distance = this.desired.length();
          this.desired
            .normalize()
            .multiplyScalar(
              Math.min(
                distance * 0.28,
                this.approaching ? Math.max(520, target.radius * 0.6) : 520,
              ),
            );
          this.lookAt(
            gaze,
            dt,
            0.6,
            this.approaching ? target.approachUp : undefined,
          );
          if (distance < 3) {
            this.mode = "FREE";
            this.desired.set(0, 0, 0);
          }
        } else {
          this.offset.copy(this.position).sub(target.position);
          const distance = this.offset.length();
          const factor =
            target.kind === "Nebula"
              ? 0.25
              : target.kind === "Gravitational anomaly"
                ? 6
                : target.kind === "Ringed giant"
                  ? 6.5
                  : target.kind === "Ancient structure"
                    ? 3.6
                    : 2.8;
          const stop = target.radius * factor + 35;
          this.direction.copy(this.offset).normalize();
          if (this.mode === "TRAVEL") {
            // Framing can require backing away from a large body. Use the same
            // flight envelope in either direction: a nearby moon must not limit
            // a long retreat to its local precision-navigation speed.
            const travelLimit = Math.max(800, distance * 0.3);
            const speed = clamp(
              (distance - stop) * 0.7,
              -travelLimit,
              travelLimit,
            );
            this.desired.copy(this.direction).multiplyScalar(-speed);
            if (
              Math.abs(distance - stop) < Math.max(5, target.radius * 0.012)
            ) {
              if (this.mode === "TRAVEL") this.mode = "FREE";
            }
          }
          this.lookAt(target.position, dt, 1.2);
        }
      }
    }
    if (this.mode !== "FREE" && this.desired.lengthSq() > 1) {
      this.direction.copy(this.desired).normalize();
      for (const body of bodies) {
        if (
          body.solid === false ||
          body.surface ||
          body.id === this.selected?.id
        )
          continue;
        this.offset.copy(body.position).sub(this.position);
        const ahead = this.offset.dot(this.direction);
        if (
          ahead < 0 ||
          ahead > Math.max(this.desired.length() * 6, body.radius * 4)
        )
          continue;
        this.offset.addScaledVector(this.direction, -ahead);
        const separation = this.offset.length(),
          margin = body.radius * 1.4;
        if (separation < margin) {
          if (separation < 1)
            this.offset.crossVectors(this.direction, new T.Vector3(0, 1, 0));
          this.offset.normalize();
          this.desired.addScaledVector(
            this.offset,
            -this.desired.length() * (1 - separation / margin) * 1.4,
          );
        }
      }
    }
    this.velocity.lerp(this.desired, damp(softer ? 3.5 : 6, dt));
    if (this.mode === "FREE" && movement)
      input.learning.move += this.velocity.length() * dt;
    this.position.addScaledVector(this.velocity, dt);
    if (this.departure) {
      this.departure.time += dt;
      if (this.departure.time >= 3) this.departure = undefined;
    }
    for (const b of bodies) {
      if (b.solid === false) continue;
      this.offset.copy(this.position).sub(b.position);
      let floor = b.clearance
        ? b.clearance(this.offset.clone().normalize())
        : b.surface
          ? b.radius + 2
          : b.radius * 1.006 + 3;
      if (b.id === "orpheus" && this.offset.y > 0 && Math.hypot(this.position.x, this.position.z) < 30000) {
        const n = this.offset.clone().normalize();
        floor = oceanRadialFloor(n.x, n.y, n.z, renderedSeaFloor, b.radius, 3);
      }
      if (this.departure?.id === b.id) {
        const t = this.departure.time / 3,
          blend = t * t * (3 - 2 * t);
        const ground = this.departure.ground(this.position);
        floor = ground + (floor - ground) * blend;
      }
      if (this.offset.length() < floor) {
        this.offset.normalize();
        this.position.copy(b.position).addScaledVector(this.offset, floor);
        const toward = this.velocity.dot(this.offset);
        if (toward < 0) this.velocity.addScaledVector(this.offset, -toward);
      }
    }
    // Broad, forgiving top surfaces. Trees remain permeable to free flight.
    if (presence > 0.1)
      for (const island of [
        { x: 1900, z: -1750, y: 30, rx: 760, rz: 1060, depth: 180 },
        { x: 2900, z: -4700, y: 730, rx: 490, rz: 590, depth: 460 },
      ]) {
        const r = Math.hypot(
          (this.position.x - island.x) / island.rx,
          (this.position.z - island.z) / island.rz,
        );
        const top = island.y - Math.pow(r, 3) * 19 + 7;
        if (
          r < 0.88 &&
          this.position.y > island.y - island.depth * 0.4 &&
          this.position.y < top
        ) {
          this.position.y = top;
          this.velocity.y = Math.max(0, this.velocity.y);
        }
      }
    input.consume();
  }
}
