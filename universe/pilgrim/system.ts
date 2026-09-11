import * as T from "three/webgpu";
import {
  PilgrimDynamics,
  BOARD_CLEARANCE,
  CRUISE_SPEED,
  HOVER_HEIGHT,
  type Drive,
} from "./model";
import { PilgrimContact } from "./contact";
import { PilgrimCraft } from "./craft";
import { PilgrimMeadow } from "./meadow";
import { ScenicDirector } from "./director";
import { updateInfluence, pilgrimObserver } from "./influence";
import type { FlightController } from "../flight";
import type { InputManager } from "../input";
import type { WalkSurface } from "../walk";
import type { PerceptionRuntime } from "../perception/runtime";
import { damp, clamp } from "../config";
import type { Quality } from "../config";
export class PilgrimSystem {
  active = false;
  cruise = false;
  model = new PilgrimDynamics();
  contact: PilgrimContact;
  craft: PilgrimCraft;
  director = new ScenicDirector();
  perception?: PerceptionRuntime;
  preparing = false;
  lab = false;
  worldPosition = new T.Vector3();
  worldRotation = new T.Quaternion();
  worldVelocity = new T.Vector3();
  private pitch = 0.035;
  private pending = new T.Vector2();
  private time = 0;
  private disposed = false;
  private meadow: PilgrimMeadow;
  private regionId = "";
  quality: Quality = "HIGH";
  constructor(
    private scene: T.Scene,
    private renderer: T.WebGPURenderer,
  ) {
    this.contact = new PilgrimContact(scene);
    this.craft = new PilgrimCraft(scene);
    this.meadow = new PilgrimMeadow(scene);
  }
  /** Boarding is only offered close to contact; higher up the hand-over would become a long fall.
   *  The test is symmetric: a hand-over from more than the limit below contact is refused too.
   *  `region` names the frame to measure in and is restored, so a refusal leaves nothing behind. */
  boardable(position: T.Vector3, region?: WalkSurface): boolean {
    const previous = this.contact.region;
    if (region !== previous) this.contact.setRegion(region);
    const p = this.contact.toLocal(position),
      clearance = p.y - this.contact.sample(p.x, p.z).height;
    if (region !== previous) this.contact.setRegion(previous);
    return Number.isFinite(clearance) && Math.abs(clearance) <= BOARD_CLEARANCE;
  }
  start(flight: FlightController, region?: WalkSurface) {
    if (!this.boardable(flight.position, region)) return false;
    this.regionId = region?.id ?? "";
    this.contact.setRegion(region);
    const p = this.contact.toLocal(flight.position),
      g = this.contact.sample(p.x, p.z);
    const f = new T.Vector3(0, 0, -1)
      .applyQuaternion(flight.quaternion)
      .applyQuaternion(this.contact.frame.clone().invert());
    this.model.reset(
      new T.Vector3(p.x, Math.max(g.height + HOVER_HEIGHT, p.y - 6), p.z),
      Math.atan2(-f.x, -f.z),
    );
    this.pitch = Math.asin(clamp(f.y, -0.9, 0.9));
    this.pending.set(0, 0);
    this.worldPosition.copy(this.contact.toWorld(this.model.position));
    this.worldRotation
      .setFromEuler(new T.Euler(0, this.model.yaw, 0))
      .premultiply(this.contact.frame);
    flight.cancel();
    this.active = true;
    this.cruise = false;
    this.craft.root.visible = true;
    return true;
  }
  stop() {
    this.active = false;
    this.cruise = false;
    this.director.cancel();
    this.craft.root.visible = false;
    if (this.perception) this.perception.enabled = false;
  }
  manual() {
    this.director.cancel();
    this.cruise = false;
  }
  rest() {
    this.manual();
  }
  async carry() {
    this.director.start(this.time);
    this.cruise = false;
    await this.enableSensors();
  }
  async enableSensors() {
    if (this.perception || this.preparing) return;
    this.preparing = true;
    try {
      const { PerceptionRuntime } = await import("../perception/runtime");
      if (this.disposed) return;
      this.perception = new PerceptionRuntime(this.renderer, this.scene);
      this.perception.lab = this.lab;
      this.perception.onReset = () => this.director.clearObservation();
      this.perception.onAnalysis = (a) => this.director.observe(a, this.time);
      await this.perception.prepare(
        this.contact.observer,
        this.worldPosition,
        this.worldRotation,
      );
    } catch (e) {
      console.warn("PILGRIM perception unavailable", e);
      this.director.cancel();
    } finally {
      this.preparing = false;
    }
  }
  update(
    dt: number,
    input: InputManager,
    flight: FlightController,
    paused: boolean,
    beauty: boolean,
  ) {
    if (!this.active) return;
    if (!paused) this.time += dt;
    const keys = input.keys;
    this.pending.x -= input.look.x * 0.0017 * flight.sensitivity;
    this.pending.y -= input.look.y * 0.0017 * flight.sensitivity;
    const step = this.pending.clone().multiplyScalar(damp(18, dt));
    this.pending.sub(step);
    this.model.yaw += clamp(step.x, -2 * dt, 2 * dt);
    this.pitch = clamp(this.pitch + step.y, -0.65, 0.8);
    input.learning.look += step.length();
    let drive: Drive = {
      throttle: clamp(
        +keys.has("KeyW") -
          +keys.has("KeyS") +
          input.touchMove.y +
          (this.cruise ? 0.7 : 0),
        -1,
        1,
      ),
      steer: clamp(
        +keys.has("KeyD") - +keys.has("KeyA") + input.touchMove.x,
        -1,
        1,
      ),
      lift: keys.has("Space"),
      precision: keys.has("ControlLeft") || keys.has("ControlRight"),
      boost: keys.has("ShiftLeft") || keys.has("ShiftRight"),
    };
    if (this.director.active)
      drive = this.director.update(this.time, paused ? 0 : dt, beauty);
    // Documented as a manual-drive lab condition; it must not scale scenic output.
    else if (this.lab && this.perception?.rig.condition === "FAST_MOTION")
      drive = { ...drive, boost: true };
    const previous = this.model.distance;
    this.model.advance(paused ? 0 : dt, drive, this.contact);
    input.learning.move += this.model.distance - previous;
    this.worldPosition.copy(this.contact.toWorld(this.model.position));
    this.worldRotation
      .setFromEuler(
        new T.Euler(this.model.pitch, this.model.yaw, this.model.bank, "YXZ"),
      )
      .premultiply(this.contact.frame);
    this.worldVelocity
      .copy(this.model.velocity)
      .applyQuaternion(this.contact.frame);
    // The observer follows the physical craft. Camera roll is deliberately not inherited.
    const view = new T.Quaternion()
      .setFromEuler(new T.Euler(this.pitch, this.model.yaw, 0, "YXZ"))
      .premultiply(this.contact.frame);
    const desired = this.worldPosition
      .clone()
      .add(new T.Vector3(0, 5.2, 13).applyQuaternion(view));
    const old = flight.position.clone();
    flight.position.lerp(
      desired,
      damp(flight.gentle || flight.quiet ? 2.1 : 3.1, dt),
    );
    flight.quaternion.slerp(view, damp(10, dt));
    flight.velocity
      .copy(flight.position)
      .sub(old)
      .divideScalar(Math.max(0.001, dt));
    flight.speed = CRUISE_SPEED;
    input.consume();
  }
  afterWorld(observer: T.Vector3, time: number) {
    this.contact.setObserver(observer);
    pilgrimObserver.value.copy(observer);
    updateInfluence(
      this.active ? this.worldPosition : new T.Vector3(0, -100000, 0),
      time,
      this.active ? this.worldVelocity.length() : 0,
    );
    this.meadow.update(
      this.contact,
      this.model.position,
      observer,
      time,
      this.active &&
        ["", "nacre"].includes(this.regionId) &&
        !this.model.gliding,
      this.quality,
    );
    if (!this.active) return;
    this.craft.update(
      this.worldPosition.clone().sub(observer),
      this.worldRotation,
      this.time,
    );
    if (this.perception) {
      this.perception.enabled =
        this.active && (this.director.active || this.lab);
      this.perception.tick(
        this.time,
        observer,
        this.worldPosition,
        this.worldRotation,
        this.worldVelocity,
        new T.Vector3(0, 1, 0).applyQuaternion(this.contact.frame),
        this.resting,
      );
    }
  }
  /** The single resting reading: the director's own state under Carry, settled hull otherwise. */
  get resting(): boolean {
    return this.director.active
      ? this.director.resting
      : !this.cruise && this.model.velocity.length() < 0.3;
  }
  snapshot() {
    return {
      active: this.active,
      carry: this.director.active,
      resting: this.resting,
      preparing: this.preparing,
      speed: this.model.velocity.length(),
      water: this.model.water,
      gliding: this.model.gliding,
      distance: this.model.distance,
      stops: this.director.stops,
      position: this.worldPosition.toArray(),
      local: this.model.position.toArray(),
      yaw: this.model.yaw,
      bank: this.model.bank,
      recoveries: this.model.recoveries,
      contactCache: this.contact.cacheSize,
      reason: this.director.reason,
      perception: this.perception?.snapshot() ?? null,
    };
  }
  dispose() {
    this.disposed = true;
    this.perception?.dispose();
    this.meadow.dispose();
    this.craft.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.scene.remove(this.craft.root);
  }
}
