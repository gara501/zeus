import * as L from 'littlejsengine';
import { PALETTE, MIRROR_SCALE } from './config.js';
import { add, scale, mirrorEnds, nearestHit, normalize, reflect } from './ray.js';
import { crystalAngle, cloudReleaseTime } from './elements.js';
import { monsterPose } from './monsters.js';
import { drawFloorSprite, drawWallSprite, drawDoorSprite, drawZeusSprite,
  drawTotemSprite, drawWoodSprite, drawMetalSprite, drawCloudSprite,
  drawBlockSprite, drawWaterSprite, drawMirrorSprite, drawCrystalSprite, drawMonsterSprite } from './sprites.js';

const color = hex => new L.Color().setHex(hex);
const C = Object.fromEntries(Object.entries(PALETTE).map(([name, hex]) => [name, color(hex)]));
const extra = { wall: color('#c4b799'), shade: color('#827862'), floor2: color('#514236'), teal: color('#36534e'), active: color('#a8eac0'), dark: color('#233434') };
const vec = point => L.vec2(point.x, point.y);
const line = (a, b, width, tint) => L.drawLine(vec(a), vec(b), width, tint);
const circle = (point, size, tint) => L.drawCircle(vec(point), size, tint);
const rect = (point, x, y, tint) => L.drawRect(vec(point), L.vec2(x, y), tint);
const offset = (point, x, y) => add(point, { x, y });

export function fitCamera() {
  if (document.querySelector('#interface.touch-mirrors:not([hidden])')) {
    const top = document.querySelector('.lesson-info').getBoundingClientRect().bottom + 12;
    const bottom = document.querySelector('.bottom-panel').getBoundingClientRect().top - 12;
    const scale = Math.max(8, Math.min((L.mainCanvasSize.x - 44) / 16.5, (bottom - top) / 8.5));
    L.setCameraScale(scale);
    L.setCameraPos(L.vec2(0, ((top + bottom) / 2 - L.mainCanvasSize.y / 2) / scale));
    return;
  }
  const short = L.mainCanvasSize.y < 550;
  const padding = short ? 285 : 310;
  L.setCameraScale(Math.max(8, Math.min((L.mainCanvasSize.x - 44) / 16.5, (L.mainCanvasSize.y - padding) / 8.5)));
  L.setCameraPos(L.vec2(0, short ? .6 : .1));
}

function drawZeus(position, aim, time, visual, status) {
  circle(offset(position, 0, -.31), .74, extra.dark);
  drawZeusSprite(position, aim, visual, status);
  const hand = add(position, scale(aim, .42));
  circle(hand, .10 + Math.sin(time * 8) * .015, C.gold);
  L.drawText('ZEUS', vec(offset(position, 0, -.88)), .17, C.muted);
}

function drawTotem(totem, state) {
  const time = state.time;
  const group = state.groups.find(item => item.id === totem.group);
  drawTotemSprite(totem, time);
  const tint = totem.active ? extra.active : C.gold;
  const label = totem.active ? 'ACTIVE' : totem.requiredHits > 1 ? `${totem.hits}/${totem.requiredHits} HITS` : group?.type === 'ordered' ? `TOTEM ${totem.order}` : 'TOTEM';
  L.drawText(label, vec(offset(totem, 0, .92)), .15, tint);
  if (group?.type === 'ordered' && group.members[group.next] === totem.id) {
    L.drawCircle(vec(offset(totem, 0, .2)), 1.1, L.rgb(0, 0, 0, 0), .025, C.gold);
  }
  if (group?.type === 'timed' && group.deadline !== null) {
    L.drawText(`${Math.max(0, group.deadline - time).toFixed(1)} s`, vec(offset(totem, 0, -1)), .18, C.gold);
  }
}

function drawMirror(mirror, hovered, dragging, time, number) {
  drawMirrorSprite(mirror, time);
  const [a, b] = mirrorEnds(mirror);
  if (mirror.rotatable) line(a, b, .04, color('#68dfff'));
  if (hovered || dragging) {
    line(a, b, .025, C.light);
    circle(a, .1, C.gold);
    circle(b, .1, C.gold);
  }
  if (mirror.rotatable) {
    L.drawText(`M${number}`, vec(offset(mirror, -.8 * MIRROR_SCALE, .9 * MIRROR_SCALE)), .22, color('#68dfff'));
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      circle(offset(mirror, Math.cos(angle) * 1.1 * MIRROR_SCALE, Math.sin(angle) * 1.1 * MIRROR_SCALE), .035, hovered || dragging ? C.light : color('#68dfff'));
    }
    if (hovered || dragging) L.drawText(`${Math.round(((mirror.angle * 180 / Math.PI) % 180 + 180) % 180)}°`, vec(offset(mirror, 0, 1.6 * MIRROR_SCALE)), .25, C.gold);
  }
  L.drawText(mirror.rotatable ? 'DRAG TO ROTATE' : 'FIXED BRONZE', vec(offset(mirror, 0, -1.43 * MIRROR_SCALE)), .14, mirror.rotatable ? color('#68dfff') : C.muted);
}

function drawLightning(segment, time) {
  const delta = { x: segment.to.x - segment.from.x, y: segment.to.y - segment.from.y };
  const length = Math.hypot(delta.x, delta.y);
  if (length < .001) return;
  const normal = { x: -delta.y / length, y: delta.x / length };
  const count = Math.max(2, Math.ceil(length / .09));
  const alpha = Math.max(.05, 1 - (time - segment.time) / .24);
  let last = segment.from;
  for (let i = 1; i <= count; i++) {
    const amount = i / count;
    const wobble = i === count ? 0 : Math.sin(i * 7.31 + segment.seed * 17 + segment.time * 19) * .07;
    const point = add(add(segment.from, scale(delta, amount)), scale(normal, wobble));
    line(last, point, .1, L.rgb(1, .72, .22, alpha * .35));
    line(last, point, .035, L.rgb(1, .96, .76, alpha));
    last = point;
  }
}

function drawConductor(cell, state) {
  const charged = cell.chargedUntil > state.time;
  const tint = charged ? C.light : cell.type === 'water' ? color('#74ccd1') : C.bronze;
  if (cell.type === 'water') {
    drawWaterSprite(cell, state.time);
    if (charged) L.drawCircle(vec(cell), .36, L.rgb(0,0,0,0), .035, C.light);
  } else {
    for (const id of cell.neighbors) {
      const other = state.conductors.find(node => node.id === id);
      const end = add(cell, scale({ x: other.x - cell.x, y: other.y - cell.y }, .5));
      line(cell, end, .16, C.bronze);
    }
    drawMetalSprite(cell, state);
    if (charged) circle(cell, .13, C.light);
  }
  for (const direction of cell.ports) {
    const start = add(cell, scale(direction, .32));
    const end = add(cell, scale(direction, .57));
    line(start, end, .035, tint);
    const side = { x: -direction.y, y: direction.x };
    line(end, add(add(end, scale(direction, -.1)), scale(side, .065)), .03, tint);
    line(end, add(add(end, scale(direction, -.1)), scale(side, -.065)), .03, tint);
  }
}

function drawBreakable(item, time) {
  if (item.type === 'wood') {
    drawWoodSprite(item, time);
    if (item.destroyed) {
      if (item.burnUntil > time) {
        circle(item, .15 + Math.sin(time * 18) * .03, C.gold);
        L.drawText('PATH OPEN', vec(offset(item, 0, .72)), .14, C.gold);
      }
      return;
    }
    L.drawText('CRATE · 1 BOLT', vec(offset(item, 0, .77)), .14, C.gold);
  } else if (item.destroyed) {
    drawBlockSprite(item);
  } else {
    drawBlockSprite(item);
    L.drawText(`${item.hits}/${item.requiredHits} · BREAK`, vec(offset(item, 0, .77)), .15, C.gold);
  }
}

function arrow(position, direction, tint, length = .9) {
  const start = add(position, scale(direction, .48));
  const end = add(position, scale(direction, length));
  const side = { x: -direction.y, y: direction.x };
  line(start, end, .035, tint);
  line(end, add(add(end, scale(direction, -.15)), scale(side, .08)), .035, tint);
  line(end, add(add(end, scale(direction, -.15)), scale(side, -.08)), .035, tint);
}

function drawCrystal(crystal, state) {
  const angle = crystalAngle(crystal, state.time);
  drawCrystalSprite(crystal, angle);
  const incoming = normalize(crystal.incoming ?? { x: crystal.x - state.zeus.x, y: crystal.y - state.zeus.y });
  arrow(crystal, incoming, color('#93e4eb'));
  arrow(crystal, reflect(incoming, { x: -Math.sin(angle), y: Math.cos(angle) }), C.gold);
  L.drawText('CRYSTAL', vec(offset(crystal, 0, -1.1)), .15, color('#93e4eb'));
}

function drawCloud(cloud, state) {
  const charged = cloud.storedRayId !== null;
  const trap = cloud.type === 'trapCloud';
  drawCloudSprite(cloud, state.time);
  if (trap) {
    line(offset(cloud, -.15, -.1), offset(cloud, .15, .2), .06, C.grout);
    line(offset(cloud, -.15, .2), offset(cloud, .15, -.1), .06, C.grout);
  } else {
    circle(cloud, charged ? .22 + Math.sin(state.time * 12) * .03 : .12, charged ? C.gold : extra.dark);
    const direction = cloud.direction ?? normalize({ x: cloud.x - state.zeus.x, y: cloud.y - state.zeus.y });
    arrow(cloud, direction, C.gold);
  }
  const remaining = (charged ? cloud.releaseAt : cloudReleaseTime(cloud, state.time)) - state.time;
  const label = trap ? 'ABSORBS' : charged ? `${Math.max(0, remaining).toFixed(1)} s` : cloud.period ? `CYCLE · ${remaining.toFixed(1)} s` : 'STORES';
  L.drawText(label, vec(offset(cloud, 0, -1.02)), .16, charged ? C.gold : C.muted);
  if (cloud.period) {
    const fraction = Math.max(0, Math.min(1, remaining / cloud.period));
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      circle(offset(cloud, Math.cos(angle) * .73, Math.sin(angle) * .73), .04, i / count < fraction ? C.gold : extra.dark);
    }
  }
}

export function drawGame(state, aim, hovered, dragging, particles, mode, visual) {
  fitCamera();
  rect({ x: 0, y: -.14 }, 15.5, 8.55, extra.dark);
  rect({ x: 0, y: 0 }, 15.3, 8.3, C.bronze);
  rect({ x: 0, y: 0 }, 15.12, 8.12, C.grout);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 15; col++) {
    const point = { x: col - 7, y: row - 3.5 };
    drawFloorSprite(point, (row * 7 + col * 3) % 11 < 2 ? 2 : (row + col) % 2);
  }
  for (const cell of state.conductors) drawConductor(cell, state);
  for (const wall of state.walls) {
    drawWallSprite(wall);
  }
  for (const item of state.breakables) drawBreakable(item, state.time);
  for (const crystal of state.crystals) drawCrystal(crystal, state);
  for (const cloud of state.clouds) drawCloud(cloud, state);
  const door = state.door;
  drawDoorSprite(door, state.status === 'won');
  let mirrorNumber = 0;
  for (const mirror of state.mirrors) drawMirror(mirror, mirror.id === hovered, mirror.id === dragging, state.time, mirror.rotatable ? ++mirrorNumber : null);
  for (const totem of state.totems) drawTotem(totem, state);
  for (const monster of state.monsters ?? []) {
    if (!monster.destroyed) {
      const pose = monsterPose(monster, state.time);
      line({ x: monster.from, y: monster.y - .5 }, { x: monster.to, y: monster.y - .5 }, .025, C.muted);
      circle(offset(pose, -pose.facing * .65, 0), .12, C.gold);
    }
    drawMonsterSprite(monster, state.time, visual.time);
  }
  if (mode === 'playing' && !dragging) {
    const hit = nearestHit(state, state.zeus, aim);
    const distance = hit?.distance ?? 20;
    for (let d = .6; d < distance; d += .3) {
      const from = add(state.zeus, scale(aim, d));
      const to = add(state.zeus, scale(aim, Math.min(d + .1, distance)));
      line(from, to, .019, C.muted);
    }
    if (hit) L.drawCircle(vec(add(state.zeus, scale(aim, hit.distance))), .18, L.rgb(0, 0, 0, 0), .02, C.gold);
  }
  drawZeus(state.zeus, aim, state.time, visual, state.status);
  for (const segment of state.trails) drawLightning(segment, state.time);
  for (const ray of state.rays) circle(ray.position, .13, C.light);
  for (const delayed of state.delayed) circle(delayed.ray.position, .14 + Math.sin(state.time * 20) * .03, C.gold);
  for (const pulse of state.pulses) {
    if (pulse.start > state.time) continue;
    const cell = state.conductors.find(node => node.id === pulse.nodeId);
    const fraction = Math.min(1, (state.time - pulse.start) / Math.max(.001, pulse.time - pulse.start));
    circle(add(pulse.from, scale({ x: cell.x - pulse.from.x, y: cell.y - pulse.from.y }, fraction)), .16, C.light);
  }
  for (const particle of particles) circle(particle.position, particle.life * .12,
    particle.type === 'totem' ? extra.active : particle.type === 'burn' ? color('#ec8752') : particle.type === 'break' ? C.marble : C.gold);
}
