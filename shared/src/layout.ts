// Static geometry of the body, the items and the course (metres, y up).
// Shared by the simulation and the renderer so they always agree.

export type LimbId = "leftLeg" | "rightLeg" | "leftArm" | "rightArm";
export const LIMBS: LimbId[] = ["leftLeg", "rightLeg", "leftArm", "rightArm"];

export const LIMB_COLORS: Record<LimbId, string> = {
  leftLeg: "#ff6b6b",
  rightLeg: "#ffb347",
  leftArm: "#3ecfc4",
  rightArm: "#9b7bff",
};

export const LIMB_LABELS: Record<LimbId, string> = {
  leftLeg: "Left leg",
  rightLeg: "Right leg",
  leftArm: "Left arm",
  rightArm: "Right arm",
};

export const TORSO_W = 0.36;
export const TORSO_H = 0.7;
export const HEAD_R = 0.14;
export const HEAD_Y = TORSO_H / 2 + HEAD_R + 0.02; // head centre, torso-local

export const THIGH = 0.44;
export const SHIN = 0.44;
export const LEG_W = 0.13;
export const FOOT_W = 0.24;
export const FOOT_H = 0.07;
export const FOOT_FORWARD = 0.06; // foot centre offset forward of the ankle

export const UPPER_ARM = 0.3;
export const FOREARM = 0.3;
export const ARM_W = 0.1;

/** Joint positions on the torso (torso-local). */
export const HIP_LOCAL = { x: 0, y: -TORSO_H / 2 + 0.04 };
export const SHOULDER_LOCAL = { x: 0, y: TORSO_H / 2 - 0.06 };

/** Standing foot target: ankle this far below the hip (fraction of full leg length). */
export const LEG_REST = 0.92 * (THIGH + SHIN);

/** Neutral hand targets relative to the shoulder (world axes). */
export const REAR_HAND = { x: 0.12, y: -0.22 };
export const FRONT_HAND = { x: 0.42, y: -0.22 };
/** Which arm holds which end of the tray. */
export const FRONT_ARM: LimbId = "leftArm";
export const REAR_ARM: LimbId = "rightArm";

export const TRAY_W = 0.62;
export const TRAY_H = 0.04;
export const TRAY_RIM_W = 0.03;
export const TRAY_RIM_H = 0.1;

export interface ItemDef {
  w: number;
  h: number;
  color: string;
}
export const ITEMS: ItemDef[] = [
  { w: 0.4, h: 0.075, color: "#f7c59f" },
  { w: 0.36, h: 0.07, color: "#8ecae6" },
  { w: 0.32, h: 0.07, color: "#ffd166" },
  { w: 0.27, h: 0.065, color: "#ef8fb1" },
];

// Course: flat start → ramp up → plateau → step down → finish.
export const START_X = 0;
export const FINISH_X = 14.5;
export const GROUND: { x: number; y: number }[] = [
  { x: -6, y: 4 },
  { x: -6, y: 0 },
  { x: 5, y: 0 },
  { x: 8, y: 0.4 },
  { x: 10.5, y: 0.4 },
  { x: 10.5, y: 0.15 },
  { x: 17.5, y: 0.15 },
  { x: 17.5, y: 4 },
];

export function groundHeightAt(x: number): number {
  for (let i = 1; i < GROUND.length; i++) {
    const a = GROUND[i - 1];
    const b = GROUND[i];
    if (x >= a.x && x <= b.x && b.x > a.x) {
      return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
  }
  return 0;
}

/** Order of parts in a snapshot. Bones have their origin at the joint and point "down" at angle 0. */
export type PartId =
  | "torso"
  | "rightLeg.upper"
  | "rightLeg.lower"
  | "rightArm.upper"
  | "rightArm.lower"
  | "leftLeg.upper"
  | "leftLeg.lower"
  | "leftArm.upper"
  | "leftArm.lower"
  | "tray"
  | "item0"
  | "item1"
  | "item2"
  | "item3";

export const PART_IDS: PartId[] = [
  "torso",
  "rightLeg.upper",
  "rightLeg.lower",
  "rightArm.upper",
  "rightArm.lower",
  "leftLeg.upper",
  "leftLeg.lower",
  "leftArm.upper",
  "leftArm.lower",
  "tray",
  "item0",
  "item1",
  "item2",
  "item3",
];
