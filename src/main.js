import * as L from 'littlejsengine';
import { MIRROR_SCALE } from './config.js';
import { levels } from './levels.js';
import { createState, stepSimulation } from './simulation.js';
import { normalize, add, scale } from './ray.js';
import { drawGame, fitCamera } from './render.js';
import { playEvents } from './audio.js';
import { createMusic } from './music.js';
import { readSave, writeSave, isLevelUnlocked, nextLevelIndex } from './save.js';
import { createUI } from './ui.js';
import './style.css';
import './theme.css';
import { spriteUrls } from './sprites.js';
import { uiAssetUrls, prepareUIAssets } from './ui-assets.js';
import { createCinematics, cinematicAssets, preloadImages, chapterAfter, intro } from './cinematics.js';

let index = 0;
let state = createState(levels[index]);
let mode = 'loading';
let screen = 'loading';
let fadeDestination = 'playing';
let fadeAction = finishFade;
let storyContinuation = advance;
let phaseTime = 0;
let stars = 0;
let fade = 0;
let aim = { x: 1, y: 0 };
let dragging = null;
const mirrorCommands = new Map();
let hovered = null;
let particles = [];
let visual = { time: 0, shotAt: -Infinity, victoryAt: 0, lostAt: 0 };
const save = readSave();
const music = createMusic();
const touchMirrorControls = matchMedia('(max-width: 700px), (pointer: coarse)');
function toggleMusic() { save.musicMuted = !save.musicMuted; writeSave(save); }
let pointerOnCanvas = false;
let pointerScreen = { x: 0, y: 0 };
document.addEventListener('mousemove', event => { pointerScreen = { x: event.clientX, y: event.clientY }; });
document.addEventListener('mousedown', event => { pointerScreen = { x: event.clientX, y: event.clientY }; });
document.addEventListener('pointerdown', event => { pointerScreen = { x: event.clientX, y: event.clientY }; });
document.addEventListener('pointermove', event => {
  pointerScreen = { x: event.clientX, y: event.clientY };
  // Aiming at the board returns Space to firing after keyboard focus was restored.
  if (event.target instanceof HTMLCanvasElement && document.activeElement?.id === 'pause') document.activeElement.blur();
});

function load(indexToLoad) {
  mirrorCommands.clear();
  screen = null;
  index = indexToLoad;
  state = createState(levels[index]);
  dragging = hovered = null;
  aim = { x: 1, y: 0 };
  particles = [];
  visual = { time: 0, shotAt: -Infinity, victoryAt: 0, lostAt: 0 };
  stars = 0;
  mode = 'playing';
  phaseTime = fade = 0;
}
function restart() {
  if (!['playing', 'paused', 'lost'].includes(mode)) return;
  load(index);
}
function togglePause() {
  if (mode === 'playing') { mode = 'paused'; dragging = null; mirrorCommands.clear(); }
  else if (mode === 'paused') mode = 'playing';
}
function finishFade() {
  const chapter = chapterAfter(index + 1, levels.length);
  if (chapter) {
    const ending = index === levels.length - 1;
    showStory(chapter, ending ? () => { screen = 'title'; fadeInto('title'); } : advance, ending);
  } else advance();
}
function showStory(chapter, continuation, ending = false) {
  storyContinuation = continuation;
  screen = 'story';
  cinematics.setChapter(chapter, ending);
  fadeInto('story');
}
function fadeInto(destination) {
  mode = 'fadeIn'; fadeDestination = destination; phaseTime = 0; fade = 1;
}
function fadeTo(action) {
  mode = 'fadeOut'; phaseTime = 0; fadeAction = action;
}
function advance() {
  load(index + 1);
  fadeInto('playing');
}
function dialogAction() {
  if (mode === 'paused') togglePause();
  else if (mode === 'lost') restart();
}
const cinematics = createCinematics({
  music: toggleMusic,
  start: () => {
    if (mode !== 'title') return;
    const selected = nextLevelIndex(levels, save);
    const begin = () => { load(selected); fadeInto('playing'); };
    fadeTo(() => { if (selected === 0) showStory(intro, begin); else begin(); });
  },
  levels: () => { if (mode === 'title') { screen = mode = 'levels'; } },
  back: () => { if (mode === 'levels') { screen = mode = 'title'; } },
  selectLevel: selected => {
    if (mode === 'levels' && isLevelUnlocked(levels, save, selected)) {
      fadeTo(() => { load(selected); fadeInto('playing'); });
    }
  },
  next: () => {
    if (mode !== 'story' || cinematics.reveal()) return;
    fadeTo(storyContinuation);
  },
  retry: () => boot(),
}, levels);
const ui = createUI({
  rotate: (id, degrees) => {
    if (mode === 'playing' && Number.isFinite(degrees) && state.mirrors.some(mirror => mirror.id === id && mirror.rotatable)) {
      mirrorCommands.set(id, degrees * Math.PI / 180);
    }
  },
  music: toggleMusic,
  restart, pause: togglePause, dialog: dialogAction,
  home: () => {
    if (!['playing', 'paused', 'lost'].includes(mode)) return;
    dragging = hovered = null;
    fadeTo(() => { screen = 'title'; fadeInto('title'); });
  },
  sound: () => { save.muted = !save.muted; writeSave(save); },
}, levels);

function burst(events) {
  for (const event of events) {
    if (!event.position || event.type === 'fire') continue;
    const count = event.type === 'victory' ? 32 : event.type === 'conduct' ? 3 : event.type === 'wall' ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({ position: { ...event.position }, velocity: { x: Math.cos(angle) * (1 + Math.random() * 2), y: Math.sin(angle) * (1 + Math.random() * 2) }, life: .5 + Math.random() * .35, type: event.type });
    }
  }
}

function gameInit() {
  L.setCanvasClearColor(new L.Color(0, 0, 0, 0));
  L.setFontDefault('Pixelify Sans');
  L.setDebugWatermark(false);
  L.setDebugKey('Backquote');
  L.setEngineVariableStep(false);
  fitCamera();
}

function gameUpdate() {
  const dt = L.timeDelta;
  pointerOnCanvas = document.elementFromPoint(pointerScreen.x, pointerScreen.y) instanceof HTMLCanvasElement;
  if (L.keyWasPressed('Escape')) togglePause();
  if (L.keyWasPressed('KeyR') || L.keyWasPressed('KeyZ')) restart();
  if (['playing', 'victory', 'fadeOut', 'lost'].includes(mode)) visual.time += dt;
  if (mode === 'playing') {
    const commands = [...mirrorCommands].map(([id, angle]) => ({ type: 'rotate', id, angle }));
    mirrorCommands.clear();
    const mouse = { x: L.mousePos.x, y: L.mousePos.y };
    hovered = pointerOnCanvas ? state.mirrors.find(mirror => mirror.rotatable && Math.hypot(mouse.x - mirror.x, mouse.y - mirror.y) < 1.32 * MIRROR_SCALE)?.id ?? null : null;
    const mousePressed = pointerOnCanvas && L.mouseWasPressed(0);
    if (mousePressed && hovered && !touchMirrorControls.matches) dragging = hovered;
    if (dragging && !L.mouseIsDown(0)) dragging = null;
    if (dragging) {
      const mirror = state.mirrors.find(m => m.id === dragging);
      if (Math.hypot(mouse.x - mirror.x, mouse.y - mirror.y) > .08) {
        commands.push({ type: 'rotate', id: mirror.id, angle: Math.atan2(mouse.y - mirror.y, mouse.x - mirror.x) });
      }
    } else {
      if (pointerOnCanvas && Math.hypot(mouse.x - state.zeus.x, mouse.y - state.zeus.y) > .1) {
        aim = normalize({ x: mouse.x - state.zeus.x, y: mouse.y - state.zeus.y });
      }
      if ((mousePressed && (!hovered || touchMirrorControls.matches)) || L.keyWasPressed('Space')) commands.push({ type: 'fire', direction: aim });
    }
    const result = stepSimulation(state, commands, dt);
    state = result.state;
    if (result.events.some(event => event.type === 'fire')) visual.shotAt = visual.time;
    playEvents(result.events, save.muted);
    music.duck(result.events, save.muted);
    burst(result.events);
    if (state.status === 'won') {
      mode = 'victory';
      visual.victoryAt = visual.time;
      dragging = null;
      stars = 1 + Number(state.shots <= levels[index].idealShots) + Number(state.shots <= levels[index].idealShots && state.time <= levels[index].threeStarTime);
      save.stars[levels[index].id] = Math.max(stars, save.stars[levels[index].id] || 0);
      writeSave(save);
      phaseTime = 0;
    } else if (state.status === 'lost') { mode = 'lost'; visual.lostAt = visual.time; }
  } else if (mode === 'victory') {
    phaseTime += dt;
    if (phaseTime >= 1.8) fadeTo(finishFade);
  } else if (mode === 'fadeOut') {
    phaseTime += dt;
    fade = Math.min(1, phaseTime / .5);
    if (fade === 1) fadeAction();
  } else if (mode === 'fadeIn') {
    phaseTime += dt;
    fade = Math.max(0, 1 - phaseTime / .5);
    if (fade === 0) mode = fadeDestination;
  }
  if (mode !== 'paused') {
    particles = particles.filter(p => p.life > 0);
    for (const particle of particles) {
      particle.life -= dt;
      particle.position = add(particle.position, scale(particle.velocity, dt));
      particle.velocity.y -= dt * 3;
    }
  }
  document.querySelector('#game').style.cursor = dragging ? 'grabbing' : hovered ? 'grab' : 'crosshair';
  ui.update({ level: levels[index], index, state, mode, stars, save, fade, dragging });
  document.querySelector('#interface').hidden = screen !== null;
  cinematics.update(mode, screen, fade, dt, save);
  music.update(index, mode, screen, save.musicMuted, dt);
}

// Losing window focus cannot silently consume the player's time or rays.
addEventListener('blur', () => { if (mode === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') togglePause(); });

let booting = false;
async function boot() {
  if (booting) return;
  booting = true;
  document.querySelector('#interface').hidden = true;
  cinematics.update('loading', 'loading', 0, 0);
  const assets = [...spriteUrls, ...cinematicAssets, ...uiAssetUrls];
  cinematics.loading(0, assets.length);
  try {
    await preloadImages(assets, (done, total) => cinematics.loading(done, total));
    await prepareUIAssets();
    await L.engineInit(gameInit, gameUpdate, fitCamera, () => drawGame(state, aim, hovered, dragging, particles, mode, visual), () => {}, spriteUrls, document.querySelector('#game'));
    screen = 'title';
    fadeInto('title');
  } catch {
    cinematics.loading(0, assets.length, true);
  } finally { booting = false; }
}
boot();
