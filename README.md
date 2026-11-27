# Limble

Co-op physics party game: each player controls a limb of one body carrying a wobbling stack.
See [PLAN.md](PLAN.md) for the design.

## Run it

```bash
npm install
npm run dev
```

Vite prints a **Network** address (e.g. `http://192.168.x.x:5173`). Open it on a phone on the
same Wi-Fi and turn the phone sideways.

- Left thumb (anywhere on the left half): legs. Each swipe right/left takes a step with the
  left/right leg; alternate to walk. Swipe up-and-across for a higher step.
- Right thumb (right half): arms. Up/down raises the tray, left/right tilts it.
- Desktop: `W A S D` for legs, arrow keys for arms.
- Add `?debug=1` to the URL for the tuning panel (⚙). "Copy values" copies your settings.

## Headless sim

`npx tsx scripts/headless.ts '{"balanceAssist":800}' 0.5` runs the physics without a browser with a
scripted player swiping left/right, and prints how far it got. Useful for quick tuning sweeps.
