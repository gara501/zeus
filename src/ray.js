// Geometry has no engine dependencies. Distances are world units.
import { MIRROR_HIT_SCALE } from './config.js';
import { monsterPose, movingMonsterHit } from './monsters.js';
export const EPSILON = 1e-5;
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v, n) => ({ x: v.x * n, y: v.y * n });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const normalize = v => {
  const length = Math.hypot(v.x, v.y);
  return length > EPSILON ? scale(v, 1 / length) : { x: 1, y: 0 };
};
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => add(a, scale(b, -1));

export function reflect(direction, normal) {
  return normalize(add(direction, scale(normal, -2 * dot(direction, normal))));
}

export function hitSegment(origin, direction, a, b, maxDistance = Infinity) {
  const edge = subtract(b, a);
  const denominator = cross(direction, edge);
  if (Math.abs(denominator) < EPSILON) return null;
  const offset = subtract(a, origin);
  const distance = cross(offset, edge) / denominator;
  const along = cross(offset, direction) / denominator;
  if (distance < -EPSILON || distance > maxDistance + EPSILON || along < -EPSILON || along > 1 + EPSILON) return null;
  return { distance: Math.max(0, Math.min(distance, maxDistance)), normal: normalize({ x: -edge.y, y: edge.x }) };
}

export function hitCircle(origin, direction, center, radius, maxDistance = Infinity) {
  const offset = subtract(origin, center);
  const b = dot(offset, direction);
  const c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const near = -b - Math.sqrt(discriminant);
  const far = -b + Math.sqrt(discriminant);
  const distance = near >= -EPSILON ? near : far;
  return distance >= -EPSILON && distance <= maxDistance + EPSILON ? { distance: Math.max(0, Math.min(distance, maxDistance)) } : null;
}

export function hitBox(origin, direction, center, halfSize, maxDistance = Infinity) {
  let near = -Infinity;
  let far = Infinity;
  for (const axis of ['x', 'y']) {
    const low = center[axis] - halfSize;
    const high = center[axis] + halfSize;
    if (Math.abs(direction[axis]) < EPSILON) {
      if (origin[axis] < low || origin[axis] > high) return null;
      continue;
    }
    const first = (low - origin[axis]) / direction[axis];
    const second = (high - origin[axis]) / direction[axis];
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return null;
  }
  const distance = near >= -EPSILON ? near : far;
  return distance >= -EPSILON && distance <= maxDistance + EPSILON ? { distance: Math.max(0, Math.min(distance, maxDistance)) } : null;
}

export function mirrorEnds(mirror) {
  const tangent = { x: Math.cos(mirror.angle), y: Math.sin(mirror.angle) };
  return [add(mirror, scale(tangent, -.72 * MIRROR_HIT_SCALE)), add(mirror, scale(tangent, .72 * MIRROR_HIT_SCALE))];
}

export function nearestHit(state, origin, direction, maxDistance = 30, motion = null, ray = null) {
  let nearest = null;
  for (const entity of [...state.walls, ...state.mirrors, ...state.totems, ...(state.conductors || []), ...(state.breakables || []).filter(item => !item.destroyed), ...(state.crystals || []), ...(state.clouds || [])]) {
    let hit;
    if (entity.type === 'wall') hit = hitBox(origin, direction, entity, .5, maxDistance);
    if (entity.type === 'mirror') hit = hitSegment(origin, direction, ...mirrorEnds(entity), maxDistance);
    if (entity.type === 'totem') hit = hitCircle(origin, direction, entity, .44, maxDistance);
    if (entity.type === 'water' || entity.type === 'metal') hit = hitBox(origin, direction, entity, .5, maxDistance);
    if (entity.type === 'wood' || entity.type === 'block') hit = hitBox(origin, direction, entity, .5, maxDistance);
    if (entity.type === 'crystal') hit = hitCircle(origin, direction, entity, .42, maxDistance);
    if (entity.type === 'chargeCloud' || entity.type === 'trapCloud') hit = hitCircle(origin, direction, entity, .48, maxDistance);
    if (hit && (!nearest || hit.distance < nearest.distance - EPSILON)) nearest = { ...hit, entity };
  }
  for (const monster of (state.monsters ?? []).filter(monster => !monster.destroyed)) {
    const hit = motion ? movingMonsterHit(monster, origin, direction, motion.speed, motion.time, maxDistance / motion.speed)
      : hitCircle(origin, direction, monsterPose(monster, state.time), monster.radius, maxDistance);
    if (hit && (!nearest || hit.distance < nearest.distance - EPSILON)) nearest = { ...hit, entity: monster };
  }
  for (const rod of state.rods ?? []) {
    if (ray?.rodVisits?.includes(rod.id) || (ray?.rodTarget && ray.rodTarget !== rod.id)) continue;
    const arriving = ray?.rodTarget === rod.id;
    const inside = Math.hypot(origin.x - rod.x, origin.y - rod.y) <= rod.radius;
    const hit = arriving ? hitCircle(origin, direction, rod, .12, maxDistance)
      : inside ? { distance: 0 } : hitCircle(origin, direction, rod, rod.radius, maxDistance);
    if (!hit || (nearest && hit.distance >= nearest.distance - EPSILON)) continue;
    const entry = add(origin, scale(direction, hit.distance));
    const distance = Math.hypot(rod.x - entry.x, rod.y - entry.y);
    const inward = normalize(subtract(rod, entry));
    // The field cannot pull a bolt through masonry or an unopened crate.
    if (!arriving && [...state.walls, ...(state.breakables ?? []).filter(item => !item.destroyed)]
      .some(wall => hitBox(entry, inward, wall, .5, distance))) continue;
    nearest = { ...hit, entity: rod, capture: !arriving };
  }
  return nearest;
}
