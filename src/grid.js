import { connectConductors } from './conduction.js';

export function loadLevel(level) {
  if (level.map.length !== 8 || level.map.some(row => row.length !== 15)) throw new Error('El tablero debe medir 15 × 8');
  const walls = [], totems = [], mirrors = [], conductors = [], breakables = [], crystals = [], clouds = [];
  let zeus, door;
  level.map.forEach((row, y) => [...row].forEach((symbol, x) => {
    const position = { x: x - 7, y: 3.5 - y };
    const id = `${x}:${y}`;
    if (symbol === '#') walls.push({ ...position, id, type: 'wall' });
    if (symbol === 'Z') zeus = position;
    if (symbol === 'D') door = position;
    if (symbol === 'T') {
      const metadata = level.totems?.find(item => item.x === position.x && item.y === position.y);
      totems.push({ ...position, id, type: 'totem', active: false, hits: 0,
        requiredHits: metadata?.hits ?? 1, group: metadata?.group ?? null, order: metadata?.order ?? 0 });
    }
    if (symbol === '~' || symbol === '=') conductors.push({ ...position, id, type: symbol === '~' ? 'water' : 'metal', chargedUntil: 0 });
    if (symbol === 'W' || symbol === 'B') {
      const metadata = level.breakables?.find(item => item.x === position.x && item.y === position.y);
      breakables.push({ ...position, id, type: symbol === 'W' ? 'wood' : 'block',
        destroyed: false, hits: 0, requiredHits: symbol === 'W' ? 1 : metadata?.hits ?? 2,
        burnUntil: 0, delay: level.burnDuration ?? .6 });
    }
    if (symbol === 'G') {
      const metadata = level.crystals?.find(item => item.x === position.x && item.y === position.y);
      crystals.push({ ...position, id, type: 'crystal', phase: metadata?.phase ?? 0, period: metadata?.period ?? 8, incoming: metadata?.incoming ?? null });
    }
    if (symbol === 'N' || symbol === 'C') {
      const metadata = level.clouds?.find(item => item.x === position.x && item.y === position.y);
      if (metadata?.period !== undefined && (!Number.isFinite(metadata.period) || metadata.period <= 0)) throw new Error('Cloud period must be positive');
      clouds.push({ ...position, id, type: symbol === 'N' ? 'chargeCloud' : 'trapCloud',
        delay: metadata?.delay ?? 1.2, period: metadata?.period ?? null, phase: metadata?.phase ?? 0,
        direction: metadata?.direction ?? null, storedRayId: null, releaseAt: 0 });
    }
    if (symbol === '/' || symbol === 'm') {
      const metadata = level.mirrors.find(m => m.x === position.x && m.y === position.y);
      if (!metadata) throw new Error(`Missing mirror metadata for ${id}`);
      mirrors.push({ ...metadata, id, type: 'mirror' });
    }
  }));
  if (!zeus || !door || !totems.length) throw new Error('A level needs Zeus, a door and a totem');
  const groups = (level.groups ?? []).map(group => ({ ...group, deadline: null, next: 0, completed: false,
    members: totems.filter(item => item.group === group.id).sort((a, b) => a.order - b.order).map(item => item.id) }));
  return { zeus, door, walls, mirrors, totems, groups, breakables, crystals, clouds, conductors: connectConductors(conductors, walls, level.metalPorts) };
}
