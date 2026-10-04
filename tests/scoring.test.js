import test from 'node:test';
import assert from 'node:assert/strict';
import { earnedStars } from '../src/scoring.js';

test('completion always earns a star, with efficiency and time rewarding mastery', () => {
  const level = { idealShots: 2, threeStarTime: 30 };
  assert.equal(earnedStars(level, { shots: 100, time: 10 }), 1);
  assert.equal(earnedStars(level, { shots: 2, time: 31 }), 2);
  assert.equal(earnedStars(level, { shots: 2, time: 30 }), 3);
  assert.equal(earnedStars(level, { shots: 1, time: 10 }), 3);
});
