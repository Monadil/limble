import { LimbleSim, legsFromPairStick, armsFromPairStick } from "../shared/src/index";
const mode = process.argv[2] ?? "stand";
const cfg = JSON.parse(process.argv[3] ?? "{}");
const period = Number(process.argv[4] ?? 1.2);
const sim = new LimbleSim(cfg);
let line = "";
for (let i = 0; i <= 60 * 15; i++) {
  const t = i / 60;
  if (mode === "walk") {
    const ph = Math.sin((t * 2 * Math.PI) / period);
    sim.setInputs({ ...legsFromPairStick({ x: ph, y: 0.7 }) });
  }
  sim.step();
  if (i % 60 === 0) { const s = sim.snapshot(); line += ` ${s.attempt}:${s.status[0]}${s.parts[0].toFixed(1)}/${s.parts[2].toFixed(2)}`; }
}
const s = sim.snapshot();
console.log(`${mode} ${JSON.stringify(cfg)} p=${period} -> attempts=${s.attempt} best=${s.best.toFixed(2)}\n  ${line}`);
