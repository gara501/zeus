import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/levels.js';
import { solutionPlans, runPlan } from '../scripts/level-solutions.js';

test('All 25 lessons have serial solutions at 30, 60 and 120 Hz', () => {
  assert.equal(levels.length, 25);
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

test('The short route fails early but wins when the cloud is about to discharge', () => {
  const failed = runPlan(levels[23], [{ fire: [-4, 2.5] }, { fire: [-1, -1.5] }]);
  assert.notEqual(failed.state.status, 'won');
  assert.ok(failed.events.some(event => event.type === 'timeout'));
  const success = runPlan(levels[23], [{ at: 3.1, fire: [-4, 2.5] }, { fire: [-1, -1.5] }]);
  assert.equal(success.state.status, 'won');
});

test('Advanced routes tolerate small aiming and mirror errors rather than requiring exact angles', () => {
  for (const index of [16, 17, 21, 22, 24]) for (const sign of [-1, 1]) {
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
