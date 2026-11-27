# Limble — MVP Plan

A 2D physics party game. A human body must carry a wobbling stack of items along a short course.
Each player controls a limb, so the group has to coordinate. Clumsy, chaotic failure is the comedy:
the game should be fun to share and stream.

**MVP goal:** prove that 1–4 people coordinating limbs to carry the stack a short distance is fun.
Everything else waits until that works.

## Players and controls

- Mobile web, landscape. Floating virtual joysticks appear wherever your thumb lands.
- Joints follow the foot/hand target automatically (two-bone IK driving physics joint motors),
  so the body still moves physically and clumsily.
- Limb splits by player count:

| Players | Who controls what |
|---|---|
| 1 | Left thumb: both legs. Right thumb: both arms. |
| 2 | One player on the legs stick, one on the arms stick |
| 3 | One player per leg, one player on both arms |
| 4 | One limb each |

- **Legs stick (pair):** drag right → front leg swings forward (drag up to lift it) while the other
  leg pushes back; drag left → the other leg steps. Rocking left/right = walking.
- **Arms stick (pair):** up/down raises or lowers the tray; left/right tilts it.
- **Single limb stick:** moves that one foot or hand around its resting position.
- Everyone sees the full scene; the camera follows the body. Your limb is highlighted in your colour.
- If someone disconnects, their limb goes limp and the run continues.

## Gameplay

- Legs walk the body; arms hold a tray with a stack of 4 loose boxes.
- The torso has a gentle self-righting force: stable when standing, but a bad step knocks it over.
- Course: flat start → small ramp up → step down → finish flag. A good run is ~20–30 seconds.
- Fail if any item touches the floor or the body falls. Everything goes ragdoll for ~2 seconds,
  then the run restarts automatically. HUD shows attempt count and best distance.

## Multiplayer (step 2+)

- Room creator gets a 4-letter code / link. Players join a lobby with a body diagram, tap a limb to
  claim it, and the creator presses start. Splits above are applied automatically.
- Server-authoritative: the server runs physics at 60 Hz; phones send joystick input and receive
  snapshots ~20 Hz, interpolating between them. Everyone has the same lag.

## Tech

- TypeScript throughout. planck.js (Box2D port) for physics.
- Server: Node + `ws`, in-memory map of room codes.
- Client: Vite + TypeScript, plain HTML canvas, no engine.
- Repo: `client/`, `server/`, `shared/`. The simulation lives in `shared/` so it runs in both the
  browser (offline solo) and on the server.
- Art: flat rounded shapes, one colour per limb, simple background.
- Tuning: open with `?debug=1` for live sliders (self-righting strength, limb strength, gravity,
  friction…). "Copy values" puts the settings on the clipboard to make them the new defaults.

## Build order (playtest after each step, starting solo)

1. **Solo, offline in the browser:** body, joysticks, stack, course, debug panel.
2. **Server runs the physics,** players join by room code.
3. **Lobby** with limb claiming and automatic splits.
4. **Game loop polish:** fail → ragdoll → restart, attempts and best distance.

## Playtesting

1. Same Wi-Fi: the Mac runs the dev server; phones open the Mac's network address.
2. Later: a free temporary tunnel (e.g. Cloudflare quick tunnel) for remote friends.
   Server region to be decided at that point.

## Out of scope for the MVP

Accounts, matchmaking, replays/clips, spectator/streamer view, multiple levels, customisation,
sound polish, reconnecting after a drop.
