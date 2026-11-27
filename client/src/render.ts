import {
  ARM_W, FINISH_X, FOOT_FORWARD, FOOT_H, FOOT_W, FOREARM, GROUND, HEAD_R, HEAD_Y, ITEMS, LEG_W,
  LIMB_COLORS, PART_IDS, SHIN, START_X, THIGH, TORSO_H, TORSO_W, TRAY_H, TRAY_W, UPPER_ARM,
  groundHeightAt, type LimbId, type PartId, type Snapshot,
} from "@limble/shared";
import type { Joysticks } from "./joysticks";

const VIEW_HEIGHT_M = 3.6;
const INK = "#2b2d42";

const idx = Object.fromEntries(PART_IDS.map((id, i) => [id, i * 3])) as Record<PartId, number>;

function mix(hex: string, toward: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(toward);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private camX = START_X + 0.8;
  private camY = 1.1;
  private scale = 100;
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = this.h / VIEW_HEIGHT_M;
  }

  private sx(x: number) {
    return (x - this.camX) * this.scale + this.w / 2;
  }
  private sy(y: number) {
    return this.h * 0.55 - (y - this.camY) * this.scale;
  }

  /** Run fn in a part's local frame, in metres with y up. */
  private local(x: number, y: number, a: number, fn: (c: CanvasRenderingContext2D) => void) {
    const c = this.ctx;
    c.save();
    c.translate(this.sx(x), this.sy(y));
    c.scale(this.scale, -this.scale);
    c.rotate(a);
    fn(c);
    c.restore();
  }

  draw(snap: Snapshot, dt: number, sticks: Joysticks, highlight: LimbId[]) {
    const p = snap.parts;
    const tx = p[idx.torso];
    const k = Math.min(1, dt * 4);
    this.camX += (tx + 0.8 - this.camX) * k;
    this.camY += (groundHeightAt(tx) + 1.1 - this.camY) * k;

    this.background();
    this.course();

    const limp = new Set(snap.limp);
    const colorOf = (id: LimbId, far: boolean) => {
      if (limp.has(id)) return "#b8b8c4";
      const base = LIMB_COLORS[id];
      return far ? mix(base, INK, 0.3) : base;
    };

    // Far side first, near side last.
    this.leg(p, "rightLeg", colorOf("rightLeg", true), highlight.includes("rightLeg"));
    this.arm(p, "rightArm", colorOf("rightArm", true), highlight.includes("rightArm"));
    this.torso(p);
    this.leg(p, "leftLeg", colorOf("leftLeg", false), highlight.includes("leftLeg"));
    this.trayAndItems(p);
    this.arm(p, "leftArm", colorOf("leftArm", false), highlight.includes("leftArm"));

    this.sticks(sticks);
  }

  private background() {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, "#a9d6ff");
    g.addColorStop(1, "#e9f5ff");
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);

    // Parallax hills
    const hills = [
      { par: 0.25, color: "#c4e3c6", r: 6, gap: 9, y: -4.3 },
      { par: 0.5, color: "#a9d8ad", r: 4, gap: 6.5, y: -3.0 },
    ];
    for (const hill of hills) {
      c.fillStyle = hill.color;
      const offset = this.camX * (1 - hill.par);
      const startI = Math.floor((this.camX - offset - 12) / hill.gap);
      for (let i = startI; i < startI + 8; i++) {
        const wx = i * hill.gap + offset;
        c.beginPath();
        c.arc(this.sx(wx), this.sy(hill.y + this.camY * 0.6), hill.r * this.scale, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private course() {
    const c = this.ctx;
    // Ground
    c.beginPath();
    c.moveTo(this.sx(GROUND[0].x), this.sy(-10));
    for (const pt of GROUND) c.lineTo(this.sx(pt.x), this.sy(pt.y));
    c.lineTo(this.sx(GROUND[GROUND.length - 1].x), this.sy(-10));
    c.closePath();
    c.fillStyle = "#8fbf6f";
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = "#6a9e4f";
    c.lineJoin = "round";
    c.beginPath();
    GROUND.forEach((pt, i) => (i ? c.lineTo(this.sx(pt.x), this.sy(pt.y)) : c.moveTo(this.sx(pt.x), this.sy(pt.y))));
    c.stroke();

    // Distance markers
    c.font = "700 11px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillStyle = "rgba(43,45,66,0.45)";
    for (let m = 2; m < FINISH_X - START_X; m += 2) {
      const x = START_X + m;
      const gy = groundHeightAt(x);
      c.fillRect(this.sx(x) - 1, this.sy(gy) - 10, 2, 10);
      c.fillText(`${m}m`, this.sx(x), this.sy(gy) + 18);
    }

    // Start line
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 3;
    c.setLineDash([6, 6]);
    c.beginPath();
    c.moveTo(this.sx(START_X), this.sy(groundHeightAt(START_X)));
    c.lineTo(this.sx(START_X), this.sy(groundHeightAt(START_X) + 2.2));
    c.stroke();
    c.setLineDash([]);

    // Finish flag
    const fy = groundHeightAt(FINISH_X);
    c.fillStyle = INK;
    c.fillRect(this.sx(FINISH_X) - 2, this.sy(fy + 2.4), 4, 2.4 * this.scale);
    const fw = 0.7 * this.scale;
    const fh = 0.45 * this.scale;
    const fx = this.sx(FINISH_X) + 2;
    const fyTop = this.sy(fy + 2.4);
    const n = 5;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        c.fillStyle = (i + j) % 2 ? "#fff" : INK;
        c.fillRect(fx + (i * fw) / n, fyTop + (j * fh) / 3, fw / n + 0.5, fh / 3 + 0.5);
      }
    }
  }

  private bone(c: CanvasRenderingContext2D, len: number, width: number, color: string, outline: boolean) {
    c.lineCap = "round";
    if (outline) {
      c.strokeStyle = "#fff";
      c.lineWidth = width + 0.05;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -len);
      c.stroke();
    }
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -len);
    c.stroke();
  }

  private leg(p: number[], id: LimbId, color: string, hl: boolean) {
    const u = idx[`${id}.upper` as PartId];
    const l = idx[`${id}.lower` as PartId];
    this.local(p[l], p[l + 1], p[l + 2], (c) => {
      this.bone(c, SHIN, LEG_W * 0.92, color, hl);
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(FOOT_FORWARD - FOOT_W / 2, -SHIN - FOOT_H + 0.02, FOOT_W, FOOT_H, 0.03);
      c.fill();
    });
    this.local(p[u], p[u + 1], p[u + 2], (c) => this.bone(c, THIGH, LEG_W, color, hl));
  }

  private arm(p: number[], id: LimbId, color: string, hl: boolean) {
    const u = idx[`${id}.upper` as PartId];
    const l = idx[`${id}.lower` as PartId];
    this.local(p[u], p[u + 1], p[u + 2], (c) => this.bone(c, UPPER_ARM, ARM_W, color, hl));
    this.local(p[l], p[l + 1], p[l + 2], (c) => {
      this.bone(c, FOREARM, ARM_W * 0.92, color, hl);
      c.fillStyle = color;
      c.beginPath();
      c.arc(0, -FOREARM, ARM_W * 0.62, 0, Math.PI * 2);
      c.fill();
    });
  }

  private torso(p: number[]) {
    const t = idx.torso;
    this.local(p[t], p[t + 1], p[t + 2], (c) => {
      c.fillStyle = "#3d405b";
      c.beginPath();
      c.roundRect(-TORSO_W / 2, -TORSO_H / 2, TORSO_W, TORSO_H, 0.12);
      c.fill();
      // Head
      c.fillStyle = "#f4d6b0";
      c.beginPath();
      c.arc(0, HEAD_Y, HEAD_R, 0, Math.PI * 2);
      c.fill();
      // Eye + mouth, facing right
      c.fillStyle = INK;
      c.beginPath();
      c.arc(0.07, HEAD_Y + 0.035, 0.018, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 0.014;
      c.beginPath();
      c.arc(0.06, HEAD_Y - 0.03, 0.035, -1.2, -0.2);
      c.stroke();
    });
  }

  private trayAndItems(p: number[]) {
    const t = idx.tray;
    this.local(p[t], p[t + 1], p[t + 2], (c) => {
      c.fillStyle = "#c9ced6";
      c.beginPath();
      c.roundRect(-TRAY_W / 2, -TRAY_H / 2, TRAY_W, TRAY_H, 0.015);
      c.fill();
    });
    ITEMS.forEach((def, i) => {
      const k = idx[`item${i}` as PartId];
      this.local(p[k], p[k + 1], p[k + 2], (c) => {
        c.fillStyle = def.color;
        c.strokeStyle = "rgba(43,45,66,0.35)";
        c.lineWidth = 0.012;
        c.beginPath();
        c.roundRect(-def.w / 2, -def.h / 2, def.w, def.h, 0.025);
        c.fill();
        c.stroke();
      });
    });
  }

  private sticks(sticks: Joysticks) {
    const c = this.ctx;
    const r = sticks.radius;
    for (const s of sticks.visible()) {
      const col = s.zone === "left" ? "255,107,107" : "62,207,196";
      c.fillStyle = `rgba(${col},0.18)`;
      c.strokeStyle = `rgba(${col},0.6)`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(s.ox, s.oy, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = `rgba(${col},0.75)`;
      c.beginPath();
      c.arc(s.kx, s.ky, r * 0.42, 0, Math.PI * 2);
      c.fill();
    }
  }
}
