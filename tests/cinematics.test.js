import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterAfter, chapters, intro, training, cinematicAssets } from '../src/cinematics.js';

test('The story follows checkpoints five, ten and fifteen', () => {
  for (let completed = 1; completed < 25; completed++) {
    assert.equal(chapterAfter(completed, 25), completed === 16 ? training : completed % 5 === 0 && completed <= 15 ? chapters[completed / 5 - 1] : null);
  }
});

test('The introduction and advanced training images are preloaded', () => {
  assert.ok(cinematicAssets.includes(intro.image));
  assert.ok(cinematicAssets.includes(training.image));
  assert.equal(chapterAfter(16, 25), training);
  assert.equal(chapterAfter(17, 25), null);
});
test('The Titan scene closes the campaign, including a final checkpoint', () => {
  assert.equal(chapterAfter(16, 16), chapters[3]);
  assert.equal(chapterAfter(25, 25), chapters[3]);
  assert.equal(chapterAfter(15, 15), chapters[3]);
  assert.equal(chapterAfter(20, 25), null);
});
