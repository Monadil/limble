import type { LimbId } from "./layout";

/** A stick or limb input, each axis in [-1, 1]. y is up. */
export interface Stick {
  x: number;
  y: number;
}

export type LimbInputs = Record<LimbId, Stick>;

export const ZERO: Stick = { x: 0, y: 0 };

export function emptyInputs(): LimbInputs {
  return {
    leftLeg: { ...ZERO },
    rightLeg: { ...ZERO },
    leftArm: { ...ZERO },
    rightArm: { ...ZERO },
  };
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

type LegId = "leftLeg" | "rightLeg";

/** Tunables for the swipe-to-step gait (stick units: 1 = full leg reach). */
export const GAIT = {
  stepTime: 0.42, // seconds for one step
  forward: 0.55, // where the stepping foot lands
  back: -0.4, // where the planted foot pushes back to
  lift: 0.65, // step height (fraction of leg lift); dragging up adds more
  trigger: 0.45, // stick |x| that starts a step
  rearm: 0.25, // stick must come back inside this before the same side can trigger again
  settleAfter: 0.8, // seconds idle before feet drift back under the body
};

/**
 * One stick driving both legs, swipe-to-step.
 * Drag right: the left leg takes a step (lift, swing forward, plant) while the right foot pushes back.
 * Drag left: the right leg steps. Alternate left/right to walk. Drag further up for higher steps.
 * Dragging down presses both feet into the ground (stands taller).
 * The joints are still physics-driven, so bad timing still trips you up.
 */
export class PairLegsGait {
  private foot: Record<LegId, number> = { leftLeg: 0, rightLeg: 0 };
  private step: { leg: LegId; t: number; from: number; standFrom: number } | null = null;
  private armed = { right: true, left: true };
  private idle = 0;
  /** Number of steps taken (for UI/debug). */
  steps = 0;

  reset() {
    this.foot = { leftLeg: 0, rightLeg: 0 };
    this.step = null;
    this.armed = { right: true, left: true };
    this.idle = 0;
  }

  update(s: Stick, dt: number): Pick<LimbInputs, LegId> {
    if (s.x < GAIT.rearm) this.armed.right = true;
    if (s.x > -GAIT.rearm) this.armed.left = true;

    const canStart = !this.step || this.step.t > 0.65;
    let start: LegId | null = null;
    if (canStart && s.x >= GAIT.trigger && this.armed.right) start = "leftLeg";
    if (canStart && s.x <= -GAIT.trigger && this.armed.left) start = "rightLeg";
    if (start) {
      if (start === "leftLeg") this.armed.right = false;
      else this.armed.left = false;
      const other: LegId = start === "leftLeg" ? "rightLeg" : "leftLeg";
      this.step = { leg: start, t: 0, from: this.foot[start], standFrom: this.foot[other] };
      this.steps++;
    }

    const press = Math.min(0, s.y);
    const out: Pick<LimbInputs, LegId> = {
      leftLeg: { x: this.foot.leftLeg, y: press },
      rightLeg: { x: this.foot.rightLeg, y: press },
    };

    if (this.step) {
      this.idle = 0;
      const st = this.step;
      st.t = Math.min(1, st.t + dt / GAIT.stepTime);
      const e = st.t * st.t * (3 - 2 * st.t); // ease in-out
      const stand: LegId = st.leg === "leftLeg" ? "rightLeg" : "leftLeg";
      this.foot[st.leg] = st.from + (GAIT.forward - st.from) * e;
      this.foot[stand] = st.standFrom + (Math.min(st.standFrom, GAIT.back) - st.standFrom) * e;
      const lift = Math.min(1, GAIT.lift + Math.max(0, s.y) * 0.5) * Math.sin(Math.PI * st.t);
      out[st.leg] = { x: this.foot[st.leg], y: lift };
      out[stand] = { x: this.foot[stand], y: press };
      if (st.t >= 1) this.step = null;
    } else {
      this.idle += dt;
      if (this.idle > GAIT.settleAfter && Math.abs(s.x) < GAIT.rearm) {
        // Slowly bring the feet back under the body.
        for (const leg of ["leftLeg", "rightLeg"] as LegId[]) {
          const f = this.foot[leg];
          this.foot[leg] = f - Math.sign(f) * Math.min(Math.abs(f), dt * 0.8);
          out[leg].x = this.foot[leg];
        }
      }
    }
    return out;
  }
}

/**
 * One stick driving both arms (which hold the tray).
 * Up/down raises or lowers the tray. Left/right tilts it (right = front end dips).
 */
export function armsFromPairStick(s: Stick): Pick<LimbInputs, "leftArm" | "rightArm"> {
  const tilt = 0.8;
  return {
    // leftArm holds the front of the tray, rightArm the rear (see layout.ts)
    leftArm: { x: 0, y: clamp1(s.y - s.x * tilt) },
    rightArm: { x: 0, y: clamp1(s.y + s.x * tilt) },
  };
}
