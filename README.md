# Dondurma

A night street in Istanbul. A Turkish ice cream vendor, Mehmet Usta, trolls you with the cone. Every cone you catch is one of my project stories. In a hurry? "Skip to the work" opens the plain version.

Built with React, three.js and React Three Fiber. Works on phones.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve dist/ on http://localhost:4173
```

Node 18 or newer. Force a quality tier with `?tier=high|mid|low` in the URL.

## Where things live

```
src/
  scene/    Street, Stall (cart), VendorModel (rig, IK, painted face), Outfit, Cone, Hand, Cat, CameraRig, Director, Effects
  game/     troll.ts (state machine + dodges), rules.ts, springs.ts, world.ts (per-frame shared state), say.ts
  audio/    audioManager.ts (Web Audio: ambience, saz, SFX, recorded voice lines)
  ui/       Loader, HUD, MenuBoard, StoryCard, FinalScoop, SkipView, Subtitles
  content/  projects.ts (every story, stat and vendor line)
scripts/    build-mannequin.mjs (trims the animation library), build-voice.py (Piper TTS voice lines)
```

All copy is in [`src/content/projects.ts`](src/content/projects.ts). The cone game's fairness knobs (misses before he gives up, time limit, catch radius, lucky-catch chance) are in [`src/game/rules.ts`](src/game/rules.ts).

## Credits

- Mehmet Usta is Quaternius' Universal Animation Library mannequin, dressed up in code; Pamuk is Quaternius' animated cat (both CC0).
- Textures and the night-sky HDRI are from Poly Haven (CC0).
- Mehmet's voice is the Piper TTS "northern_english_male" voice (CC BY-SA 4.0), generated with `python scripts/build-voice.py`.
- Fonts: Fraunces, Inter, IBM Plex Mono and Pacifico (SIL Open Font License).
