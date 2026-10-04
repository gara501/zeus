# Zeus's Path · The Path of Thunder

Built with LittleJS 1.24.0 and Vite 8.3.2. Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

The campaign has **25 sequential levels**, entirely in English. Levels 1–16 teach the mechanics; levels 17–25 combine mirror chains, clearing paths, cyclic clouds, crystals, synchronized branches, rotation during a charge, ordered targets and timed windows. The final level combines a crate, a block, three mirrors, metal, a cloud, a crystal and two timed totems.

## Controls and progression

Aim with the mouse; click or press Space to fire. Drag a blue mirror to rotate it freely. R/Z restarts the level; Esc pauses. Fixed mirrors are bronze. Mirrors use a compact scale shared by rendering, collision geometry and rotation controls.

On mobile and narrow screens, use the bottom **M1, M2, …** sliders to rotate the matching blue mirrors. Each slider shows its angle and supports half-degree adjustments from 0° to 180°. Tap the board to aim and fire, including directly at a mirror. Sliders remain usable during a lightning shot or cloud charge, and restart restores their initial angles.

Each level provides 3–5 bolts. Only one shot may be active, including its branches, conduction and stored cloud charges. A blocked firing attempt consumes no ammunition and is never queued. Mirrors can be rotated while lightning travels or a cloud charges.

The header shows only the current level. After the first victory, **Levels** appears on the title screen: a grid with earned stars, completed levels available to replay, the next unlocked level and locked future levels. **Continue** resumes the first unfinished lesson. **Home** returns to the title during play, pause or defeat. Progress and audio preferences are saved locally.

The title buttons share the same dimensions, font and font size.

**Options** in the top bar opens a modal and pauses the game. Home, Restart, Effects and Music are grouped there to keep the footer clear for guidance and mobile mirror sliders. Continue or Esc closes the modal and resumes play. Keyboard focus stays inside the modal while it is open.

## Mechanics

- **Wooden crate:** consumes one bolt, burns and permanently opens the path. Burning is a visual effect; it neither stores nor returns the branch. Another shot becomes available after the impact.
- **Fragile block:** requires two impacts to break, consuming both branches. The next bolt passes through the breach. Configure resistance with `breakables[].hits`; accumulated damage is visible.
- **Storage cloud:** stores a branch and releases it in its configured direction after `delay`. It can be charged again.
- **Cyclic cloud:** uses `clouds[].period` and `phase` on the level clock. It releases at the next cycle boundary, even just after receiving a charge. An impact exactly at the boundary is accepted. Empty clouds display their clock without generating lightning. A full cloud absorbs additional impacts without replacing its stored charge. A ring and countdown identify this variant.
- **Trap cloud:** absorbs the incoming branch.
- **Mirrors:** continuous reflections support multiple bounces and rotation during a wait. The angle is evaluated at impact. Blue mirrors can rotate; bronze mirrors are fixed.
- **Crystal:** creates a straight branch and a reflected branch. Its angle is `phase + π * time / period`, evaluated at impact. `incoming` only configures the visual arrows when the expected input arrives from another object.
- **Water:** conducts at 8 units/s through connected cells and releases through open edges.
- **Metal:** conducts at 14 units/s through connected networks and releases through terminals configured with `metalPorts`. Every junction follows all branches. Each cell is visited once per pulse; recirculation within its lineage is absorbed.
- **Totems:** persistent, multiple-hit, ordered or timed targets. Each actual arrival counts. A wrong-order hit resets its group. The first impact opens a timed window; expiration clears all charge in that group. The exact deadline is valid. Completed groups remain active.

Pause freezes clocks, lightning, phases, cycles and timed windows. Restart restores the entire level. Defeat waits for all bolts, conduction and pending charges to finish. A shot has a 128-branch limit, a bolt lifetime limit and an interaction budget.

## Music

`src/music/1.mp3` loops during levels 1–16; `src/music/2.mp3` loops from level 17 onward. Maximum music volume is 4%, temporarily reduced to 0.8% during sound effects, with a gradual return. Music pauses in menus, story scenes, pause and hidden tabs.

**Music: on/off** is independent of **Effects: on/off**. Both preferences are saved. Music can also be configured on the title screen before playing.

## Third-party attribution

- **UI:** [Tiny RPG – Mana Soul GUI](https://tiopalada.itch.io/tiny-rpg-mana-soul-gui), by Gabriel “tiopalada” Lima, CC0 1.0. Frames, buttons and portrait; colors adapted with CSS filters. License included in `public/licenses/Mana-Soul-CC0.html`.
- **1.mp3 (levels 1–16):** Music by <a href="https://pixabay.com/es/users/openmindaudio-53602733/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=606177">OpenMindAudio</a> from <a href="https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=606177">Pixabay</a>
- **2.mp3 (levels 17–25):** Music by <a href="https://pixabay.com/es/users/tunetank-50201703/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=347627">Tunetank</a> from <a href="https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=347627">Pixabay</a>
- **Fonts:** Cinzel by Natanael Gama and Pixelify Sans by Stefie Justprince, both under SIL Open Font License 1.1. Licenses are included in `public/licenses/`.
- **Engine and tools:** LittleJS and Vite, MIT. See [CREDITS.md](CREDITS.md) for complete credits and links.

## Presentation and story

Mana Soul GUI frames and buttons are adapted to bronze with CSS filters, parchment panels and a Zeus portrait. Cinzel is used for headings; Pixelify Sans for HUD, buttons and labels. Ammunition is shown as charges that dim when spent. The outer background is a vector cave with columns and soft blue light. Fonts, sheets and licenses are bundled locally.

The title uses `src/sprites/transitions/title.png`, with visible loading progress and retry on failure. Starting from level 1 shows `intro.png`: Amalthea introduces the goal of lighting the totems and preparing Zeus for his future. Scenes 1, 2 and 3 follow levels 5, 10 and 15. After level 16, `ready.png` announces the real training before level 17. Image 4 closes level 25 with Zeus facing the Titan.

Narration is defined in `src/cinematics.js`. Amalthea appears beside a compact subtitle panel with at most two lines. Each fragment disappears after a reading interval and the next appears automatically, preserving the complete narration. Click to reveal the current fragment or advance early; the final action continues into the game. With reduced motion, each fragment is revealed immediately. Scenes freeze gameplay. The ending returns to the title without clearing stars. Continuing an advanced campaign does not replay the introduction.

Original tileset, Zeus, totem, wood, metal, cloud, water and mirror sheets remain intact. Crops and animations are defined in `src/sprites.js`. Order/hit indicators, arrows and timing remain visible. Zeus animations preserve their pivots and pause correctly. Broken blocks use rubble from the tileset.

## Verification

`npm test` runs **56 tests** for geometry, simulation, cycles, campaign and subtitle pagination. All 25 solutions are checked at 30, 60 and 120 Hz with sequential shots and real ammunition. Coverage includes timing failures, rotation during a charge, aiming and mirror tolerances, firing windows, block damage, crate consumption, releases, timed windows, cycles, restart and recirculation protection.

Browser checks require an external Playwright installation and Chrome/Edge:

```sh
node scripts/browser-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/cinematics-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/ui-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/progression-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/music-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/sprites-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
node scripts/mobile-check.cjs /path/to/playwright /path/to/browser http://127.0.0.1:5173/
```

Create `artifacts/` before running these checks. The first plays all 25 levels with real controls and verifies progression, stars, pause, order/timing errors, cyclic clouds, mirror chains, rotation during a charge and the ending. The others check loading/retry, scenes, fonts, equal title buttons, narrow/short layouts, sprites, music playback, saved preferences and decoded audio levels. They also work against `npm run preview`. Reference solutions in `scripts/level-solutions.js` are not imported by the shipped game.

The mobile check uses native touch input to drag sliders and solve a mirror level, verifies assignments and restart behavior with multiple mirrors, and checks portrait/landscape layouts plus automatic two-line subtitle transitions.

## Web and Windows delivery

### Netlify testing deployments

Import the `gara501/zeus` GitHub repository into Netlify. The included `netlify.toml` configures Node.js 22, `npm run build` and the `dist` publish directory. Once the repository is connected, pushes to the selected production branch rebuild the testing site. The game is static and requires no environment secrets or backend services. See the [Netlify Vite guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

### itch.io release

Build the game and generate an upload-ready ZIP with:

```sh
npm run build:itch
```

The command writes `release/zeus-path-itch.zip`, containing `index.html` at the ZIP root, bundled assets, credits and licenses. It requires only the existing Node dependencies; no separate ZIP utility is needed. Running it again rebuilds the game and replaces the ZIP.

On itch.io, choose **HTML Game**, upload `release/zeus-path-itch.zip`, and mark the upload as playable in the browser. Use a 1280 × 800 embedded viewport or fullscreen launch, then preview the game. All asset paths are relative so the game can run from the itch.io subdirectory. See the [official HTML5 upload guide](https://itch.io/docs/creators/html5).

On this machine, the npm launcher points to a missing installation. Use the CLI bundled with Node without changing the global installation:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run dev
```

To generate the itch.io ZIP on this Windows machine:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build:itch
```

The same CLI also supports `install`, `test`, `run build` and `run preview`.
