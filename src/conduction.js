import { add, scale } from './ray.js';

export const CARDINALS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const key = p => `${p.x},${p.y}`;

export function connectConductors(cells, walls, metalPorts = []) {
  const byPosition = new Map(cells.map(cell => [key(cell), cell]));
  const blocked = new Set(walls.map(key));
  for (const cell of cells) {
    cell.neighbors = CARDINALS.map(direction => byPosition.get(key(add(cell, direction))))
      .filter(next => next?.type === cell.type).map(next => next.id);
    cell.ports = cell.type === 'water' ? CARDINALS.filter(direction => {
      const next = add(cell, direction);
      return byPosition.get(key(next))?.type !== 'water' && !blocked.has(key(next));
    }) : metalPorts.filter(port => port.x === cell.x && port.y === cell.y).map(port => port.direction);
    if (cell.type === 'metal' && !cell.ports.length && cell.neighbors.length === 1) {
      const neighbor = cells.find(next => next.id === cell.neighbors[0]);
      cell.ports = [{ x: cell.x - neighbor.x, y: cell.y - neighbor.y }];
    }
  }
  let component = 0;
  for (const first of cells) {
    if (first.network) continue;
    const queue = [first];
    const network = `${first.type}:${++component}`;
    first.network = network;
    for (let i = 0; i < queue.length; i++) for (const id of queue[i].neighbors) {
      const neighbor = cells.find(cell => cell.id === id);
      if (!neighbor.network) { neighbor.network = network; queue.push(neighbor); }
    }
  }
  return cells;
}

// One wave visits each cell once, at its earliest arrival time.
export function schedulePulse(state, entry, ray, time, point) {
  if ((ray.networks || []).includes(entry.network)) return false;
  const speed = entry.type === 'water' ? 8 : 14;
  const queue = [{ cell: entry, from: point, start: time, time: time + Math.hypot(point.x - entry.x, point.y - entry.y) / speed }];
  const visited = new Set([entry.id]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    state.pulses.push({ nodeId: current.cell.id, from: current.from, start: current.start, time: current.time,
      shotId: ray.shotId ?? ray.id, networks: [...(ray.networks || []), entry.network], rodVisits: ray.rodVisits ?? [], interactions: ray.interactions,
      entryId: entry.id, incoming: ray.direction });
    for (const id of current.cell.neighbors) {
      if (visited.has(id)) continue;
      visited.add(id);
      const next = state.conductors.find(cell => cell.id === id);
      queue.push({ cell: next, from: { x: current.cell.x, y: current.cell.y }, start: current.time, time: current.time + 1 / speed });
    }
  }
  state.pulses.sort((a, b) => a.time - b.time || a.shotId - b.shotId || a.nodeId.localeCompare(b.nodeId));
  return true;
}

export function releasePulse(state, pulse) {
  const cell = state.conductors.find(item => item.id === pulse.nodeId);
  cell.chargedUntil = pulse.time + .35;
  state.trails.push({ from: pulse.from, to: { x: cell.x, y: cell.y }, time: pulse.time, seed: pulse.shotId });
  return cell.ports.filter(direction => cell.type !== 'metal' || cell.id !== pulse.entryId ||
    direction.x * pulse.incoming.x + direction.y * pulse.incoming.y >= -.7)
    .map(direction => ({ position: add(cell, scale(direction, .50005)), direction }));
}
