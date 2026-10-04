import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { createState, stepSimulation, hasActiveShot } from '../src/simulation.js';
import { hitTotem, expireGroups } from '../src/totems.js';
import { normalize } from '../src/ray.js';

function travel(state, seconds) {
  for (let i = 0; i < seconds * 60; i++) state = stepSimulation(state, [], 1 / 60).state;
  return state;
}
function shoot(state, target) {
  return stepSimulation(state, [{ type: 'fire', direction: normalize({ x: target.x - state.zeus.x, y: target.y - state.zeus.y }) }], 1 / 60).state;
}
const hit = (state, index, time) => hitTotem(state, state.totems[index], time, []);

test('all levels allocate three to six shots, reserving six for the final trial', () => {
  for (const [index, level] of levels.entries()) assert.ok(level.shots >= 3 && level.shots <= (index === 34 ? 6 : 5));
});

test('a short shot unlocks firing immediately after impact without an extra cooldown', () => {
  let state = createState(levels[0]);
  const command = { type: 'fire', direction: { x: -1, y: 0 } };
  state = stepSimulation(state, [command], 1 / 60).state;
  state = travel(state, .12);
  assert.equal(hasActiveShot(state), false);
  assert.equal(state.time < .18, true);
  const result = stepSimulation(state, [command], 1 / 60);
  assert.equal(result.state.remaining, 1);
  assert.equal(result.events.some(event => event.type === 'fire'), true);
});

test('multi-hit lesson requires three separate arrivals and reset clears partial charge', () => {
  let state = createState(levels[13]);
  const initial = structuredClone(state);
  for (let count = 1; count <= 3; count++) {
    state = travel(shoot(state, state.totems[0]), 1);
    assert.equal(state.totems[0].hits, count);
    assert.equal(state.totems[0].active, count === 3);
  }
  assert.equal(state.status, 'won');
  assert.equal(state.remaining, 1);
  assert.deepEqual(createState(levels[13]), initial);
});

test('two sibling arrivals each count toward a multi-hit target', () => {
  const state = createState(levels[13]);
  state.rays = [1, 2].map(id => ({ id, shotId: 1, position: { x: 2, y: -.5 }, direction: { x: 1, y: 0 }, speed: 12, age: 0, interactions: 0, networks: [] }));
  const result = stepSimulation(state, [], .1);
  assert.equal(result.state.totems[0].hits, 2);
  assert.equal(result.events.filter(event => event.type === 'totem').length, 2);
});

test('ordered group rejects wrong order, resets all members and ignores already active members', () => {
  const state = createState(levels[14]);
  const members = state.groups[0].members.map(id => state.totems.find(item => item.id === id));
  hitTotem(state, members[0], 0, []);
  hitTotem(state, members[0], .1, []);
  assert.equal(state.groups[0].next, 1);
  const events = [];
  hitTotem(state, members[2], .2, events);
  assert.equal(events[0].type, 'wrongOrder');
  assert.ok(members.every(item => !item.active && item.hits === 0));
  for (let i = 0; i < 3; i++) hitTotem(state, members[i], 1 + i, []);
  assert.equal(state.groups[0].completed, true);
});

test('ordered lesson has a serial three-shot solution', () => {
  let state = createState(levels[14]);
  for (const id of state.groups[0].members) state = travel(shoot(state, state.totems.find(item => item.id === id)), 1);
  assert.equal(state.status, 'won');
  assert.equal(state.shots, 3);
});

test('timed expiration resets the entire group including partial multi-hit progress', () => {
  const state = createState(levels[15]);
  state.totems[1].requiredHits = 2;
  hit(state, 0, 1);
  hit(state, 1, 2);
  expireGroups(state, 4.01, []);
  assert.ok(state.totems.every(item => !item.active && item.hits === 0));
  assert.equal(state.groups[0].deadline, null);
});

test('exact deadline is accepted and completed group stays active', () => {
  const state = createState(levels[15]);
  hit(state, 0, 1);
  hit(state, 1, 4);
  expireGroups(state, 20, []);
  assert.ok(state.totems.every(item => item.active));
  assert.equal(state.groups[0].completed, true);
});

test('late arrival expires old group and starts a new window', () => {
  const state = createState(levels[15]);
  hit(state, 0, 1);
  hit(state, 1, 4.1);
  assert.equal(state.totems[0].active, false);
  assert.equal(state.totems[1].active, true);
  assert.equal(state.groups[0].deadline, 7.1);
});

test('timed lesson can be solved by two serial shots within its window', () => {
  let state = createState(levels[15]);
  state = travel(shoot(state, state.totems[0]), .6);
  state = travel(shoot(state, state.totems[1]), .6);
  assert.equal(state.status, 'won');
  assert.equal(state.shots, 2);
});

test('shooting is locked during conduction and cloud storage', () => {
  for (const [index, direction, seconds] of [[3, { x: 1, y: 0 }, .4], [11, { x: 1, y: 0 }, .5]]) {
    let state = createState(levels[index]);
    state = stepSimulation(state, [{ type: 'fire', direction }], 1 / 60).state;
    state = travel(state, seconds);
    assert.ok(hasActiveShot(state));
    const remaining = state.remaining;
    const result = stepSimulation(state, [{ type: 'fire', direction }], 1 / 60);
    assert.equal(result.state.remaining, remaining);
    assert.equal(result.events.some(event => event.type === 'fire'), false);
  }
});

test('last surviving sibling blocks another shot until it disappears', () => {
  let state = createState(levels[0]);
  state.rays = [1, 2].map((id, i) => ({ id, shotId: 1, position: { x: i ? -5 : 5, y: -.5 }, direction: { x: 1, y: 0 }, speed: 12, age: 0, interactions: 0, networks: [] }));
  state.nextId = 3;
  state = travel(state, .2);
  assert.equal(state.rays.length, 1);
  assert.equal(stepSimulation(state, [{ type: 'fire', direction: { x: 1, y: 0 } }], 1 / 60).state.remaining, 3);
  state = travel(state, 1);
  assert.equal(hasActiveShot(state), false);
  assert.equal(stepSimulation(state, [{ type: 'fire', direction: { x: 1, y: 0 } }], 1 / 60).state.remaining, 2);
});
