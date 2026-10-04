import * as L from 'littlejsengine';
import { MIRROR_SCALE } from './config.js';
import { monsterPose } from './monsters.js';

// Keep the supplied sheets intact. Rectangles are measured in source pixels.
export const spriteUrls = [
  new URL('./sprites/tileset.png', import.meta.url).href,
  new URL('./sprites/zeus.png', import.meta.url).href,
  new URL('./sprites/totem.png', import.meta.url).href,
  new URL('./sprites/madera.png', import.meta.url).href,
  new URL('./sprites/metal.png', import.meta.url).href,
  new URL('./sprites/nubes.png', import.meta.url).href,
  new URL('./sprites/water.png', import.meta.url).href,
  new URL('./sprites/mirror.png', import.meta.url).href,
  new URL('./sprites/monster.png', import.meta.url).href,
];
const tiles = new Map();
function region(texture, x, y, width, height) {
  const key = [texture, x, y, width, height].join(':');
  if (!tiles.has(key)) tiles.set(key, new L.TileInfo(L.vec2(x, y), L.vec2(width, height), L.textureInfos[texture], 0, .5));
  return tiles.get(key);
}
function drawRegion(rectangle, position, width, height, tint = L.WHITE, mirror = false, angle = 0) {
  L.drawTile(L.vec2(position.x, position.y), L.vec2(width, height), region(...rectangle), tint, angle, mirror);
}

export function drawBlockSprite(item) {
  // Cracked masonry becomes the rubble floor tile after the impact.
  drawRegion([0, item.destroyed ? 317 : 160, 3, 150, 150], item, .98, .98,
    !item.destroyed && item.hits > 0 ? L.rgb(.78, .75, .68) : L.WHITE);
}

export function drawWaterSprite(cell, time) {
  const frame = Math.floor(time * 5) % 6;
  // The last row has no baked arrows. Actual network ports are drawn by the
  // renderer, so walls and adjacent water never show a misleading exit.
  drawRegion([6, frame * 256 + 1, 769, 254, 254], cell, 1.005, 1.005,
    cell.chargedUntil > time ? L.rgb(1, 1, 1) : L.rgb(.72, .85, .88));
}

const mirrorCenters = [[287,262],[773,262],[1250,262],[287,744],[773,744],[1250,744]];
export function drawMirrorSprite(mirror, time) {
  const [x,y] = mirrorCenters[Math.floor(time * 5) % 6];
  // The silver surface is 244px long; match its length to the scaled 1.44-unit
  // collision segment. LittleJS sprite angles rotate clockwise.
  const size = 432 * 1.44 / 244 * MIRROR_SCALE;
  drawRegion([7, x-216, y-216, 432, 432], mirror, size, size,
    mirror.rotatable ? L.rgb(.45, .9, 1) : L.rgb(1, .82, .58), false, -mirror.angle);
}

export function drawTotemSprite(totem, time) {
  const column = totem.active ? Math.floor(time * 6) % 6 : 0;
  drawRegion([2, column * 362, totem.active ? 362 : 0, 362, 362], totem, 1.55, 1.55);
}

export function drawCrystalSprite(crystal, angle) {
  // Bronze ember disc from the supplied tileset; retain the rotating phase.
  drawRegion([0, 635, 789, 143, 145], crystal, 1.25, 1.27, L.WHITE, false, -angle);
}

export function drawMonsterSprite(monster, time, animationTime = time) {
  const pose = monsterPose(monster, time);
  const width = 1774 / 8;
  const frame = monster.destroyed ? Math.min(7, Math.floor((animationTime - monster.destroyedAt) * 8)) : Math.floor(time * 8) % 8;
  const y = monster.destroyed ? 443 : 100, height = monster.destroyed ? 444 : 330;
  drawRegion([8, frame * width, y, width, height], { x: pose.x, y: pose.y + (monster.destroyed ? .57 : .4) },
    1.2, height / width * 1.2, L.WHITE, pose.facing < 0);
}

const woodBreakFrames = [
  [30, 490, 255, 250], [330, 486, 255, 254], [611, 483, 270, 267],
  [884, 458, 294, 310], [1188, 494, 280, 263], [1485, 597, 265, 162],
];
export function drawWoodSprite(item, time) {
  if (!item.destroyed) {
    drawRegion([3, 30, 154, 250, 244], item, .98, .96);
    return;
  }
  const progress = 1 - Math.max(0, item.burnUntil - time) / item.delay;
  const frame = Math.min(5, Math.max(0, Math.floor(progress * 6)));
  const rectangle = woodBreakFrames[frame];
  drawRegion([3, ...rectangle], { x: item.x, y: item.y + (frame === 5 ? -.23 : 0) }, rectangle[2] / 260, rectangle[3] / 260);
}

// Clockwise mask bits: north, east, south, west. Rotations use LittleJS's
// clockwise draw angle so the artwork follows the actual conductor graph.
const metalShapes = [
  { mask: 10, column: 0, row: 0, x: 198, y: 224 },
  { mask: 5, column: 1, row: 0, x: 550, y: 224 },
  { mask: 3, column: 2, row: 0, x: 894, y: 224 },
  { mask: 13, column: 3, row: 0, x: 1266, y: 224 },
  { mask: 15, column: 0, row: 1, x: 198, y: 543 },
  { mask: 8, column: 1, row: 1, x: 550, y: 543 },
  { mask: 1, column: 2, row: 1, x: 902, y: 543 },
  { mask: 0, column: 3, row: 1, x: 1270, y: 543 },
];
export function drawMetalSprite(cell, state) {
  const directions = cell.neighbors.map(id => {
    const other = state.conductors.find(item => item.id === id);
    return { x: other.x - cell.x, y: other.y - cell.y };
  }).concat(cell.ports);
  const mask = directions.reduce((bits, direction) => bits | (direction.y > 0 ? 1 : direction.x > 0 ? 2 : direction.y < 0 ? 4 : 8), 0);
  for (const shape of metalShapes) {
    let rotated = shape.mask;
    for (let turns = 0; turns < 4; turns++) {
      if (rotated === mask) {
        const charged = cell.chargedUntil > state.time;
        const chargedArt = charged && shape.row === 0;
        const x = shape.x;
        const y = chargedArt ? 874 : shape.y;
        drawRegion([4, x - 160, y - 160, 320, 320], cell, 1.08, 1.08,
          charged && !chargedArt ? L.rgb(.75, 1, 1) : L.WHITE, false, turns * Math.PI / 2);
        return;
      }
      rotated = ((rotated << 1) & 15) | (rotated >> 3);
    }
  }
}

export function drawCloudSprite(cloud, time) {
  const column = Math.floor(time * 4) % 6;
  const row = cloud.type === 'trapCloud' ? 1 : 0;
  const tint = cloud.storedRayId !== null ? L.rgb(1, 1, .82) : L.WHITE;
  drawRegion([5, column * 362, row * 362, 362, 362], { x: cloud.x, y: cloud.y + .08 }, 1.42, 1.42, tint);
}

const floors = [[0, 3, 3, 150, 150], [0, 475, 3, 148, 150], [0, 3, 161, 150, 150]];
export function drawFloorSprite(position, variation) {
  drawRegion(floors[variation % floors.length], position, 1.005, 1.005, L.rgb(.72, .70, .65));
}
export function drawWallSprite(position) {
  drawRegion([0, 985, 342, 88, 111], { x: position.x, y: position.y + .08 }, .98, 1.16);
}
export function drawDoorSprite(position, open) {
  if (open) L.drawRect(L.vec2(position.x, position.y), L.vec2(.75, .85), L.rgb(1, .78, .3));
  drawRegion([0, 792, 648, 144, 122], position, 1.05, 1.05, open ? L.rgb(1, 1, 1, .3) : L.WHITE);
}

// Foot pivots compensate for the irregular placement within the 256px cells.
const idlePivots = [143, 143, 143, 143, 143, 143];
const castFrames = [0, 1, 2, 3, 5];
const castPivots = [139, 139, 133, 145, 145, 144];
export function drawZeusSprite(position, aim, visual, status) {
  let row = 0, column = Math.floor(visual.time * 5) % 6, pivotX = idlePivots[column];
  const elapsed = visual.time - visual.shotAt;
  if (status === 'won') {
    row = 2;
    column = Math.floor((visual.time - visual.victoryAt) * 7) % 6;
    pivotX = 140;
  } else if (status === 'lost') {
    row = 3;
    column = Math.min(5, Math.floor((visual.time - visual.lostAt) * 6));
    pivotX = 143;
  } else if (elapsed >= 0 && elapsed < .6) {
    row = 1;
    column = castFrames[Math.min(4, Math.floor(elapsed / .12))];
    pivotX = castPivots[column];
  }
  const mirror = aim.x < 0;
  const size = 1.55;
  let pivotY = row === 0 ? 248 : row === 3 ? 250 : 254;
  let rectangle = [1, column * 256, row * 256, 256, 256];
  if (row === 2) {
    // The cast row's feet reach y=516; celebration spans y=523..773.
    // Preserve the original world-space pivot at sheet y=766 while giving
    // every happy frame its full height and excluding the previous row.
    rectangle = [1, column * 256, 520, 256, 260];
    pivotY = 246;
  } else if (row === 3) {
    // Likewise, exclude the celebration feet above the loss animation.
    rectangle = [1, column * 256, 784, 256, 240];
    pivotY = 234;
  }
  if (row === 1 && column === 3) {
    // The arm and left foot cross the nominal cell boundary. Exclude the baked
    // lightning on the right, retaining the complete body and its foot pivot.
    rectangle = [1, 736, 280, 210, 237];
    pivotX = 94;
    pivotY = 229;
  }
  const width = rectangle[3], height = rectangle[4];
  const center = {
    x: position.x + (width / 2 - pivotX) / 256 * size * (mirror ? -1 : 1),
    y: position.y - .48 + (pivotY - height / 2) / 256 * size,
  };
  drawRegion(rectangle, center, width / 256 * size, height / 256 * size, L.WHITE, mirror);
}
