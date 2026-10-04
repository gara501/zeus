import test from 'node:test';
import assert from 'node:assert/strict';
import { dialoguePage } from '../src/dialogue.js';
import { intro, training, chapters, spiritTraining, finalTrial } from '../src/cinematics.js';

test('Two-line fragments preserve every word of every scene at narrow and wide sizes', () => {
  for (const scene of [intro, training, spiritTraining, finalTrial, ...chapters]) {
    for (const width of [24, 70, 120]) {
      const words = scene.text.split(/\s+/), pages = [];
      let start = 0;
      while (start < words.length) {
        const page = dialoguePage(words, start, width, text => text.length);
        assert.ok(page.end > start);
        let lines = 1, length = 0;
        for (const word of page.text.split(' ')) {
          if (length && length + 1 + word.length > width) { lines++; length = 0; }
          length += (length ? 1 : 0) + word.length;
        }
        assert.ok(lines <= 2);
        pages.push(page.text);
        start = page.end;
      }
      assert.equal(pages.join(' '), scene.text);
    }
  }
});
