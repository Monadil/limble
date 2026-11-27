// Tunable gameplay values. The debug panel (?debug=1) edits these live.
// When something feels right, copy the values and make them the defaults here.

export interface Config {
  /** Self-righting torque on the torso per radian of lean (N·m/rad). */
  balanceAssist: number;
  /** Damps torso wobble so self-righting doesn't oscillate (N·m·s/rad). */
  balanceDamping: number;
  /** Damping on the torso's rotation; calms sway and wobble (applies on restart). */
  torsoDamping: number;
  /** Max torque of hip and knee motors (N·m). */
  legStrength: number;
  /** Max torque of shoulder and elbow motors (N·m). */
  armStrength: number;
  /** How hard joints chase their target angle (1/s). Higher = snappier limbs. */
  motorGain: number;
  /** How fast feet/hands follow the stick (full stick travels per second). Lower = smoother, less whippy. */
  limbSpeed: number;
  /** Gravity (m/s²). Earth is 9.8. */
  gravity: number;
  /** How far forward/back a foot can reach from the hip (m). */
  legReach: number;
  /** How high a foot lifts at full stick (m). */
  legLift: number;
  /** How far up/down the hands move at full stick (m). */
  armReach: number;
  /** Torque nudging the tray toward the tilt the arms ask for (N·m/rad). 0 = no help. */
  trayAssist: number;
  /** Friction of the stacked items. */
  itemFriction: number;
  /** Friction of the feet on the ground. */
  footFriction: number;
}

export const DEFAULT_CONFIG: Config = {
  balanceAssist: 800,
  balanceDamping: 200,
  torsoDamping: 0.3,
  legStrength: 260,
  armStrength: 70,
  motorGain: 12,
  limbSpeed: 3,
  gravity: 9.8,
  legReach: 0.35,
  legLift: 0.28,
  armReach: 0.2,
  trayAssist: 40,
  itemFriction: 1.3,
  footFriction: 1.2,
};

export interface ConfigRange {
  key: keyof Config;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const CONFIG_RANGES: ConfigRange[] = [
  { key: "balanceAssist", label: "Self-righting", min: 0, max: 1500, step: 10 },
  { key: "balanceDamping", label: "Self-right damping", min: 0, max: 400, step: 5 },
  { key: "torsoDamping", label: "Torso damping", min: 0, max: 15, step: 0.1 },
  { key: "legStrength", label: "Leg strength", min: 0, max: 800, step: 5 },
  { key: "armStrength", label: "Arm strength", min: 0, max: 250, step: 1 },
  { key: "motorGain", label: "Limb snappiness", min: 1, max: 40, step: 0.5 },
  { key: "limbSpeed", label: "Limb speed", min: 0.5, max: 12, step: 0.25 },
  { key: "gravity", label: "Gravity", min: 1, max: 20, step: 0.1 },
  { key: "legReach", label: "Leg reach", min: 0.05, max: 0.6, step: 0.01 },
  { key: "legLift", label: "Leg lift", min: 0.05, max: 0.5, step: 0.01 },
  { key: "armReach", label: "Arm reach", min: 0.02, max: 0.4, step: 0.01 },
  { key: "trayAssist", label: "Tray steadiness", min: 0, max: 80, step: 1 },
  { key: "itemFriction", label: "Item friction", min: 0, max: 1.5, step: 0.05 },
  { key: "footFriction", label: "Foot friction", min: 0, max: 2.5, step: 0.05 },
];
