import * as T from "three/webgpu";
import { clamp, damp } from "./config";
import type { InputManager } from "./input";
export type Destination = {
  id: string;
  name: string;
  kind: string;
  position: T.Vector3;
  radius: number;
  solid?: boolean;
};
export class FlightController {
  position = new T.Vector3(0, 0, 9000);
  quaternion = new T.Quaternion();
  velocity = new T.Vector3();
  angular = new T.Vector3();
  private pendingLook = new T.Vector2();
  speedDial = 1;
  speed = 0;
  sensitivity = 1;
  quiet = false;
  gentle = false;
  mode: "FREE" | "DRIFT" | "TRAVEL" = "FREE";
  selected?: Destination;
  private driftTime = 0;
  private driftLeg = false;
  private desired = new T.Vector3();
  private offset = new T.Vector3();
  private rotation = new T.Quaternion();
  private targetRotation = new T.Quaternion();
  private dummy = new T.Object3D();
  private direction = new T.Vector3();
  reset() {
    this.position.set(0, 0, 9000);
    this.quaternion.identity();
    this.velocity.set(0, 0, 0);
    this.angular.set(0, 0, 0);
    this.pendingLook.set(0, 0);
    this.mode = "FREE";
    this.speedDial = 1;
  }
  cancel() {
    this.mode = "FREE";
    this.angular.set(0, 0, 0);
  }
  focus(target = this.selected) {
    if (target) {
      this.selected = target;
      this.mode = "TRAVEL";
      this.angular.set(0, 0, 0);
      this.pendingLook.set(0, 0);
    }
  }
  drift() {
    this.mode = this.mode === "DRIFT" ? "FREE" : "DRIFT";
    this.driftTime = 0;
    this.driftLeg = false;
  }
  private lookAt(point: T.Vector3, dt: number, rate = 2) {
    this.dummy.position.copy(this.position);
    this.dummy.up.set(0, 1, 0);
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
    if (movement && this.mode !== "FREE") this.cancel();
    this.speedDial = clamp(this.speedDial * Math.exp(input.wheel), 0.03, 200);
    let clearance = 1e8;
    for (const b of bodies)
      if (b.solid !== false)
        clearance = Math.min(
          clearance,
          this.position.distanceTo(b.position) - b.radius,
        );
    const contextual = clamp(Math.max(1, clearance) * 0.18, 2, 260000);
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
      this.angular.x = turnX / dt;
      this.angular.y = turnY / dt;
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
    } else {
      if (this.mode === "DRIFT" && this.driftTime > 50) {
        const destinations = bodies.filter((b) =>
          ["orpheus", "giant", "cathedral", "bloom", "wound"].includes(b.id),
        );
        const index = destinations.findIndex((b) => b.id === this.selected?.id);
        this.selected = destinations[(index + 1) % destinations.length];
        this.driftTime = 0;
        this.driftLeg = true;
      }
      const target = this.selected ?? bodies[0];
      if (target) {
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
        if (this.mode === "TRAVEL" || this.driftLeg) {
          const speed = clamp(
            (distance - stop) * 0.7,
            -contextual * 0.4,
            Math.max(800, distance * 0.3),
          );
          this.desired.copy(this.direction).multiplyScalar(-speed);
          if (Math.abs(distance - stop) < Math.max(5, target.radius * 0.012)) {
            if (this.mode === "TRAVEL") this.mode = "FREE";
            this.driftLeg = false;
          }
        } else {
          this.driftTime += dt;
          const tangent = new T.Vector3()
            .crossVectors(new T.Vector3(0, 1, 0), this.direction)
            .normalize();
          const rest = Math.sin(this.driftTime * 0.055) > 0.88 ? 0 : 1;
          this.desired
            .copy(tangent)
            .multiplyScalar(Math.max(5, target.radius * 0.009) * rest);
          if (distance < target.radius * 1.25)
            this.desired.addScaledVector(this.direction, contextual * 0.4);
        }
        this.lookAt(target.position, dt, this.mode === "TRAVEL" ? 1.2 : 0.2);
      }
    }
    if (this.mode !== "FREE" && this.desired.lengthSq() > 1) {
      this.direction.copy(this.desired).normalize();
      for (const body of bodies) {
        if (body.solid === false || body.id === this.selected?.id) continue;
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
    this.position.addScaledVector(this.velocity, dt);
    for (const b of bodies) {
      if (b.solid === false) continue;
      this.offset.copy(this.position).sub(b.position);
      const floor = b.radius * 1.006 + 3;
      if (this.offset.length() < floor) {
        this.offset.normalize();
        this.position.copy(b.position).addScaledVector(this.offset, floor);
        const toward = this.velocity.dot(this.offset);
        if (toward < 0) this.velocity.addScaledVector(this.offset, -toward);
      }
    }
    input.consume();
  }
}
