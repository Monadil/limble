// Run the physics without a browser to compare settings and play styles quickly.
// A scripted player repeatedly drags the legs stick forward to `stride` (0..1) over `dragTime`,
// lets go for `restTime`, and repeats. Usage:
//   npx tsx scripts/headless.ts '<config json>' [stride] [dragTime s] [restTime s] [lift] [seconds]
import { LimbleSim, PairLegsGait } from "../shared/src/index";

const cfg = JSON.parse(process.argv[2] ?? "{}");
const stride = Number(process.argv[3] ?? 0.6);
const dragTime = Number(process.argv[4] ?? 0.35);
const restTime = Number(process.argv[5] ?? 0.15);
const lift = Number(process.argv[6] ?? 0.2);
const seconds = Number(process.argv[7] ?? 40);

const sim = new LimbleSim(cfg);
const gait = new PairLegsGait();
let falls = 0, wipes = 0, finishes = 0, prev = "playing", attempt = 1, maxPitch = 0;
const cycle = dragTime + restTime;
for (let i = 0; i <= 60 * seconds; i++) {
  const t = i / 60;
  if (sim.attempt !== attempt) { gait.reset(); attempt = sim.attempt; }
  const c = t % cycle;
  const stick = c < dragTime ? { x: stride * Math.min(1, c / (dragTime * 0.7)), y: lift } : null;
  sim.setInputs(gait.update(stick));
  sim.step();
  const s = sim.snapshot();
  if (s.status === "playing") maxPitch = Math.max(maxPitch, Math.abs(s.parts[2]));
  if (s.status !== prev && s.status === "failed") s.failReason === "fell" ? falls++ : wipes++;
  if (s.status !== prev && s.status === "finished") finishes++;
  prev = s.status;
}
const s = sim.snapshot();
console.log(`stride=${stride} drag=${dragTime} rest=${restTime} ${JSON.stringify(cfg)} -> best=${s.best.toFixed(1)}m attempts=${s.attempt} falls=${falls} allDropped=${wipes} finishes=${finishes} bestItems=${s.bestItems} bestTime=${s.bestTime?.toFixed(1) ?? "-"} maxPitch=${maxPitch.toFixed(2)}`);
