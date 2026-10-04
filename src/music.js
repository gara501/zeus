import { BASIC_LEVEL_COUNT } from './cinematics.js';

export const MUSIC_VOLUME = .06;
export const DUCK_VOLUME = .008;
const tracks = [new URL('./music/1.mp3', import.meta.url).href, new URL('./music/2.mp3', import.meta.url).href];

export function createMusic() {
  const players = tracks.map((url, index) => {
    const audio = new Audio(url);
    audio.id = `music-${index + 1}`;
    audio.hidden = true;
    audio.loop = true;
    audio.preload = 'metadata';
    audio.volume = 0;
    document.body.append(audio);
    return audio;
  });
  let selected = -1, unlocked = false, pending = false, blocked = false, duckTime = 0;
  const unlock = () => { unlocked = true; blocked = false; };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) players.forEach(audio => { audio.pause(); audio.volume = 0; });
  });
  return {
    duck(events, effectsMuted) {
      if (!effectsMuted && events.length) {
        duckTime = Math.max(duckTime, .7);
        if (selected >= 0) players[selected].volume = Math.min(players[selected].volume, DUCK_VOLUME);
      }
    },
    update(index, mode, screen, muted, dt) {
      const next = index < BASIC_LEVEL_COUNT ? 0 : 1;
      if (selected !== next) {
        players.forEach(audio => { audio.pause(); audio.volume = 0; });
        selected = next;
        blocked = false;
      }
      const audio = players[selected];
      duckTime = Math.max(0, duckTime - dt);
      const active = unlocked && !muted && !document.hidden && screen === null
        && ['playing', 'victory', 'lost', 'fadeIn', 'fadeOut'].includes(mode);
      if (!active) { audio.pause(); audio.volume = 0; return; }
      if (audio.paused && !pending && !blocked) {
        pending = true;
        audio.play().catch(error => {
          if (error.name !== 'AbortError') blocked = true;
        }).finally(() => { pending = false; });
      }
      const target = duckTime > 0 ? DUCK_VOLUME : MUSIC_VOLUME;
      // Fast attenuation leaves impacts clear; a slower return avoids abrupt jumps.
      const duration = target < audio.volume ? .04 : .6;
      audio.volume += (target - audio.volume) * (1 - Math.exp(-dt / duration));
    },
  };
}
