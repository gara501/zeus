import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { solutionPlans, runPlan } from '../scripts/level-solutions.js';

test('All 35 lessons have serial solutions at 30, 60 and 120 Hz', () => {
  assert.equal(levels.length, 35);
  for (const hz of [30, 60, 120]) for (const [index, level] of levels.entries()) {
    const { state } = runPlan(level, solutionPlans[index], hz);
    assert.equal(state.status, 'won', `${level.id} @ ${hz} Hz: ${JSON.stringify(state.totems.map(t => [t.x, t.y, t.hits]))}`);
    assert.equal(state.shots, level.idealShots, level.id);
    assert.ok(state.remaining >= 0);
  }
});

test('The bronze maze needs its three bounces and the final shot crosses all systems', () => {
  const maze = runPlan(levels[16], solutionPlans[16]);
  assert.equal(maze.events.filter(event => event.type === 'bounce').length, 3);
  const final = runPlan(levels[24], solutionPlans[24]);
  for (const type of ['burn', 'crack', 'break', 'metal', 'charge', 'discharge', 'split', 'bounce', 'victory']) {
    assert.ok(final.events.some(event => event.type === type), `Missing final mechanic: ${type}`);
  }
});

test('A late charge misses the crystal window instead of automatically solving it', () => {
  const { state } = runPlan(levels[19], [{ at: 3, fire: [-1, -.5] }]);
  assert.notEqual(state.status, 'won');
  assert.equal(state.totems.filter(t => t.active).length, 1);
});

test('The return-cloud puzzle requires changing the mirror during the wait', () => {
  const failed = runPlan(levels[21], [solutionPlans[21][0]]);
  assert.notEqual(failed.state.status, 'won');
  const success = runPlan(levels[21], solutionPlans[21]);
  assert.equal(success.state.status, 'won');
  assert.equal(success.state.shots, 1);
});

test('The cloud relay requires three entry bounces, both clouds and the return mirrors', () => {
  const level = levels[23], plan = solutionPlans[23];
  for (const hz of [30, 60, 120]) {
    const success = runPlan(level, plan, hz);
    assert.equal(success.state.status, 'won');
    const firstCharge = success.events.findIndex(event => event.type === 'charge');
    assert.equal(success.events.slice(0, firstCharge).filter(event => event.type === 'bounce').length, 3);
    assert.equal(success.events.filter(event => event.type === 'bounce').length, 5);
    assert.deepEqual(success.events.filter(event => event.type === 'discharge').map(event => event.time), [4, 6]);
    assert.equal(success.state.shots, 1);
  }
  const prepared = structuredClone(level);
  for (const mirror of prepared.mirrors.filter(mirror => mirror.rotatable)) mirror.angle = Math.PI / 4;
  for (const component of [...prepared.mirrors, ...prepared.clouds]) {
    const broken = structuredClone(prepared);
    const row = Math.round(3.5 - component.y), column = component.x + 7;
    broken.map[row] = broken.map[row].slice(0, column) + '.' + broken.map[row].slice(column + 1);
    assert.notEqual(runPlan(broken, [{ fire: [-4, -2.5] }]).state.status, 'won', `Required component at ${component.x},${component.y}`);
  }
  for (const fire of [[-4, 1.5], [1, -1.5], [5, -1.5], [1, 2.5]]) {
    assert.notEqual(runPlan(prepared, [{ fire }]).state.status, 'won', `Direct shortcut to ${fire}`);
  }
});

test('Advanced routes tolerate small aiming and mirror errors rather than requiring exact angles', () => {
  for (const index of [16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34]) for (const sign of [-1, 1]) {
    const plan = structuredClone(solutionPlans[index]);
    for (const action of plan) {
      if (action.rotate) for (const mirror of action.rotate) mirror[2] += sign * Math.PI / 360;
    }
    assert.equal(runPlan(levels[index], plan).state.status, 'won', `${levels[index].id}: half-degree tolerance`);
  }
  for (const index of [19, 20, 21]) {
    const plan = structuredClone(solutionPlans[index]);
    plan[0].at = .075;
    assert.equal(runPlan(levels[index], plan).state.status, 'won', `${levels[index].id}: five-frame timing margin`);
  }
});
