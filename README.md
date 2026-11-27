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

- Left thumb (anywhere on the left half): legs. Rock left/right to walk, push up to lift the foot.
- Right thumb (right half): arms. Up/down raises the tray, left/right tilts it.
- Desktop: `W A S D` for legs, arrow keys for arms.
- Add `?debug=1` to the URL for the tuning panel (⚙). "Copy values" copies your settings.

## Headless sim

`npx tsx scripts/headless.ts walk '{"balanceAssist":300}' 1.2` runs the physics without a browser
and prints how a scripted walker does. Useful for quick tuning sweeps.
