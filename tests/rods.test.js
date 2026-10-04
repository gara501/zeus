import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { createState, stepSimulation, hasActiveShot } from '../src/simulation.js';
import { nearestHit } from '../src/ray.js';
import { schedulePulse } from '../src/conduction.js';
import { runPlan, solutionPlans } from '../scripts/level-solutions.js';

function travel(state, hz = 60, direction = { x: 1, y: 0 }) {
  let result = stepSimulation(state, [{ type: 'fire', direction }], 1 / hz);
  const events = [...result.events];
  for (let i = 0; i < 4 * hz && hasActiveShot(result.state); i++) {
    result = stepSimulation(result.state, [], 1 / hz);
    events.push(...result.events);
  }
  return { state: result.state, events };
}

test('a near miss is pulled into the rod and redirected at consistent times across frame rates', () => {
  const arrivals = [];
  for (const hz of [30, 60, 120]) {
    const initial = createState(levels[8]);
    assert.equal(initial.zeus.y, initial.rods[0].y - 1);
    const result = travel(initial, hz);
    assert.equal(result.state.status, 'won');
    assert.equal(result.state.shots, 1);
    assert.equal(result.events.filter(e => e.type === 'attract').length, 1);
    assert.equal(result.events.filter(e => e.type === 'redirect').length, 1);
    arrivals.push(result.events.find(e => e.type === 'redirect').time);
    assert.equal(initial.rods[0].chargedUntil, 0);
  }
  assert.ok(Math.max(...arrivals) - Math.min(...arrivals) < 1e-6);
});

test('a rod ignores bolts outside the field and cannot attract through walls or crates', () => {
  const rod = { id: 'rod', type: 'lightningRod', x: 0, y: 0, radius: 1.2, direction: { x: 1, y: 0 } };
  const state = { walls: [], mirrors: [], totems: [], rods: [rod] };
  assert.equal(nearestHit(state, { x: -2, y: 1.21 }, { x: 1, y: 0 }), null);
  for (const type of ['wall', 'wood']) {
    const obstruction = { x: -.55, y: 0, type, destroyed: false };
    state.walls = type === 'wall' ? [obstruction] : [];
    state.breakables = type === 'wood' ? [obstruction] : [];
    assert.equal(nearestHit(state, { x: -1.15, y: 0 }, { x: 0, y: 1 }, .1), null);
    if (type === 'wood') {
      obstruction.destroyed = true;
      assert.equal(nearestHit(state, { x: -1.15, y: 0 }, { x: 0, y: 1 }, .1).entity.id, rod.id);
    }
  }
});

test('a bolt already inside the field redirects immediately, and a later shot can reuse the rod', () => {
  const state = createState(levels[8]);
  state.zeus = { x: -.5, y: .5 };
  state.totems[0].requiredHits = 2;
  const result = travel(state);
  assert.equal(result.events.find(e => e.type === 'attract').time, 0);
  assert.equal(result.state.status, 'playing');
  const repeated = travel(result.state);
  assert.equal(repeated.state.status, 'won');
  assert.equal(repeated.state.shots, 2);
  assert.equal(repeated.events.filter(e => e.type === 'redirect').length, 1);
});

test('two facing rods cannot trap one branch in a recapture loop', () => {
  const state = createState(levels[8]);
  state.rods.push({ ...state.rods[0], id: 'second', x: 2, radius: .8, direction: { x: -1, y: 0 } });
  const result = travel(state);
  assert.equal(result.events.filter(e => e.type === 'redirect').length, 2);
  assert.equal(hasActiveShot(result.state), false);
  assert.equal(result.state.status, 'playing');
});

test('conduction preserves visited rods for every outgoing branch', () => {
  const state = createState(levels[3]);
  schedulePulse(state, state.conductors[0], { id: 1, shotId: 1, networks: [], rodVisits: ['rod'], interactions: 2, direction: { x: 1, y: 0 } }, 0, state.conductors[0]);
  assert.ok(state.pulses.every(pulse => pulse.rodVisits.includes('rod')));
});

test('campaign replaces repeated block impacts with rods and rejects invalid rod fields', () => {
  assert.deepEqual(levels.map((level, index) => [index + 1, createState(level).rods.length]).filter(([, count]) => count).map(([number]) => number), [9, 10, 25, 28, 30, 35]);
  assert.ok(levels.every(level => createState(level).breakables.every(item => item.type === 'wood')));
  assert.throws(() => createState({ ...levels[8], rods: [{ x: 0, y: .5, radius: 0 }] }), /Invalid lightning rod/);
});

test('rod routes require attraction rather than adding a decorative object to an existing straight path', () => {
  for (const index of [8, 9, 24, 27, 29, 34]) {
    const level = structuredClone(levels[index]);
    level.map = level.map.map(row => row.replaceAll('A', '.'));
    assert.notEqual(runPlan(level, solutionPlans[index]).state.status, 'won', levels[index].id);
  }
});
