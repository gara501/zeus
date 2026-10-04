// Deterministic horizontal patrols use the level clock, including exact turns.
export function monsterPose(monster, time) {
  if (monster.destroyed) return { x: monster.x, y: monster.y, facing: monster.facing, velocity: 0 };
  const distance = monster.to - monster.from;
  const travel = ((time + monster.phase) * monster.speed % (2 * distance) + 2 * distance) % (2 * distance);
  const facing = travel < distance ? 1 : -1;
  return { x: monster.from + (facing === 1 ? travel : 2 * distance - travel), y: monster.y,
    facing, velocity: facing * monster.speed };
}

// Sweep the bolt against each constant-velocity part of a patrol. Splitting at
// turns prevents tunnelling and makes impacts independent of frame rate.
export function movingMonsterHit(monster, origin, direction, raySpeed, time, duration) {
  let elapsed = 0;
  const leg = (monster.to - monster.from) / monster.speed;
  while (elapsed < duration + 1e-9) {
    const at = time + elapsed;
    const pose = monsterPose(monster, at + 1e-10);
    const nextTurn = (Math.floor((at + monster.phase + 1e-9) / leg) + 1) * leg - monster.phase;
    const span = Math.max(0, Math.min(duration - elapsed, nextTurn - at));
    const x = origin.x + direction.x * raySpeed * elapsed - pose.x;
    const y = origin.y + direction.y * raySpeed * elapsed - pose.y;
    const vx = direction.x * raySpeed - pose.velocity, vy = direction.y * raySpeed;
    const a = vx * vx + vy * vy, b = x * vx + y * vy, c = x * x + y * y - monster.radius ** 2;
    const discriminant = b * b - a * c;
    const arrival = c <= 0 ? 0 : a > 1e-12 && discriminant >= 0 ? (-b - Math.sqrt(discriminant)) / a : Infinity;
    if (arrival >= -1e-9 && arrival <= span + 1e-9) return { distance: Math.max(0, elapsed + arrival) * raySpeed };
    if (elapsed + span >= duration - 1e-9) break;
    elapsed += span;
  }
  return null;
}
