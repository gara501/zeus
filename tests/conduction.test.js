import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { createState, stepSimulation, MAX_BRANCHES } from '../src/simulation.js';
import { schedulePulse } from '../src/conduction.js';
import { normalize } from '../src/ray.js';

function travel(state, seconds = 3, frequency = 60) {
  const events = [];
  for (let i = 0; i < seconds * frequency; i++) {
    const result = stepSimulation(state, [], 1 / frequency);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
const shoot = state => stepSimulation(state, [{ type: 'fire', direction: { x: 1, y: 0 } }], 1 / 60).state;

test('each new tutorial has a one-shot solution at different step sizes', () => {
  for (const level of levels.slice(3, 7)) for (const frequency of [30, 60, 120]) {
    const state = stepSimulation(createState(level), [{ type: 'fire', direction: { x: 1, y: 0 } }], 1 / frequency).state;
    const result = travel(state, 3, frequency);
    assert.equal(result.state.status, 'won', `${level.id} at ${frequency} Hz`);
    assert.equal(result.state.shots, 1);
    assert.ok(result.events.some(event => event.type === 'conduct'));
  }
});

test('direct trajectories are blocked in water and metal introductions', () => {
  for (const index of [3, 5]) {
    const state = createState(levels[index]);
    const target = state.totems[0];
    const direction = normalize({ x: target.x - state.zeus.x, y: target.y - state.zeus.y });
    const fired = stepSimulation(state, [{ type: 'fire', direction }], 1 / 60).state;
    assert.equal(travel(fired).state.totems[0].active, false);
  }
});

test('water fans out to both targets and conductor arrival times increase with distance', () => {
  const result = travel(shoot(createState(levels[4])));
  assert.equal(result.state.totems.filter(totem => totem.active).length, 2);
  const wave = result.events.filter(event => event.type === 'conduct');
  assert.equal(wave.length, 5);
  assert.ok(wave.at(-1).time > wave[0].time + .4);
  assert.ok(Object.values(result.state.branchCounts).every(count => count <= MAX_BRANCHES));
});

test('metal forks reach both outputs and retain a pending pulse after the last shot', () => {
  let state = createState(levels[6]);
  state.remaining = 1;
  state = shoot(state);
  state = travel(state, .32).state;
  assert.equal(state.remaining, 0);
  assert.equal(state.rays.length, 0);
  assert.ok(state.pulses.length > 0);
  assert.equal(state.status, 'playing');
  const result = travel(state);
  assert.equal(result.state.status, 'won');
  assert.equal(result.events.filter(event => event.type === 'totem').length, 2);
});

test('closed metal loops visit each cell once and finish instead of circulating forever', () => {
  const level = structuredClone(levels[0]);
  level.map = level.map.map(row => row.replaceAll('#', '.'));
  const rows = level.map.map(row => [...row]);
  for (const [x, y] of [[0, -.5], [1, -.5], [0, .5], [1, .5]]) rows[3.5 - y][x + 7] = '=';
  level.map = rows.map(row => row.join(''));
  let state = createState(level);
  state.remaining = 1;
  state = stepSimulation(state, [{ type: 'fire', direction: normalize({ x: 5, y: 1 }) }], 1 / 60).state;
  const result = travel(state, 8);
  assert.equal(result.events.filter(event => event.type === 'conduct').length, 4);
  assert.equal(result.state.pulses.length, 0);
  assert.equal(result.state.status, 'lost');
});

test('reentry of the same lineage is grounded; independent shots can reuse a network', () => {
  const state = createState(levels[3]);
  const cell = state.conductors[0];
  assert.equal(schedulePulse(state, cell, { id: 1, networks: [cell.network], interactions: 1 }, 0, cell), false);
  assert.equal(state.pulses.length, 0);
  assert.equal(schedulePulse(state, cell, { id: 2, networks: [], interactions: 1, direction: { x: 1, y: 0 } }, 0, cell), true);
  assert.equal(state.pulses.length, 4);
  assert.equal(schedulePulse(state, cell, { id: 3, networks: [], interactions: 1, direction: { x: 1, y: 0 } }, .1, cell), true);
  assert.equal(state.pulses.length, 8);
});

test('reset removes pending conduction and visual charge', () => {
  const initial = createState(levels[3]);
  const flowing = travel(shoot(initial), .5).state;
  assert.ok(flowing.pulses.length > 0);
  assert.ok(flowing.conductors.some(cell => cell.chargedUntil > 0));
  assert.deepEqual(createState(levels[3]), initial);
});

test('branch budget limits a wave without leaving stuck pending work', () => {
  let state = createState(levels[4]);
  state.remaining = 1;
  state = shoot(state);
  state.branchCounts[1] = MAX_BRANCHES - 2;
  const result = travel(state, 8);
  assert.equal(result.state.branchCounts[1], MAX_BRANCHES);
  assert.equal(result.state.pulses.length, 0);
  assert.equal(result.state.rays.length, 0);
  assert.equal(result.state.status, 'lost');
});
