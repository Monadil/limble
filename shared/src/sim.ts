import { World, BoxShape, CircleShape, ChainShape, RevoluteJoint } from "planck";
import type { Body, Fixture } from "planck";
import { DEFAULT_CONFIG, type Config } from "./config";
import { emptyInputs, type LimbInputs, type Stick } from "./controls";
import {
  ARM_W, FINISH_X, FOOT_FORWARD, FOOT_H, FOOT_W, FOREARM, FRONT_ARM, FRONT_HAND, GROUND,
  HEAD_R, HEAD_Y, HIP_LOCAL, ITEMS, LEG_REST, LEG_W, LIMBS, REAR_ARM, REAR_HAND, SHIN, SHOULDER_LOCAL,
  START_X, THIGH, TORSO_H, TORSO_W, TRAY_H, TRAY_RIM_H, TRAY_RIM_W, TRAY_W, UPPER_ARM, groundHeightAt,
  type LimbId,
} from "./layout";

export const TICK = 1 / 60;

export type Status = "playing" | "failed" | "finished";
export type FailReason = "dropped" | "fell" | null;

export interface Snapshot {
  /** [x, y, angle] per part, in PART_IDS order. */
  parts: number[];
  status: Status;
  failReason: FailReason;
  attempt: number;
  /** Best distance across attempts (m). */
  best: number;
  /** Distance reached this run (m). */
  distance: number;
  /** Seconds into this run. */
  time: number;
  /** Fastest finish time so far (s), or null. */
  bestTime: number | null;
  /** Items still off the floor this run. */
  itemsLeft: number;
  /** Most items delivered across finished runs. */
  bestItems: number;
  limp: LimbId[];
}

type Tag = "ground" | "torso" | "limb" | "foot" | "tray" | "item";

interface Limb {
  id: LimbId;
  kind: "leg" | "arm";
  upper: Body;
  lower: Body;
  upperJoint: RevoluteJoint;
  lowerJoint: RevoluteJoint;
  L1: number;
  L2: number;
  /** Which side of the joint→target line the middle joint bends to (+1 knee forward, -1 elbow down). */
  bend: 1 | -1;
}

const BODY_GROUP = -1; // body parts + tray never collide with each other
const CAT_BODY = 0x0002; // limbs, torso, head (the tray keeps the default category)
const ARM_ANCHOR_RISE = SHOULDER_LOCAL.y - HIP_LOCAL.y; // shoulder height above the hip when upright
const LEG_STANCE: Record<string, number> = { leftLeg: 0.07, rightLeg: -0.07 };
const FAIL_PAUSE = 2;
const FINISH_PAUSE = 3;
const FALL_ANGLE = 1.25;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Two-bone IK. Returns world angles for both bones (angle 0 = bone pointing straight down). */
export function solveIK(
  ox: number, oy: number, tx: number, ty: number, L1: number, L2: number, bend: number,
): { a1: number; a2: number } {
  let dx = tx - ox;
  let dy = ty - oy;
  let raw = Math.hypot(dx, dy);
  if (raw < 1e-6) { dx = 0; dy = -1; raw = 1; }
  const ux = dx / raw;
  const uy = dy / raw;
  const d = clamp(raw, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
  const kx = ox + ux * along + bend * -uy * h;
  const ky = oy + uy * along + bend * ux * h;
  const ex = ox + ux * d;
  const ey = oy + uy * d;
  return {
    a1: Math.atan2(kx - ox, -(ky - oy)),
    a2: Math.atan2(ex - kx, -(ey - ky)),
  };
}

export class LimbleSim {
  config: Config;
  inputs: LimbInputs = emptyInputs();
  private smoothed: LimbInputs = emptyInputs();

  status: Status = "playing";
  failReason: FailReason = null;
  attempt = 1;
  best = 0;
  bestTime: number | null = null;
  distance = 0;
  time = 0;
  bestItems = 0;

  private dropped = new Set<number>();
  private itemIndex = new Map<Fixture, number>();
  private limp = new Set<LimbId>();
  private timer = 0;
  private world!: World;
  private torso!: Body;
  private tray!: Body;
  private items: Body[] = [];
  private limbs!: Record<LimbId, Limb>;
  private parts: Body[] = [];
  private feet: Fixture[] = [];
  private itemFixtures: Fixture[] = [];
  private pendingFail: FailReason = null;

  constructor(config: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.build();
  }

  setInput(limb: LimbId, s: Stick) {
    this.inputs[limb] = { x: clamp(s.x, -1, 1), y: clamp(s.y, -1, 1) };
  }

  setInputs(inputs: Partial<LimbInputs>) {
    for (const id of LIMBS) {
      const s = inputs[id];
      if (s) this.setInput(id, s);
    }
  }

  /** A limp limb has no motor: used when its player disconnects. */
  setLimp(limb: LimbId, limp: boolean) {
    if (limp) this.limp.add(limb);
    else this.limp.delete(limb);
    this.updateMotors();
  }

  /** Re-apply config values that live on physics objects (call after editing config). */
  applyConfig() {
    this.world.setGravity({ x: 0, y: -this.config.gravity });
    this.torso.setAngularDamping(this.config.torsoDamping);
    for (const f of this.feet) f.setFriction(this.config.footFriction);
    for (const f of this.itemFixtures) f.setFriction(this.config.itemFriction);
    for (let c = this.world.getContactList(); c; c = c.getNext()) c.resetFriction();
  }

  restart() {
    this.attempt++;
    this.build();
  }

  step() {
    if (this.status === "playing") {
      this.driveLimbs();
      this.selfRight();
      this.steadyTray();
      this.time += TICK;
    } else {
      this.timer -= TICK;
      if (this.status === "finished") {
        this.driveLimbs();
        this.steadyTray();
      }
      if (this.timer <= 0) {
        this.restart();
        return;
      }
    }

    this.world.step(TICK, 8, 3);

    if (this.status !== "playing") return;

    const x = this.torso.getPosition().x;
    this.distance = Math.max(this.distance, clamp(x - START_X, 0, FINISH_X - START_X));
    this.best = Math.max(this.best, this.distance);

    if (Math.abs(wrap(this.torso.getAngle())) > FALL_ANGLE) this.pendingFail ??= "fell";
    if (this.dropped.size >= ITEMS.length) this.pendingFail ??= "dropped";
    if (this.pendingFail) {
      this.fail(this.pendingFail);
    } else if (x >= FINISH_X) {
      this.status = "finished";
      this.timer = FINISH_PAUSE;
      const left = ITEMS.length - this.dropped.size;
      if (left > this.bestItems || (left === this.bestItems && (this.bestTime === null || this.time < this.bestTime))) {
        this.bestTime = this.time;
      }
      this.bestItems = Math.max(this.bestItems, left);
    }
  }

  snapshot(): Snapshot {
    const parts: number[] = [];
    for (const b of this.parts) {
      const p = b.getPosition();
      parts.push(p.x, p.y, b.getAngle());
    }
    return {
      parts,
      status: this.status,
      failReason: this.failReason,
      attempt: this.attempt,
      best: this.best,
      distance: this.distance,
      time: this.time,
      bestTime: this.bestTime,
      itemsLeft: ITEMS.length - this.dropped.size,
      bestItems: this.bestItems,
      limp: [...this.limp],
    };
  }

  // ---------------------------------------------------------------------------

  private fail(reason: FailReason) {
    this.status = "failed";
    this.failReason = reason;
    this.timer = FAIL_PAUSE;
    this.updateMotors();
  }

  private updateMotors() {
    for (const id of LIMBS) {
      const on = this.status !== "failed" && !this.limp.has(id);
      this.limbs[id].upperJoint.enableMotor(on);
      this.limbs[id].lowerJoint.enableMotor(on);
    }
  }

  private selfRight() {
    const a = wrap(this.torso.getAngle());
    const w = this.torso.getAngularVelocity();
    this.torso.applyTorque(-(this.config.balanceAssist * a + this.config.balanceDamping * w), true);
  }

  private targetFor(limb: Limb, s: Stick, origin: { x: number; y: number }) {
    const c = this.config;
    if (limb.kind === "leg") {
      return {
        x: origin.x + LEG_STANCE[limb.id] + s.x * c.legReach,
        y: origin.y - LEG_REST + (s.y > 0 ? s.y * c.legLift : s.y * 0.08),
      };
    }
    const base = limb.id === FRONT_ARM ? FRONT_HAND : REAR_HAND;
    return {
      x: origin.x + base.x + s.x * c.armReach * 0.6,
      y: origin.y + base.y + s.y * c.armReach,
    };
  }

  private driveLimbs() {
    const torsoAngle = this.torso.getAngle();
    const hip = this.torso.getWorldPoint(HIP_LOCAL);
    const shoulder = this.torso.getWorldPoint(SHOULDER_LOCAL);
    const wanted = this.status === "finished" ? emptyInputs() : this.inputs;
    // Feet and hands chase the stick at a limited speed, so a flick doesn't whip the whole body.
    const maxMove = this.config.limbSpeed * TICK;
    for (const id of LIMBS) {
      if (this.limp.has(id)) continue;
      const cur = this.smoothed[id];
      const dx = wanted[id].x - cur.x;
      const dy = wanted[id].y - cur.y;
      const d = Math.hypot(dx, dy);
      const k = d > maxMove ? maxMove / d : 1;
      cur.x += dx * k;
      cur.y += dy * k;

      const limb = this.limbs[id];
      if (limb.kind === "leg") {
        // Legs are posed relative to the torso (a pure joint-angle pose). Aiming feet in world space
        // made planted feet shove the hip around, which set up a constant sway.
        const t = this.targetFor(limb, cur, HIP_LOCAL);
        const { a1, a2 } = solveIK(HIP_LOCAL.x, HIP_LOCAL.y, t.x, t.y, limb.L1, limb.L2, limb.bend);
        this.drive(limb.upperJoint, a1, this.config.legStrength);
        this.drive(limb.lowerJoint, a2 - a1, this.config.legStrength);
      } else {
        // Hands aim relative to where the shoulder would be if the torso were upright (above the hip),
        // so upper-body rocking is absorbed by the arms instead of yanking the tray around.
        const t = this.targetFor(limb, cur, { x: hip.x, y: hip.y + ARM_ANCHOR_RISE });
        const { a1, a2 } = solveIK(shoulder.x, shoulder.y, t.x, t.y, limb.L1, limb.L2, limb.bend);
        this.drive(limb.upperJoint, a1 - torsoAngle, this.config.armStrength);
        this.drive(limb.lowerJoint, a2 - limb.upper.getAngle(), this.config.armStrength);
      }
    }
  }

  /** Gently steer the tray toward the tilt the arms are asking for. */
  private steadyTray() {
    const front = this.limp.has(FRONT_ARM) ? 0 : this.smoothed[FRONT_ARM].y;
    const rear = this.limp.has(REAR_ARM) ? 0 : this.smoothed[REAR_ARM].y;
    const desired = Math.atan2((front - rear) * this.config.armReach, FRONT_HAND.x - REAR_HAND.x);
    const err = wrap(this.tray.getAngle() - desired);
    const k = this.config.trayAssist;
    this.tray.applyTorque(-(k * err + k * 0.12 * this.tray.getAngularVelocity()), true);
  }

  private drive(joint: RevoluteJoint, desired: number, strength: number) {
    const err = wrap(desired - joint.getJointAngle());
    joint.setMotorSpeed(clamp(this.config.motorGain * err, -20, 20));
    joint.setMaxMotorTorque(strength);
  }

  private build() {
    const c = this.config;
    this.status = "playing";
    this.failReason = null;
    this.pendingFail = null;
    this.distance = 0;
    this.time = 0;
    this.feet = [];
    this.itemFixtures = [];
    this.items = [];
    this.dropped = new Set();
    this.itemIndex = new Map();
    this.smoothed = emptyInputs();

    const world = new World({ gravity: { x: 0, y: -c.gravity }, allowSleep: false });
    this.world = world;

    const ground = world.createBody();
    ground.createFixture(new ChainShape(GROUND, false), { friction: 0.9, userData: "ground" satisfies Tag });

    // Torso + head, standing on neutral legs at the start line.
    const ankleClearance = FOOT_H - 0.02;
    const hipY = groundHeightAt(START_X) + ankleClearance + LEG_REST + 0.005;
    const torso = world.createBody({
      type: "dynamic",
      position: { x: START_X, y: hipY - HIP_LOCAL.y },
      angularDamping: c.torsoDamping,
    });
    const bodyFix = { density: 60, friction: 0.6, filterGroupIndex: BODY_GROUP, filterCategoryBits: CAT_BODY };
    torso.createFixture(new BoxShape(TORSO_W / 2, TORSO_H / 2), { ...bodyFix, userData: "torso" satisfies Tag });
    torso.createFixture(new CircleShape({ x: 0, y: HEAD_Y }, HEAD_R), { ...bodyFix, density: 40, userData: "torso" satisfies Tag });
    this.torso = torso;

    const makeLimb = (id: LimbId): Limb => {
      const kind = id.endsWith("Leg") ? "leg" : "arm";
      const L1 = kind === "leg" ? THIGH : UPPER_ARM;
      const L2 = kind === "leg" ? SHIN : FOREARM;
      const w = kind === "leg" ? LEG_W : ARM_W;
      const origin = torso.getWorldPoint(kind === "leg" ? HIP_LOCAL : SHOULDER_LOCAL);

      // Bones are built hanging straight down (angle 0) so joint angles start at 0.
      const upper = world.createBody({ type: "dynamic", position: origin, angularDamping: 0.3 });
      upper.createFixture(new BoxShape(w / 2, L1 / 2, { x: 0, y: -L1 / 2 }), { ...bodyFix, userData: "limb" satisfies Tag });
      const lower = world.createBody({ type: "dynamic", position: { x: origin.x, y: origin.y - L1 }, angularDamping: 0.3 });
      lower.createFixture(new BoxShape(w / 2 * 0.92, L2 / 2, { x: 0, y: -L2 / 2 }), { ...bodyFix, userData: "limb" satisfies Tag });
      if (kind === "leg") {
        this.feet.push(lower.createFixture(
          new BoxShape(FOOT_W / 2, FOOT_H / 2, { x: FOOT_FORWARD, y: -L2 - FOOT_H / 2 + 0.02 }),
          { ...bodyFix, friction: c.footFriction, userData: "foot" satisfies Tag },
        ));
      }

      const upperJoint = world.createJoint(new RevoluteJoint({
        enableLimit: true,
        lowerAngle: kind === "leg" ? -0.8 : -1.6,
        upperAngle: kind === "leg" ? 2.0 : 3.1,
        enableMotor: true,
        maxMotorTorque: 0,
      }, torso, upper, origin))!;
      const lowerJoint = world.createJoint(new RevoluteJoint({
        enableLimit: true,
        lowerAngle: kind === "leg" ? -2.5 : -0.02,
        upperAngle: kind === "leg" ? 0.02 : 2.6,
        enableMotor: true,
        maxMotorTorque: 0,
      }, upper, lower, { x: origin.x, y: origin.y - L1 }))!;

      return { id, kind, upper, lower, upperJoint, lowerJoint, L1, L2, bend: kind === "leg" ? 1 : -1 };
    };

    this.limbs = {
      leftLeg: makeLimb("leftLeg"),
      rightLeg: makeLimb("rightLeg"),
      leftArm: makeLimb("leftArm"),
      rightArm: makeLimb("rightArm"),
    };

    // Pose every limb at its neutral target before the first step.
    const neutral = emptyInputs();
    for (const id of LIMBS) {
      const limb = this.limbs[id];
      const origin = torso.getWorldPoint(limb.kind === "leg" ? HIP_LOCAL : SHOULDER_LOCAL);
      const t = this.targetFor(limb, neutral[id], origin);
      const { a1, a2 } = solveIK(origin.x, origin.y, t.x, t.y, limb.L1, limb.L2, limb.bend);
      limb.upper.setTransform(origin, a1);
      limb.lower.setTransform(limb.upper.getWorldPoint({ x: 0, y: -limb.L1 }), a2);
    }

    // Tray held by both hands: front arm at the front end, rear arm at the back.
    const handOf = (id: LimbId) => this.limbs[id].lower.getWorldPoint({ x: 0, y: -FOREARM });
    const front = handOf(FRONT_ARM);
    const rear = handOf(id2(FRONT_ARM));
    const trayAngle = Math.atan2(front.y - rear.y, front.x - rear.x);
    const trayCenter = {
      x: (front.x + rear.x) / 2 - Math.sin(trayAngle) * (TRAY_H / 2 + 0.005),
      y: (front.y + rear.y) / 2 + Math.cos(trayAngle) * (TRAY_H / 2 + 0.005),
    };
    const tray = world.createBody({ type: "dynamic", position: trayCenter, angle: trayAngle });
    const trayFix = { density: 25, friction: 1, filterGroupIndex: BODY_GROUP, userData: "tray" satisfies Tag };
    tray.createFixture(new BoxShape(TRAY_W / 2, TRAY_H / 2), trayFix);
    // Raised rims at both ends stop items sliding straight off.
    for (const side of [-1, 1]) {
      tray.createFixture(new BoxShape(TRAY_RIM_W / 2, TRAY_RIM_H / 2, {
        x: side * (TRAY_W / 2 - TRAY_RIM_W / 2),
        y: TRAY_H / 2 + TRAY_RIM_H / 2,
      }), trayFix);
    }
    world.createJoint(new RevoluteJoint({}, this.limbs[FRONT_ARM].lower, tray, front));
    world.createJoint(new RevoluteJoint({}, this.limbs[id2(FRONT_ARM)].lower, tray, rear));
    this.tray = tray;

    // Let the body settle into its stance before stacking, so the spawn doesn't launch the items.
    for (let i = 0; i < 45; i++) {
      this.driveLimbs();
      this.selfRight();
      this.steadyTray();
      world.step(TICK, 8, 3);
    }

    // Stack the items on the tray, in the tray's own frame.
    let y = TRAY_H / 2;
    for (const def of ITEMS) {
      y += def.h / 2 + 0.002;
      const item = world.createBody({ type: "dynamic", position: tray.getWorldPoint({ x: 0, y }), angle: tray.getAngle() });
      const fixture = item.createFixture(new BoxShape(def.w / 2, def.h / 2), {
        density: 15, friction: c.itemFriction, userData: "item" satisfies Tag,
        filterMaskBits: 0xffff & ~CAT_BODY, // items pass through the body; only tray, items and ground catch them
      });
      this.itemIndex.set(fixture, this.itemFixtures.length);
      this.itemFixtures.push(fixture);
      this.items.push(item);
      y += def.h / 2;
    }

    // Same order as PART_IDS in layout.ts.
    const L = this.limbs;
    this.parts = [
      torso,
      L.rightLeg.upper, L.rightLeg.lower,
      L.rightArm.upper, L.rightArm.lower,
      L.leftLeg.upper, L.leftLeg.lower,
      L.leftArm.upper, L.leftArm.lower,
      tray,
      ...this.items,
    ];

    world.on("begin-contact", (contact) => {
      const fa = contact.getFixtureA();
      const fb = contact.getFixtureB();
      const a = fa.getUserData() as Tag;
      const b = fb.getUserData() as Tag;
      if (a !== "ground" && b !== "ground") return;
      const otherFixture = a === "ground" ? fb : fa;
      const other = a === "ground" ? b : a;
      // A dropped item is lost for this run; the run only ends when all are gone.
      if (other === "item" && this.status === "playing") this.dropped.add(this.itemIndex.get(otherFixture)!);
      else if (other === "torso") this.pendingFail ??= "fell";
    });

    this.updateMotors();
  }
}

/** The other arm. */
function id2(arm: LimbId): LimbId {
  return arm === "leftArm" ? "rightArm" : "leftArm";
}
