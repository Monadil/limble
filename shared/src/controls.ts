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

/**
 * One stick driving both legs.
 * Drag right: left leg swings forward (drag up to lift it) while the right leg pushes back.
 * Drag left: the right leg steps instead. Rocking left/right = walking.
 * Dragging down presses both feet into the ground (stands taller).
 */
export function legsFromPairStick(s: Stick): Pick<LimbInputs, "leftLeg" | "rightLeg"> {
  const dead = 0.15;
  const down = Math.min(0, s.y);
  return {
    leftLeg: { x: s.x, y: s.x > dead ? s.y : down },
    rightLeg: { x: -s.x, y: s.x < -dead ? s.y : down },
  };
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
