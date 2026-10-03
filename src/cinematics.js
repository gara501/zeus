import { isLevelUnlocked, nextLevelIndex } from './save.js';
export const titleImage = new URL('./sprites/transitions/title.png', import.meta.url).href;
const goatImage = new URL('./sprites/amaltea.png', import.meta.url).href;
export const intro = {
  image: new URL('./sprites/transitions/intro.png', import.meta.url).href,
  label: 'THE JOURNEY BEGINS', title: 'The Destiny of a Spark', button: 'Begin the Journey',
  text: 'I am Amalthea. I watched Zeus grow when thunder was only a spark in his hands. Now he must prepare to face his future. Guide his lightning to light every totem: mirrors, water and metal will show the way. Every bolt counts. Help him learn, and one day he will be ready to challenge the Titans.',
};
export const training = {
  image: new URL('./sprites/transitions/ready.png', import.meta.url).href,
  label: 'ADVANCED TRAINING', title: 'Now the Real Training Begins', button: 'Enter the Temple',
  text: 'My young Zeus knows the paths of lightning. But knowing them is not enough: now he must bring his lessons together. Beyond these doors await bounces, paths to open and charges to release at just the right moment. Breathe, observe and trust your wits. Now the real training begins.',
};
export const BASIC_LEVEL_COUNT = 16;
export const chapters = [
  { image: new URL('./sprites/transitions/1.png', import.meta.url).href, title: 'One Spark, Many Paths', text: 'I cared for Zeus when he was small. He once thought all he needed was the strongest bolt. But every spark taught him something new: even the power of the sky must find its path.' },
  { image: new URL('./sprites/transitions/2.png', import.meta.url).href, title: 'The Strength of Learning', text: 'In the ancient temples, Zeus learned to look before firing. Bronze could change the course of thunder; patience could change his own. Little by little, he understood that wisdom was another kind of power.' },
  { image: new URL('./sprites/transitions/3.png', import.meta.url).href, title: 'Children of the Same Sky', text: 'Zeus did not walk this path alone. With his siblings, he learned to listen to water and respect the shadows. Each had a gift. One day they would need to unite them, for beyond the mountains something ancient was awakening.' },
  { image: new URL('./sprites/transitions/4.png', import.meta.url).href, title: 'Facing the Titan', text: 'And that day came. A Titan rose before Zeus, as vast as a mountain. My little one was no longer the child who cast sparks without direction. Now he could command the thunder. His apprenticeship was over… but his true story was only beginning.' },
];
export function chapterAfter(completed, total) {
  if (completed === total) return chapters[3];
  if (completed === BASIC_LEVEL_COUNT) return training;
  return completed % 5 === 0 && completed <= 15 ? chapters[completed / 5 - 1] ?? null : null;
}
export const cinematicAssets = [titleImage, goatImage, intro.image, training.image, ...chapters.map(chapter => chapter.image)];

export function createCinematics(actions, levels) {
  const root = document.createElement('section');
  root.id = 'cinematics';
  root.innerHTML = `<img id="scene-background" alt="" />
    <div id="loading-screen" role="status"><span class="loading-bolt">ϟ</span><h1>Preparing the Thunder</h1><p id="loading-label">Loading images…</p><progress id="loading-progress" max="1" value="0"></progress><button id="loading-retry" hidden>Retry</button></div>
    <div id="title-screen" hidden><h1 class="sr-only">Zeus's Path</h1><button id="start-button">Start</button><button id="levels-button" hidden>Levels</button><button id="title-music">Music: on</button><p>The path of thunder begins with you</p></div>
    <section id="levels-screen" aria-labelledby="levels-title" hidden><div class="levels-heading"><div><p class="eyebrow">THE PATH OF THUNDER</p><h2 id="levels-title">Your Lessons</h2><p id="levels-progress"></p></div><button id="levels-back">Back to Home</button></div><div class="level-grid">${levels.map((level, index) => `<button class="level-card" data-level="${index}"><strong>${String(index + 1).padStart(2, '0')}</strong><span>${level.name}</span><small></small></button>`).join('')}</div><p class="levels-help">Complete a lesson to unlock the next.</p></section>
    <section id="story-scene" aria-labelledby="story-title" hidden><div class="narrator" role="img" aria-label="Amalthea, the goat who tells the story"><img src="${goatImage}" alt="" /></div><div class="story-copy"><p class="eyebrow">AMALTHEA · <span id="chapter-label"></span></p><h2 id="story-title"></h2><p id="story-text"></p><button id="story-next">Reveal Text</button></div></section>
    <div id="cinematic-fade" aria-hidden="true"></div>`;
  document.body.append(root);
  const el = id => root.querySelector(`#${id}`);
  let chapter = null, elapsed = 0, shown = -1, fullyRevealed = false, lastMode = '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el('start-button').addEventListener('click', actions.start);
  el('title-music').addEventListener('click', actions.music);
  el('levels-button').addEventListener('click', actions.levels);
  el('levels-back').addEventListener('click', actions.back);
  root.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => actions.selectLevel(Number(button.dataset.level))));
  el('story-next').addEventListener('click', actions.next);
  el('loading-retry').addEventListener('click', actions.retry);
  root.addEventListener('mousedown', event => event.stopPropagation());
  root.addEventListener('keydown', event => {
    if (['Space', 'Enter'].includes(event.code)) event.stopPropagation();
  });
  return {
    loading(done, total, error = false) {
      el('loading-progress').value = done / total;
      el('loading-label').textContent = error ? 'Some images could not be loaded. Retry to continue.' : `Loading images · ${Math.round(done / total * 100)} %`;
      el('loading-retry').hidden = !error;
    },
    setChapter(value, ending) {
      chapter = value; elapsed = 0; shown = -1; fullyRevealed = reduced;
      el('scene-background').src = chapter.image;
      el('story-title').textContent = chapter.title;
      el('chapter-label').textContent = chapter.label ?? (ending ? 'FINAL CHAPTER' : `CHAPTER ${chapters.indexOf(chapter) + 1}`);
      el('story-text').textContent = '';
      root.dataset.ending = String(ending);
    },
    reveal() {
      if (fullyRevealed) return false;
      fullyRevealed = true;
      return true;
    },
    update(mode, screen, fade, dt, save = { stars: {} }) {
      document.body.dataset.mode = mode;
      root.hidden = screen === null;
      root.dataset.screen = screen ?? '';
      el('loading-screen').hidden = mode !== 'loading';
      el('title-screen').hidden = screen !== 'title';
      el('levels-screen').hidden = screen !== 'levels';
      el('story-scene').hidden = screen !== 'story';
      el('scene-background').hidden = mode === 'loading';
      if (['title', 'levels'].includes(screen) && el('scene-background').getAttribute('src') !== titleImage) el('scene-background').src = titleImage;
      const completed = levels.filter(level => save.stars[level.id]).length;
      el('levels-button').hidden = completed === 0;
      el('levels-button').disabled = mode !== 'title';
      el('start-button').textContent = completed ? 'Continue' : 'Start';
      el('levels-back').disabled = mode !== 'levels';
      el('levels-progress').textContent = `${completed} of ${levels.length} lessons completed`;
      if (screen === 'levels') root.querySelectorAll('[data-level]').forEach(button => {
        const number = Number(button.dataset.level), earned = save.stars[levels[number].id] || 0;
        const unlocked = isLevelUnlocked(levels, save, number);
        button.disabled = mode !== 'levels' || !unlocked;
        button.classList.toggle('completed', Boolean(earned));
        button.classList.toggle('locked', !unlocked);
        button.classList.toggle('selected', number === nextLevelIndex(levels, save));
        button.querySelector('small').textContent = earned ? '★'.repeat(earned) + '☆'.repeat(3 - earned) : unlocked ? 'Available' : 'Locked';
        button.setAttribute('aria-label', `Level ${number + 1}: ${levels[number].name}. ${earned ? `Completed, ${earned} stars` : unlocked ? 'Available' : 'Locked'}`);
      });
      el('start-button').disabled = mode !== 'title';
      el('title-music').textContent = save.musicMuted ? 'Music: off' : 'Music: on';
      el('title-music').setAttribute('aria-pressed', String(save.musicMuted));
      el('title-music').setAttribute('aria-label', save.musicMuted ? 'Enable music' : 'Turn music off');
      el('title-music').disabled = mode !== 'title';
      el('story-next').disabled = mode !== 'story';
      if (screen === 'story' && chapter) {
        if (mode === 'story' && !document.hidden) elapsed += dt;
        const count = fullyRevealed ? Array.from(chapter.text).length : Math.floor(elapsed * 34);
        const characters = Array.from(chapter.text);
        if (count >= characters.length) fullyRevealed = true;
        if (count !== shown) { el('story-text').textContent = characters.slice(0, count).join(''); shown = count; }
        el('story-text').classList.toggle('typing', !fullyRevealed);
        el('story-next').textContent = fullyRevealed ? chapter.button ?? (root.dataset.ending === 'true' ? 'Back to Title' : 'Continue') : 'Reveal Text';
      }
      el('cinematic-fade').style.opacity = fade;
      el('cinematic-fade').style.pointerEvents = fade > 0 ? 'auto' : 'none';
      if (mode !== lastMode && ['title', 'story', 'levels'].includes(mode)) el(mode === 'title' ? 'start-button' : mode === 'levels' ? 'levels-back' : 'story-next').focus({ preventScroll: true });
      lastMode = mode;
    },
  };
}

export async function preloadImages(urls, progress) {
  let done = 0;
  const results = await Promise.allSettled(urls.map(url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try { await image.decode(); resolve(); } catch (error) { reject(error); }
      finally { progress(++done, urls.length); }
    };
    image.onerror = () => { progress(++done, urls.length); reject(new Error('Image load failed')); };
    image.src = url;
  })));
  if (results.some(result => result.status === 'rejected')) throw new Error('Asset loading failed');
}
