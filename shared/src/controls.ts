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

export type LegId = "leftLeg" | "rightLeg";
const otherLeg = (leg: LegId): LegId => (leg === "leftLeg" ? "rightLeg" : "leftLeg");

/** Tunables for drag-to-place stepping (stick units: 1 = full leg reach). */
export const STEP = {
  start: 0.15, // how far the thumb must move before a step begins
  range: 1.2, // full drag moves the foot this far (relative to the hip)
  push: 1.0, // how much the planted foot pushes back as the other swings forward
  minLift: 0.3, // automatic foot clearance while swinging; drag up for more
};

/**
 * One stick driving both legs: drag to place a foot.
 *
 * - Drag forward (right): the free foot swings forward to follow your thumb, while the planted
 *   foot pushes the body forward. Drag further for a longer stride, up for a higher step.
 * - Let go: the foot plants where it is, and the other foot becomes the free one.
 *   So the feet take turns: drag, let go, drag, let go… to walk.
 * - Drag backward (left) to step back.
 *
 * Feet stay where you put them, so overstriding (splits) or tiny shuffles have consequences.
 * The joints are physics-driven, so it's still wobbly.
 */
export class PairLegsGait {
  /** The foot that moves on the next drag. */
  nextLeg: LegId = "leftLeg";
  /** Number of steps planted (for UI/debug). */
  steps = 0;

  private foot: Record<LegId, number> = { leftLeg: 0, rightLeg: 0 };
  private swing: { leg: LegId; from: number; standFrom: number } | null = null;

  reset() {
    this.nextLeg = "leftLeg";
    this.steps = 0;
    this.foot = { leftLeg: 0, rightLeg: 0 };
    this.swing = null;
  }

  /** `s` is the stick, or null when no thumb is on the legs zone. */
  update(s: Stick | null): Pick<LimbInputs, LegId> {
    const active = s !== null && Math.hypot(s.x, s.y) > STEP.start;

    if (active && !this.swing) {
      const leg = this.nextLeg;
      this.swing = { leg, from: this.foot[leg], standFrom: this.foot[otherLeg(leg)] };
    }

    if (this.swing && !active) {
      // Thumb lifted (or back to centre): plant the foot and hand over to the other one.
      this.nextLeg = otherLeg(this.swing.leg);
      this.swing = null;
      this.steps++;
    }

    const press = s ? Math.min(0, s.y) : 0;
    const out: Pick<LimbInputs, LegId> = {
      leftLeg: { x: this.foot.leftLeg, y: press },
      rightLeg: { x: this.foot.rightLeg, y: press },
    };

    if (this.swing && s) {
      const { leg, from, standFrom } = this.swing;
      const stand = otherLeg(leg);
      const x = clamp1(from + s.x * STEP.range);
      this.foot[leg] = x;
      this.foot[stand] = clamp1(standFrom - (x - from) * STEP.push);
      out[leg] = { x, y: Math.max(STEP.minLift, s.y) };
      out[stand] = { x: this.foot[stand], y: 0 };
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
