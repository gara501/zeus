// Reference routes for automated checks; not imported by the shipped game.
import { createState, stepSimulation, hasActiveShot } from '../src/simulation.js';
import { normalize } from '../src/ray.js';
const fire = (x, y) => ({ fire: [x, y] });
const rotate = (...mirrors) => ({ rotate: mirrors });
export const solutionPlans = [
  [fire(4, 1.5)], [fire(-1, -1.5)],
  [rotate([1, -1.5, Math.PI / 4]), fire(1, -1.5)],
  [fire(-1, -1.5)], [fire(-1, -1.5)], [fire(-1, -1.5)], [fire(-1, -.5)],
  [fire(0, -.5), fire(0, -.5)], [fire(0, -.5), fire(0, -.5), fire(0, -.5)],
  Array.from({ length: 4 }, () => fire(-1, -.5)),
  [fire(0, -.5)], [fire(0, -.5)], [fire(-2, 1.5)],
  Array.from({ length: 3 }, () => fire(3, -.5)),
  [fire(0, 1.5), fire(3, -.5), fire(0, -2.5)], [fire(1, 1.5), fire(1, -2.5)],
  [rotate([-2, -1.5, Math.PI / 4], [3, 1.5, -Math.PI / 4]), fire(-2, -1.5)],
  [rotate([-2, 2.5, Math.PI / 4]), fire(-2, -1.5), fire(-2, -1.5)],
  [fire(-1, -.5)], [fire(-1, -.5)], [fire(-2, -.5)],
  [fire(-3, -1.5), { at: 1, during: true, rotate: [[-3, 1.5, (Math.PI + Math.atan2(-4, 7)) / 2]] }],
  [rotate([-2, 1.5, Math.PI / 4]), fire(-2, -1.5), rotate([-2, 1.5, (Math.PI / 2 + Math.atan2(-2, 4)) / 2]), fire(-2, -1.5), rotate([-2, 1.5, -Math.PI / 4]), fire(-2, -1.5)],
  [rotate([-4, -2.5, Math.PI / 4], [-4, 1.5, Math.PI / 4]), fire(-4, -2.5)],
  [rotate([1, -1.5, Math.PI / 4], [-4, -.5, -Math.PI / 4]), ...Array.from({ length: 4 }, () => fire(-3, -1.5))],
  [rotate([-2, -2.5, Math.PI / 4], [2, 1.5, -Math.PI / 4]), fire(-2, -2.5)],
  [rotate([-2, -2.5, Math.PI / 4]), fire(-2, -2.5), { at: 1, fire: [-2, -2.5] }],
  [rotate([-2, -1.5, 0], [1, -1.5, Math.PI / 4]), ...Array.from({ length: 4 }, () => fire(-3, -1.5)), { at: 3, during: true, rotate: [[-2, -1.5, -Math.PI / 4], [1, -1.5, 0]] }],
  [rotate([3, 1.5, -Math.PI / 4]), fire(-2, -1.5), { at: 1, fire: [-2, -1.5] }, rotate([3, 1.5, -Math.PI / 8]), fire(-2, -1.5)],
  [rotate([1, -1.5, Math.PI / 4], [-4, -.5, -Math.PI / 4]), ...Array.from({ length: 4 }, () => fire(-3, -1.5))],
  [rotate([-2, -1.5, Math.PI / 4], [3, 1.5, -Math.PI / 4]), { at: 3, fire: [-2, -1.5] }, fire(-2, -1.5)],
  [rotate([-2, -.5, Math.PI / 4]), { at: 3, fire: [-2, -.5] }, fire(-2, -.5), rotate([-2, -.5, -Math.PI / 4]), { at: 8, fire: [-2, -.5] }, fire(-2, -.5)],
  [rotate([-4, -2.5, Math.PI / 4], [-4, 1.5, Math.PI / 4]), fire(-4, -2.5), { at: 4.2, fire: [-4, -2.5] }, fire(-4, -2.5)],
  [fire(-3, -.5), { at: 1, fire: [-2, -.5] }, { at: 5, fire: [-2, -.5] }],
  [rotate([1, -1.5, Math.PI / 4], [-4, -.5, -Math.PI / 4]), ...Array.from({ length: 5 }, () => fire(-3, -1.5))],
];

export function runPlan(level, plan, hz = 60) {
  let state = createState(level);
  const events = [];
  const tick = commands => {
    const result = stepSimulation(state, commands, 1 / hz);
    state = result.state; events.push(...result.events);
  };
  const drain = () => {
    for (let frames = 0; hasActiveShot(state) && state.status === 'playing'; frames++) {
      if (frames > 60 * hz) throw new Error(`Shot did not finish: ${level.id}`);
      tick([]);
    }
  };
  for (const action of plan) {
    if (!action.during) drain();
    while (action.at !== undefined && state.time < action.at - 1e-8 && state.status === 'playing') tick([]);
    const commands = (action.rotate ?? []).map(([x, y, angle]) => {
      const mirror = state.mirrors.find(item => item.x === x && item.y === y);
      if (!mirror) throw new Error(`Reference mirror missing: ${level.id}`);
      return { type: 'rotate', id: mirror.id, angle };
    });
    if (action.fire) commands.push({ type: 'fire', direction: normalize({ x: action.fire[0] - state.zeus.x, y: action.fire[1] - state.zeus.y }) });
    tick(commands);
  }
  drain();
  return { state, events };
}
