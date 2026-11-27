// Run the physics without a browser to compare settings quickly.
// A scripted player alternates full right/left swipes on the legs stick every `half` seconds.
// Usage: npx tsx scripts/headless.ts '<config json>' [half-period s] [seconds]
import { LimbleSim, PairLegsGait } from "../shared/src/index";

const cfg = JSON.parse(process.argv[2] ?? "{}");
const half = Number(process.argv[3] ?? 0.5);
const seconds = Number(process.argv[4] ?? 30);
const sim = new LimbleSim(cfg);
const gait = new PairLegsGait();

let falls = 0, wipes = 0, finishes = 0, prev = "playing", attempt = 1;
for (let i = 0; i <= 60 * seconds; i++) {
  const t = i / 60;
  if (sim.attempt !== attempt) { gait.reset(); attempt = sim.attempt; }
  sim.setInputs(gait.update({ x: Math.floor(t / half) % 2 === 0 ? 1 : -1, y: 0 }, 1 / 60));
  sim.step();
  const s = sim.snapshot();
  if (s.status !== prev && s.status === "failed") s.failReason === "fell" ? falls++ : wipes++;
  if (s.status !== prev && s.status === "finished") finishes++;
  prev = s.status;
}
const s = sim.snapshot();
console.log(`half=${half} ${JSON.stringify(cfg)} -> best=${s.best.toFixed(1)}m attempts=${s.attempt} falls=${falls} allDropped=${wipes} finishes=${finishes} bestItems=${s.bestItems} bestTime=${s.bestTime?.toFixed(1) ?? "-"}`);
