import test from 'node:test';
import assert from 'node:assert/strict';
import { hitSegment, hitBox, reflect, normalize } from '../src/ray.js';
import { createState, stepSimulation } from '../src/simulation.js';
import { levels } from '../src/levels.js';

const fire = direction => ({ type: 'fire', direction });
function run(state, seconds, frequency = 60) {
  const events = [];
  for (let i = 0; i < seconds * frequency; i++) {
    const result = stepSimulation(state, [], 1 / frequency);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

test('arbitrary-angle reflection conserves direction length and obeys the normal', () => {
  const incoming = normalize({ x: 3, y: -1 });
  const normal = normalize({ x: -1, y: 2 });
  const bounced = reflect(incoming, normal);
  assert.ok(Math.abs(Math.hypot(bounced.x, bounced.y) - 1) < 1e-10);
  const twice = reflect(bounced, normal);
  assert.ok(Math.abs(twice.x - incoming.x) < 1e-10);
  assert.ok(Math.abs(twice.y - incoming.y) < 1e-10);
});

test('swept intersections detect thin mirrors and reject parallel rays', () => {
  assert.equal(hitSegment({ x: -2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -.5 }, { x: 0, y: .5 }, 3).distance, 2);
  assert.equal(hitSegment({ x: -2, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -.5 }, { x: 0, y: .5 }, 3), null);
  assert.equal(hitSegment({ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0, y: -.5 }, { x: 0, y: .5 }, 3), null);
  assert.equal(hitBox({ x: -5, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, .5, 10).distance, 4.5);
});

test('level 1 is solvable at a free angle without mutating input state', () => {
  const initial = createState(levels[0]);
  const direction = normalize({ x: 9, y: 3 });
  const { state: fired } = stepSimulation(initial, [fire(direction)], 1 / 60);
  assert.equal(initial.shots, 0);
  assert.equal(initial.rays.length, 0);
  assert.equal(fired.shots, 1);
  const { state, events } = run(fired, 2);
  assert.equal(state.status, 'won');
  assert.equal(state.shots, 1);
  assert.equal(events.filter(e => e.type === 'victory').length, 1);
});

test('a fixed mirror solves level 2; direct aiming is blocked by marble', () => {
  const initial = createState(levels[1]);
  const blocked = stepSimulation(initial, [fire(normalize({ x: 4, y: 4 }))], 1 / 60).state;
  assert.equal(run(blocked, 2).state.totems[0].active, false);
  const fired = stepSimulation(initial, [fire({ x: 1, y: 0 })], 1 / 60).state;
  const result = run(fired, 2);
  assert.equal(result.state.status, 'won');
  assert.equal(result.events.filter(e => e.type === 'bounce').length, 1);
});

test('level 3 requires rotation and restarting restores the original angle and shot count', () => {
  const initial = createState(levels[2]);
  const unrotated = stepSimulation(initial, [fire({ x: 1, y: 0 })], 1 / 60).state;
  assert.equal(run(unrotated, 2).state.totems[0].active, false);
  const fired = stepSimulation(initial, [{ type: 'rotate', id: initial.mirrors[0].id, angle: Math.PI / 4 }, fire({ x: 1, y: 0 })], 1 / 60).state;
  assert.equal(run(fired, 2).state.status, 'won');
  assert.deepEqual(createState(levels[2]), initial);
});

test('orientation is evaluated at impact, even if changed while the ray travels', () => {
  const initial = createState(levels[2]);
  let state = stepSimulation(initial, [fire({ x: 1, y: 0 })], 1 / 60).state;
  state = run(state, .2).state;
  state = stepSimulation(state, [{ type: 'rotate', id: state.mirrors[0].id, angle: Math.PI / 4 }], 1 / 60).state;
  assert.equal(run(state, 2).state.status, 'won');
});

test('busy attempts are ignored and unlimited misses can be followed by a winning shot', () => {
  let state = createState(levels[0]);
  state = stepSimulation(state, [fire({ x: 1, y: 0 })], 1 / 60).state;
  state = run(state, .2).state;
  state = stepSimulation(state, [fire({ x: 1, y: 0 })], 1 / 60).state;
  assert.equal(state.shots, 1);
  assert.equal(state.rays.length, 1);
  state = run(state, 2).state;
  state = stepSimulation(state, [fire({ x: 1, y: 0 })], 1 / 60).state;
  assert.equal(state.shots, 2);
  assert.equal(state.rays.length, 1);
  assert.equal(state.status, 'playing');
  state = run(state, 2).state;
  for (let attempt = 0; attempt < 20; attempt++) {
    state = run(stepSimulation(state, [fire({ x: 1, y: 0 })], 1 / 60).state, 2).state;
    assert.equal(state.status, 'playing');
    assert.equal(state.shots, attempt + 3);
    assert.equal(Object.keys(state.branchCounts).length, 1);
  }
  state = run(stepSimulation(state, [fire(normalize({ x: 9, y: 3 }))], 1 / 60).state, 2).state;
  assert.equal(state.status, 'won');
  assert.equal(state.shots, 23);
  assert.equal(createState(levels[0]).shots, 0);
});

test('two real arrivals at the same totem emit two impacts', () => {
  const state = createState(levels[0]);
  state.rays = [1, 2].map(id => ({ id, position: { x: 3, y: 1.5 }, direction: { x: 1, y: 0 }, age: 0, speed: 12, interactions: 0 }));
  const result = stepSimulation(state, [], .1);
  assert.equal(result.events.filter(e => e.type === 'totem').length, 2);
  assert.equal(result.events.filter(e => e.type === 'victory').length, 1);
});

test('swept collisions solve the mirror level at different step sizes', () => {
  for (const frequency of [30, 60, 120]) {
    const state = stepSimulation(createState(levels[1]), [fire({ x: 1, y: 0 })], 1 / frequency).state;
    assert.equal(run(state, 2, frequency).state.status, 'won');
  }
});
