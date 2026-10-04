import { UNLOCK_ALL_LEVELS } from './config.js';
const KEY = 'zeus-progress-v1';
export function isLevelUnlocked(levels, save, index) {
  return Number.isInteger(index) && index >= 0 && index < levels.length
    && (UNLOCK_ALL_LEVELS || index === 0 || Boolean(save.stars[levels[index].id]) || Boolean(save.stars[levels[index - 1].id]));
}
export function nextLevelIndex(levels, save) {
  const next = levels.findIndex(level => !save.stars[level.id]);
  return next < 0 ? levels.length - 1 : next;
}
export function readSave() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return { stars: value?.stars && typeof value.stars === 'object' ? value.stars : {}, muted: value?.muted === true, musicMuted: value?.musicMuted === true };
  } catch { return { stars: {}, muted: false, musicMuted: false }; }
}
export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* Playing still works without storage. */ }
}
