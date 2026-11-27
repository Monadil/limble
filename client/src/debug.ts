import { CONFIG_RANGES, DEFAULT_CONFIG, type Config, type LimbleSim } from "@limble/shared";

const STORAGE_KEY = "limble.config.v2"; // bump when defaults change a lot, so old saved tuning is dropped

export function loadSavedConfig(): Partial<Config> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Live tuning sliders, shown with ?debug=1. Values persist on this device. */
export function mountDebugPanel(sim: LimbleSim) {
  const toggle = document.createElement("button");
  toggle.id = "debug-toggle";
  toggle.textContent = "⚙";
  const panel = document.createElement("div");
  panel.id = "debug";
  panel.className = "hidden";
  toggle.onclick = () => panel.classList.toggle("hidden");
  document.body.append(toggle, panel);

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(sim.config));
  const inputs = new Map<keyof Config, { input: HTMLInputElement; value: HTMLSpanElement }>();

  const render = () => {
    for (const [key, { input, value }] of inputs) {
      input.value = String(sim.config[key]);
      value.textContent = String(sim.config[key]);
    }
  };

  panel.innerHTML = `<p><b>Tuning</b> — changes apply live and are saved on this device.</p>`;
  for (const r of CONFIG_RANGES) {
    const label = document.createElement("label");
    const value = document.createElement("span");
    label.append(r.label, value);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(r.min);
    input.max = String(r.max);
    input.step = String(r.step);
    input.oninput = () => {
      sim.config[r.key] = Number(input.value);
      value.textContent = input.value;
      sim.applyConfig();
      save();
    };
    inputs.set(r.key, { input, value });
    panel.append(label, input);
  }

  const buttons = document.createElement("div");
  buttons.className = "buttons";
  const btn = (text: string, fn: () => void) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = fn;
    buttons.append(b);
    return b;
  };
  btn("Restart", () => sim.restart());
  btn("Defaults", () => {
    Object.assign(sim.config, DEFAULT_CONFIG);
    sim.applyConfig();
    save();
    render();
  });
  const copy = btn("Copy values", async () => {
    const text = JSON.stringify(sim.config, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copied!";
    } catch {
      window.prompt("Copy these values:", JSON.stringify(sim.config));
    }
    setTimeout(() => (copy.textContent = "Copy values"), 1500);
  });
  panel.append(buttons);
  render();
}
