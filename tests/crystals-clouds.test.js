import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { createState, stepSimulation, MAX_BRANCHES } from '../src/simulation.js';
import { normalize } from '../src/ray.js';
import { crystalAngle } from '../src/elements.js';

const fire = direction => [{ type: 'fire', direction }];
function travel(state, seconds, hz = 60) {
  const events = [];
  for (let i = 0; i < seconds * hz; i++) {
    const result = stepSimulation(state, [], 1 / hz);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
const shoot = (state, direction = { x: 1, y: 0 }) => stepSimulation(state, fire(direction), 1 / 60).state;

test('crystal divides a single shot and hits both targets at the right time', () => {
  for (const hz of [30, 60, 120]) {
    const state = stepSimulation(createState(levels[10]), fire({ x: 1, y: 0 }), 1 / hz).state;
    const result = travel(state, 2, hz);
    assert.equal(result.state.status, 'won');
    assert.equal(result.state.shots, 1);
    assert.equal(result.state.branchCounts[1], 2);
    const split = result.events.find(event => event.type === 'split');
    assert.ok(Math.abs(split.angle - Math.PI / 4) < 1e-5);
    assert.ok(Math.abs(split.angle - crystalAngle(state.crystals[0], split.time)) < 1e-10);
  }
});

test('wrong crystal timing misses the side target; its straight branch still works', () => {
  const late = travel(createState(levels[10]), 2).state;
  const result = travel(shoot(late), 3);
  assert.equal(result.state.status, 'playing');
  assert.equal(result.state.totems.filter(item => item.active).length, 1);
});

test('crystal obeys the branch budget and reset restores its initial phase', () => {
  const initial = createState(levels[10]);
  const fired = shoot(initial);
  fired.branchCounts[1] = MAX_BRANCHES;
  const result = travel(fired, 2);
  assert.equal(result.state.branchCounts[1], MAX_BRANCHES);
  assert.equal(result.state.totems.filter(item => item.active).length, 1);
  assert.deepEqual(createState(levels[10]), initial);
});

test('charge cloud holds the last ray and releases it at its exact configured time', () => {
  const initial = createState(levels[11]);
  initial.remaining = 1;
  const charged = travel(shoot(initial), .5).state;
  assert.equal(charged.rays.length, 0);
  assert.equal(charged.delayed.length, 1);
  assert.equal(charged.status, 'playing');
  const releaseAt = charged.clouds[0].releaseAt;
  assert.ok(Math.abs(releaseAt - (4.52 / 12 + 1.4)) < 1e-6);
  const result = travel(charged, 3);
  assert.equal(result.state.status, 'won');
  assert.equal(result.events.find(event => event.type === 'discharge').time, releaseAt);
  assert.equal(result.state.clouds[0].storedRayId, null);
});

test('a full cloud absorbs extra impacts without overwriting or postponing its charge', () => {
  let state = travel(shoot(createState(levels[11])), .5).state;
  const releaseAt = state.clouds[0].releaseAt;
  const storedRayId = state.clouds[0].storedRayId;
  state.rays.push({ id: state.nextId++, shotId: 1, position: { ...state.zeus }, direction: { x: 1, y: 0 }, speed: 12, age: 0, interactions: 0, networks: [] });
  const result = travel(state, .5);
  assert.equal(result.state.clouds[0].releaseAt, releaseAt);
  assert.equal(result.state.clouds[0].storedRayId, storedRayId);
  assert.equal(result.state.delayed.length, 1);
  assert.equal(result.events.filter(event => event.type === 'absorb').length, 1);
});

test('trap clouds absorb; the charge cloud route solves the lesson with one shot', () => {
  const failed = travel(shoot(createState(levels[12])), 2);
  assert.equal(failed.state.totems[0].active, false);
  assert.equal(failed.events.filter(event => event.type === 'absorb').length, 1);
  for (const hz of [30, 60, 120]) {
    const state = stepSimulation(createState(levels[12]), fire(normalize({ x: 3, y: 2 })), 1 / hz).state;
    assert.equal(travel(state, 3, hz).state.status, 'won');
  }
});

test('reset removes cloud charge and its pending release', () => {
  const initial = createState(levels[11]);
  const charged = travel(shoot(initial), .5).state;
  assert.notEqual(charged.clouds[0].storedRayId, null);
  assert.equal(initial.clouds[0].storedRayId, null);
  assert.deepEqual(createState(levels[11]), initial);
});

test('a trap absorbs only its own branch while another ray can charge a cloud and win', () => {
  const state = createState(levels[12]);
  state.rays = [
    { id: 1, shotId: 1, position: { ...state.zeus }, direction: { x: 1, y: 0 }, speed: 12, age: 0, interactions: 0, networks: [] },
    { id: 2, shotId: 2, position: { ...state.zeus }, direction: normalize({ x: 3, y: 2 }), speed: 12, age: 0, interactions: 0, networks: [] },
  ];
  state.nextId = 3;
  const result = travel(state, 3);
  assert.equal(result.events.filter(event => event.type === 'absorb').length, 1);
  assert.equal(result.events.filter(event => event.type === 'charge').length, 1);
  assert.equal(result.state.status, 'won');
});
