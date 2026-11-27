import {
  FINISH_X, LIMBS, LimbleSim, START_X, TICK, armsFromPairStick, legsFromPairStick,
} from "@limble/shared";
import { loadSavedConfig, mountDebugPanel } from "./debug";
import { Joysticks } from "./joysticks";
import { Renderer } from "./render";

const debug = new URLSearchParams(location.search).has("debug");

const canvas = document.getElementById("game") as HTMLCanvasElement;
const sim = new LimbleSim(debug ? loadSavedConfig() : {});
const renderer = new Renderer(canvas);
const sticks = new Joysticks(canvas);

if (debug) mountDebugPanel(sim);

const hints = document.getElementById("hints")!;
sticks.onFirstTouch = () => {
  setTimeout(() => hints.classList.add("hidden"), 2500);
  sticks.onFirstTouch = undefined;
};

// Stop iOS pinch-zoom and double-tap zoom.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

const $ = (id: string) => document.getElementById(id)!;
const hud = {
  attempt: $("attempt"),
  best: $("best"),
  time: $("time"),
  fill: $("progress-fill"),
  bestMark: $("progress-best"),
  banner: $("banner"),
};
let lastBanner = "";

function updateHud() {
  const s = sim.snapshot();
  const total = FINISH_X - START_X;
  hud.attempt.textContent = `Attempt ${s.attempt}`;
  hud.best.textContent = `Best ${s.best.toFixed(1)} m` + (s.bestTime ? ` · ${s.bestTime.toFixed(1)}s` : "");
  hud.time.textContent = `${s.time.toFixed(1)}s`;
  hud.fill.style.width = `${(s.distance / total) * 100}%`;
  hud.bestMark.style.left = `calc(${(s.best / total) * 100}% - 1.5px)`;

  let banner = "";
  if (s.status === "failed") {
    banner = s.failReason === "dropped" ? "DROPPED IT!" : "FELL OVER!";
    banner += `<small>${s.distance.toFixed(1)} m</small>`;
  } else if (s.status === "finished") {
    banner = `DELIVERED!<small>${s.time.toFixed(1)} s</small>`;
  }
  if (banner !== lastBanner) {
    hud.banner.innerHTML = banner || hud.banner.innerHTML;
    hud.banner.classList.toggle("show", !!banner);
    lastBanner = banner;
  }
  return s;
}

let last = performance.now();
let acc = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;

  // Solo: left thumb = both legs, right thumb = both arms.
  sim.setInputs({ ...legsFromPairStick(sticks.read("left")), ...armsFromPairStick(sticks.read("right")) });

  let steps = 0;
  while (acc >= TICK && steps < 6) {
    sim.step();
    acc -= TICK;
    steps++;
  }
  if (steps === 6) acc = 0;

  const snap = updateHud();
  renderer.draw(snap, dt, sticks, LIMBS);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the sim from the console.
(window as unknown as { limble: unknown }).limble = { sim };
