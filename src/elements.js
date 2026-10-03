export function crystalAngle(crystal, time) {
  // A half turn repeats the reflective surface's orientation.
  return crystal.phase + Math.PI * time / crystal.period;
}

// Cyclic clouds use the level clock, rather than restarting their cycle on impact.
// An arrival exactly on a discharge tick is accepted on that tick.
export function cloudReleaseTime(cloud, time) {
  if (!cloud.period) return time + cloud.delay;
  const tick = Math.ceil((time - cloud.phase - 1e-8) / cloud.period);
  return Math.max(time, cloud.phase + tick * cloud.period);
}
