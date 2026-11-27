import type { Stick } from "@limble/shared";

export type Zone = "left" | "right";

interface Active {
  pointerId: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

/**
 * Floating joysticks: a stick appears wherever a thumb lands on its half of the screen.
 * Also maps WASD (left) and arrow keys (right) for desktop testing.
 */
export class Joysticks {
  private active: Partial<Record<Zone, Active>> = {};
  private keys = new Set<string>();
  onFirstTouch?: () => void;

  constructor(private el: HTMLElement) {
    el.addEventListener("pointerdown", this.down);
    el.addEventListener("pointermove", this.move);
    el.addEventListener("pointerup", this.up);
    el.addEventListener("pointercancel", this.up);
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
      this.onFirstTouch?.();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Stick radius in CSS pixels. */
  get radius() {
    return Math.max(40, Math.min(75, window.innerHeight * 0.17));
  }

  read(zone: Zone): Stick {
    const a = this.active[zone];
    if (a) {
      const r = this.radius;
      let x = (a.x - a.ox) / r;
      let y = -(a.y - a.oy) / r;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    }
    const k = this.keys;
    const [l, r, u, d] =
      zone === "left" ? ["a", "d", "w", "s"] : ["arrowleft", "arrowright", "arrowup", "arrowdown"];
    return { x: (k.has(r) ? 1 : 0) - (k.has(l) ? 1 : 0), y: (k.has(u) ? 1 : 0) - (k.has(d) ? 1 : 0) };
  }

  /** For drawing: origin and knob position of each active stick. */
  visible(): { zone: Zone; ox: number; oy: number; kx: number; ky: number }[] {
    const out = [];
    for (const zone of ["left", "right"] as Zone[]) {
      const a = this.active[zone];
      if (!a) continue;
      const s = this.read(zone);
      out.push({ zone, ox: a.ox, oy: a.oy, kx: a.ox + s.x * this.radius, ky: a.oy - s.y * this.radius });
    }
    return out;
  }

  private down = (e: PointerEvent) => {
    const zone: Zone = e.clientX < window.innerWidth / 2 ? "left" : "right";
    if (this.active[zone]) return;
    this.el.setPointerCapture(e.pointerId);
    this.active[zone] = { pointerId: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    this.onFirstTouch?.();
    e.preventDefault();
  };

  private move = (e: PointerEvent) => {
    for (const a of Object.values(this.active)) {
      if (a && a.pointerId === e.pointerId) {
        a.x = e.clientX;
        a.y = e.clientY;
      }
    }
  };

  private up = (e: PointerEvent) => {
    for (const zone of ["left", "right"] as Zone[]) {
      if (this.active[zone]?.pointerId === e.pointerId) delete this.active[zone];
    }
  };
}
