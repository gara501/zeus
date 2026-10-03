import { loadLevel } from './grid.js';
import { schedulePulse, releasePulse } from './conduction.js';
import { crystalAngle, cloudReleaseTime } from './elements.js';
import { expireGroups, hitTotem } from './totems.js';
import { add, scale, normalize, reflect, nearestHit, EPSILON } from './ray.js';

export const RAY_SPEED = 12;
export const MAX_BRANCHES = 128;
export const hasActiveShot = state => state.rays.length > 0 || state.pulses.length > 0 || state.delayed.length > 0;

export function createState(level) {
  return { ...loadLevel(level), time: 0, remaining: level.shots ?? 3, shots: 0,
    rays: [], trails: [], pulses: [], delayed: [], branchCounts: {}, nextId: 1, status: 'playing' };
}

// Pure reducer: inputs and time in, new state and timestamped events out.
export function stepSimulation(previous, commands, dt) {
  const state = structuredClone(previous);
  const events = [];
  if (state.status !== 'playing') return { state, events };
  const startTime = state.time;
  state.time += dt;
  state.trails = state.trails.filter(segment => state.time - segment.time < .24);

  for (const command of commands) {
    if (command.type === 'rotate') {
      const mirror = state.mirrors.find(m => m.id === command.id && m.rotatable);
      if (mirror && Number.isFinite(command.angle)) mirror.angle = command.angle;
    }
    if (command.type === 'fire' && state.remaining > 0 && !hasActiveShot(state)) {
      const ray = { id: state.nextId++, position: { ...state.zeus }, direction: normalize(command.direction),
        speed: RAY_SPEED, age: 0, interactions: 0 };
      ray.shotId = ray.id;
      ray.networks = [];
      state.branchCounts[ray.shotId] = 1;
      state.rays.push(ray);
      state.shots++;
      state.remaining--;
      events.push({ type: 'fire', position: ray.position, time: startTime });
    }
  }

  // Schedule swept arrivals across all rays, rather than finishing one ray first.
  const pending = state.rays.map(ray => ({ ray, elapsed: 0 }));
  const alive = [];
  while (pending.length || state.pulses[0]?.time <= state.time + EPSILON || state.delayed[0]?.time <= state.time + EPSILON) {
    const scheduled = pending.map(item => {
      const distance = (dt - item.elapsed) * item.ray.speed;
      const hit = nearestHit(state, item.ray.position, item.ray.direction, distance);
      return { ...item, hit, arrival: hit ? item.elapsed + hit.distance / item.ray.speed : dt };
    }).sort((a, b) => a.arrival - b.arrival || a.ray.id - b.ray.id);
    const item = scheduled[0];
    const pulse = state.pulses[0];
    const delayed = state.delayed[0];
    if (delayed && delayed.time <= state.time + EPSILON && (!item || delayed.time <= startTime + item.arrival) && (!pulse || delayed.time <= pulse.time)) {
      state.delayed.shift();
      if (delayed.cloudId) {
        const cloud = state.clouds.find(item => item.id === delayed.cloudId);
        cloud.storedRayId = null;
        cloud.releaseAt = 0;
      }
      pending.push({ ray: delayed.ray, elapsed: Math.max(0, Math.min(dt, delayed.time - startTime)) });
      events.push({ type: delayed.cloudId ? 'discharge' : 'release', position: delayed.ray.position, time: delayed.time });
      continue;
    }
    if (pulse && pulse.time <= state.time + EPSILON && (!item || pulse.time <= startTime + item.arrival)) {
      state.pulses.shift();
      const cell = state.conductors.find(cell => cell.id === pulse.nodeId);
      const branches = releasePulse(state, pulse);
      events.push({ type: 'conduct', kind: cell.type, position: { x: cell.x, y: cell.y }, time: pulse.time });
      for (const branch of branches) {
        if ((state.branchCounts[pulse.shotId] || 0) >= MAX_BRANCHES) break;
        state.branchCounts[pulse.shotId] = (state.branchCounts[pulse.shotId] || 0) + 1;
        pending.push({ ray: { ...branch, id: state.nextId++, shotId: pulse.shotId, networks: pulse.networks,
          age: 0, speed: RAY_SPEED, interactions: pulse.interactions }, elapsed: Math.max(0, Math.min(dt, pulse.time - startTime)) });
      }
      continue;
    }
    pending.splice(pending.findIndex(entry => entry.ray.id === item.ray.id), 1);
    const { ray, hit } = item;
    const distance = hit ? hit.distance : (dt - item.elapsed) * ray.speed;
    const point = add(ray.position, scale(ray.direction, distance));
    if (distance > EPSILON) state.trails.push({ from: { ...ray.position }, to: point, time: startTime + item.arrival, seed: ray.id });
    ray.position = point;
    if (!hit) {
      ray.age += dt;
      if (ray.age < 6) alive.push(ray);
      continue;
    }
    const time = startTime + item.arrival;
    ray.interactions++;
    if (hit.entity.type === 'mirror' && ray.interactions < 64) {
      ray.direction = reflect(ray.direction, hit.normal);
      ray.position = add(point, scale(ray.direction, EPSILON * 4));
      events.push({ type: 'bounce', position: point, time });
      pending.push({ ray, elapsed: item.arrival });
    } else if ((hit.entity.type === 'water' || hit.entity.type === 'metal') && ray.interactions < 64) {
      const entered = schedulePulse(state, hit.entity, ray, time, point);
      events.push({ type: entered ? hit.entity.type : 'grounded', position: point, time });
    } else if (hit.entity.type === 'crystal' && ray.interactions < 64) {
      const angle = crystalAngle(hit.entity, time);
      const direction = reflect(ray.direction, { x: -Math.sin(angle), y: Math.cos(angle) });
      events.push({ type: 'split', position: { x: hit.entity.x, y: hit.entity.y }, time, angle });
      if ((state.branchCounts[ray.shotId] || 0) < MAX_BRANCHES) {
        state.branchCounts[ray.shotId] = (state.branchCounts[ray.shotId] || 0) + 1;
        pending.push({ ray: { ...ray, id: state.nextId++, direction,
          position: add(hit.entity, scale(direction, .42005)) }, elapsed: item.arrival });
      }
      ray.position = add(hit.entity, scale(ray.direction, .42005));
      pending.push({ ray, elapsed: item.arrival });
    } else if (hit.entity.type === 'chargeCloud' && ray.interactions < 64 && hit.entity.storedRayId === null) {
      const cloud = hit.entity;
      cloud.storedRayId = ray.id;
      cloud.releaseAt = cloudReleaseTime(cloud, time);
      ray.direction = normalize(cloud.direction ?? ray.direction);
      ray.position = add(cloud, scale(ray.direction, .48005));
      state.delayed.push({ time: cloud.releaseAt, ray, cloudId: cloud.id });
      state.delayed.sort((a, b) => a.time - b.time || a.ray.id - b.ray.id);
      events.push({ type: 'charge', position: { x: cloud.x, y: cloud.y }, time });
    } else if (hit.entity.type === 'chargeCloud' || hit.entity.type === 'trapCloud') {
      // A full cloud absorbs extra impacts without replacing or extending its charge.
      events.push({ type: 'absorb', position: point, time });
    } else if (hit.entity.type === 'wood' || hit.entity.type === 'block') {
      hit.entity.hits++;
      hit.entity.destroyed = hit.entity.hits >= hit.entity.requiredHits;
      events.push({ type: hit.entity.type === 'wood' ? 'burn' : hit.entity.destroyed ? 'break' : 'crack', position: point, time });
      if (hit.entity.type === 'wood') {
        // Burning is cosmetic. The ray is consumed and the opening is permanent.
        hit.entity.burnUntil = time + hit.entity.delay;
      }
    } else {
      const type = hit.entity.type === 'totem' ? 'totem' : 'wall';
      events.push({ type, position: point, time });
      if (type === 'totem') hitTotem(state, hit.entity, time, events);
    }
  }
  state.rays = alive;
  expireGroups(state, state.time, events);
  if (state.totems.every(totem => totem.active)) {
    state.status = 'won';
    events.push({ type: 'victory', position: state.door, time: state.time });
  } else if (state.remaining === 0 && state.rays.length === 0 && state.pulses.length === 0 && state.delayed.length === 0) {
    state.status = 'lost';
    events.push({ type: 'empty', time: state.time });
  }
  return { state, events };
}
