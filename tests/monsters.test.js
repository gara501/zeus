import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterPose, movingMonsterHit } from '../src/monsters.js';
import { levels } from '../src/levels.js';
import { runPlan, solutionPlans } from '../scripts/level-solutions.js';
import { createState, stepSimulation } from '../src/simulation.js';

const fixture = phase => ({ ...levels[0], mirrors: [],
  map: ['###############', '#.............#', '#.............#', '#.............#', '#.Z.........T.#', '#.............#', '#............D#', '###############'],
  monsters: [{ from: -1, to: 1, y: -.5, speed: 1, phase }] });

test('Patrols reverse at their endpoints, repeat deterministically and stop after destruction', () => {
  const monster = createState(fixture(0)).monsters[0];
  assert.deepEqual([0, 1, 2, 3, 4].map(time => [monsterPose(monster, time).x, monsterPose(monster, time).facing]), [[-1, 1], [0, 1], [1, -1], [0, -1], [-1, 1]]);
  Object.assign(monster, { destroyed: true, x: .3, facing: -1 });
  assert.equal(monsterPose(monster, 100).x, .3);
});

test('Frontal hits consume the bolt and spare the guardian; rear hits explode and clear the route', () => {
  const frontal = runPlan(fixture(2), [{ fire: [5, -.5] }]);
  assert.ok(frontal.events.some(event => event.type === 'monsterBlock'));
  assert.equal(frontal.state.monsters[0].destroyed, false);
  const rear = runPlan(fixture(0), [{ fire: [5, -.5] }, { fire: [5, -.5] }]);
  assert.equal(rear.state.status, 'won');
  assert.equal(rear.state.shots, 2);
  assert.equal(rear.events.filter(event => event.type === 'monsterBreak').length, 1);
  assert.equal(rear.events.filter(event => event.type === 'totem').length, 1);
});

test('Moving collisions agree at 30/60/120 Hz and a large swept step', () => {
  const times = [];
  for (const hz of [2, 30, 60, 120]) {
    const result = runPlan(fixture(0), [{ fire: [5, -.5] }], hz);
    times.push(result.events.find(event => event.type === 'monsterBreak').time);
  }
  for (const time of times) assert.ok(Math.abs(time - times[0]) < 1e-7);
  const monster = { from: -1, to: 1, y: 0, speed: 4, phase: 0, radius: .42, destroyed: false };
  assert.ok(movingMonsterHit(monster, { x: 0, y: -2 }, { x: 0, y: 1 }, 12, 0, .5), 'A moving guardian crosses the bolt between frame endpoints');
  const turning = { ...monster, speed: 10 };
  const hit = movingMonsterHit(turning, { x: -5, y: 0 }, { x: 1, y: 0 }, 12, 0, 1);
  assert.ok(Math.abs(hit.distance / 12 - (.2 + (3.6 - .42) / 22)) < 1e-7, 'The sweep follows a reversal within the same frame');
});

test('Side hits block, restart restores patrols and invalid patrols are rejected', () => {
  const level = fixture(0), state = createState(level);
  state.zeus = { x: -1, y: -2.5 };
  state.monsters[0].speed = .01;
  const result = stepSimulation(state, [{ type: 'fire', direction: { x: 0, y: 1 } }], .5);
  assert.ok(result.events.some(event => event.type === 'monsterBlock'));
  assert.equal(createState(level).monsters[0].destroyed, false);
  assert.throws(() => createState({ ...level, monsters: [{ from: 1, to: -1, y: 0, speed: 1 }] }), /Invalid monster patrol/);
});

test('Only the final five levels contain guardians and all final routes solve with real ammunition', () => {
  for (const [index, level] of levels.entries()) assert.equal(Boolean(level.monsters?.length), index >= 30);
  for (let index = 30; index < 35; index++) {
    const result = runPlan(levels[index], solutionPlans[index]);
    assert.equal(result.state.status, 'won');
    assert.ok(result.events.some(event => event.type === 'monsterBreak'));
  }
  const early = runPlan(levels[30], [{ rotate: solutionPlans[30][0].rotate }, { fire: [-2, -1.5] }]);
  assert.ok(early.events.some(event => event.type === 'monsterBlock'), 'The introductory guardian teaches facing, rather than dying on every hit');
});
