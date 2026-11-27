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

- Left thumb (anywhere on the left half): legs. Drag forward to swing the outlined foot, let go
  to plant it. The feet take turns. Drag further for longer strides, up for higher steps.
- Right thumb (right half): arms. Up/down raises the tray, left/right tilts it.
- Desktop: hold and release `D` to step (add `W` to lift higher), arrow keys for arms.
- Add `?debug=1` to the URL for the tuning panel (⚙). "Copy values" copies your settings.

## Headless sim

`npx tsx scripts/headless.ts '{}' 0.7 0.4 0.15` runs the physics without a browser with a
scripted player (stride, drag time, rest time) and prints how far it got. Useful for tuning sweeps.

## Share it (GitHub Pages)

Every push to `main` builds the game and publishes it with `.github/workflows/pages.yml`.
One-time setup: on GitHub, open the repo → **Settings → Pages** → set **Source** to
**GitHub Actions**. The game is then at `https://<user>.github.io/limble/` (add `?debug=1` for
the tuning panel). Pages on a free account needs the repo to be public.
