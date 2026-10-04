import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { createState, stepSimulation, hasActiveShot } from '../src/simulation.js';
import { runPlan, solutionPlans } from '../scripts/level-solutions.js';
const fire = [{ type: 'fire', direction: { x: 1, y: 0 } }];
function travel(state, seconds) {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) {
    const result = stepSimulation(state, [], 1 / 60);
    state = result.state; events.push(...result.events);
  }
  return { state, events };
}
const shoot = state => stepSimulation(state, fire, 1 / 60).state;

test('Wood consumes the ray, opens a permanent path and immediately permits another shot', () => {
  const initial = createState(levels[7]);
  const burned = travel(shoot(initial), .45).state;
  assert.equal(burned.breakables[0].destroyed, true);
  assert.equal(burned.delayed.length, 0);
  assert.equal(hasActiveShot(burned), false);
  assert.equal(burned.totems[0].active, false);
  assert.ok(burned.breakables[0].burnUntil > burned.time, 'Burn animation does not retain the ray');
  const second = travel(shoot(burned), 1);
  assert.equal(second.state.status, 'won');
  assert.equal(second.state.shots, 2);
  assert.equal(initial.breakables[0].destroyed, false);
});

test('The block cracks on the first impact, breaks on the second, and consumes both rays', () => {
  let state = createState(levels[8]);
  state = travel(shoot(state), .5).state;
  assert.equal(state.breakables[0].hits, 1);
  assert.equal(state.breakables[0].destroyed, false);
  const second = travel(shoot(state), .5);
  state = second.state;
  assert.equal(state.breakables[0].destroyed, true);
  assert.equal(state.breakables[0].hits, 2);
  assert.equal(state.totems[0].active, false);
  assert.equal(second.events.filter(event => event.type === 'break').length, 1);
  assert.equal(travel(shoot(state), 1).state.status, 'won');
});

test('Two simultaneous branches count as two independent block impacts', () => {
  const state = createState(levels[8]);
  state.rays = [1, 2].map(id => ({ id, shotId: 1, position: { x: -1, y: -.5 }, direction: { x: 1, y: 0 }, speed: 12, age: 0, interactions: 0, networks: [] }));
  state.nextId = 3;
  const result = stepSimulation(state, [], .1);
  assert.equal(result.state.breakables[0].hits, 2);
  assert.equal(result.state.breakables[0].destroyed, true);
  assert.equal(result.events.filter(event => event.type === 'crack').length, 1);
  assert.equal(result.events.filter(event => event.type === 'break').length, 1);
});

test('Wood plus stone needs four shots and resets without preserving damage', () => {
  const { state } = runPlan(levels[9], solutionPlans[9]);
  assert.equal(state.status, 'won');
  assert.equal(state.shots, 4);
  const fresh = createState(levels[9]);
  assert.ok(fresh.breakables.every(item => !item.destroyed && item.hits === 0));
  assert.equal(fresh.shots, 0);
});

test('Burning a box keeps the level playable without a fictitious pending release', () => {
  const initial = createState(levels[7]);
  const fired = shoot(initial);
  assert.equal(fired.status, 'playing');
  const { state } = travel(fired, .5);
  assert.equal(state.status, 'playing');
  assert.equal(state.breakables[0].destroyed, true);
  assert.equal(state.delayed.length, 0);
});
