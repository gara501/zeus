import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudReleaseTime } from '../src/elements.js';
import { createState, stepSimulation, hasActiveShot } from '../src/simulation.js';
import { levels } from '../src/levels.js';
import { runPlan } from '../scripts/level-solutions.js';

test('Cloud cycles accept exact ticks, wait a full cycle just after, and respect phase', () => {
  const cloud = { period: 3, phase: 0 };
  assert.equal(cloudReleaseTime(cloud, 2.9), 3);
  assert.equal(cloudReleaseTime(cloud, 3), 3);
  assert.equal(cloudReleaseTime(cloud, 3.001), 6);
  assert.equal(cloudReleaseTime({ period: 4, phase: 1 }, 4), 5);
  assert.equal(cloudReleaseTime({ delay: 1.4, period: null }, .3), 1.7);
});

test('A cyclic cloud stores a single charge and blocks firing until the complete route ends', () => {
  let state = createState(levels[18]);
  const fire = { type: 'fire', direction: { x: 1, y: 0 } };
  state = stepSimulation(state, [fire], .5).state;
  assert.equal(state.clouds[0].releaseAt, 3);
  assert.equal(state.delayed.length, 1);
  assert.equal(hasActiveShot(state), true);
  const result = stepSimulation(state, [fire], .1);
  assert.equal(result.state.shots, state.shots);
  assert.ok(!result.events.some(event => event.type === 'fire'));
  const restored = createState(levels[18]);
  assert.equal(restored.clouds[0].storedRayId, null);
  assert.equal(restored.time, 0);
});

test('An empty cycle is repeatable and a cloud can be charged again after discharge', () => {
  const { state, events } = runPlan(levels[19], [{ at: 3, fire: [-1, -.5] }, { at: 26, fire: [-1, -.5] }]);
  assert.equal(state.status, 'won');
  assert.deepEqual(events.filter(e => e.type === 'discharge').map(e => e.time), [6, 27]);
  assert.equal(state.shots, 2);
});

test('Invalid cloud periods cannot create an endless shot', () => {
  for (const period of [0, -1, NaN, Infinity]) {
    const level = structuredClone(levels[18]);
    level.clouds[0].period = period;
    assert.throws(() => createState(level), /period/);
  }
});
