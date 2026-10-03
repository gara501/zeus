import { hasActiveShot } from './simulation.js';
const zeusImage = new URL('./sprites/zeus.png', import.meta.url).href;

export function createUI(actions, levels) {
  const root = document.createElement('div');
  root.id = 'interface';
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">ϟ</span><div><h1>ZEUS</h1><p>THE PATH OF THUNDER</p></div></div>
      <div class="current-level" aria-label="Current level"><span>LEVEL</span><strong id="current-level">01</strong></div>
      <div class="stats"><div class="ammo-stat"><span><i class="stat-icon lightning-icon" aria-hidden="true"></i>BOLTS</span><strong id="ammo" class="sr-only">3</strong><div id="ammo-pips" aria-label="3 bolts remaining"></div></div><div><span><i class="stat-icon totem-icon" aria-hidden="true"></i>TOTEMS</span><strong id="objectives">0/1</strong></div><div><span><i class="stat-icon clock-icon" aria-hidden="true"></i>TIME</span><strong id="clock">00:00</strong></div></div>
    </header>
    <section class="lesson-info"><p id="lesson-label"></p><h2 id="level-name"></h2><div id="objective-status"></div></section>
    <footer class="bottom-panel">
      <div class="guidance"><p id="hint"></p><span id="mentor"></span><div id="shot-state"></div></div>
      <div class="controls"><span><kbd>CLICK</kbd> / <kbd>SPACE</kbd> Fire</span><div><button id="home">Home</button><button id="restart">Restart <kbd>R</kbd></button><button id="pause">Pause <kbd>ESC</kbd></button><button id="sound" aria-label="Mute effects">Effects: on</button><button id="music">Music: on</button></div></div>
    </footer>
    <div id="overlay" class="overlay" hidden><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <p id="dialog-label" class="eyebrow"></p>
      <div class="dialog-portrait" role="img" aria-label="Zeus"><div class="zeus-crop"><img src="${zeusImage}" alt="" /></div></div>
      <h2 id="dialog-title"></h2><div id="stars" class="stars" hidden></div><p id="dialog-text"></p><button id="dialog-button"></button>
    </section></div>
    <div id="fade" aria-hidden="true"></div>`;
  document.body.append(root);
  const element = id => root.querySelector(`#${id}`);
  element('home').addEventListener('click', actions.home);
  element('restart').addEventListener('click', actions.restart);
  element('pause').addEventListener('click', actions.pause);
  element('sound').addEventListener('click', actions.sound);
  element('music').addEventListener('click', actions.music);
  element('dialog-button').addEventListener('click', actions.dialog);
  // UI gestures must not also enter the game input stream.
  root.addEventListener('mousedown', event => event.stopPropagation());
  root.addEventListener('click', event => event.target.closest('button')?.blur());
  root.addEventListener('keydown', event => {
    if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
  });
  let lastDialog = '';
  return {
    update({ level, index, state, mode, stars, save, fade, dragging }) {
      element('lesson-label').textContent = level.lesson;
      element('level-name').textContent = level.name;
      element('ammo').textContent = state.remaining;
      if (element('ammo-pips').childElementCount !== level.shots) {
        element('ammo-pips').innerHTML = Array.from({ length: level.shots }, () => '<span class="ammo-pip" aria-hidden="true">ϟ</span>').join('');
      }
      element('ammo-pips').setAttribute('aria-label', `${state.remaining} of ${level.shots} bolts remaining`);
      [...element('ammo-pips').children].forEach((pip, number) => pip.classList.toggle('spent', number >= state.remaining));
      element('objectives').textContent = `${state.totems.filter(totem => totem.active).length}/${state.totems.length}`;
      element('clock').textContent = `${String(Math.floor(state.time / 60)).padStart(2, '0')}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
      element('hint').textContent = dragging ? 'Rotate freely. Release the mirror when its angle is right.' : level.hint;
      element('mentor').textContent = level.mentor;
      const busy = hasActiveShot(state);
      element('ammo-pips').classList.toggle('busy', busy && mode === 'playing');
      element('shot-state').textContent = busy ? 'Bolt in flight · wait until it finishes' : state.remaining ? 'Ready to fire' : 'No bolts remaining';
      element('shot-state').classList.toggle('busy', busy);
      const timed = state.groups.find(group => group.type === 'timed' && group.deadline !== null);
      const ordered = state.groups.find(group => group.type === 'ordered' && !group.completed);
      element('objective-status').textContent = state.feedback?.until > state.time ? state.feedback.text
        : timed ? `Time remaining: ${Math.max(0, timed.deadline - state.time).toFixed(1)} s`
        : ordered ? `Next totem: ${ordered.next + 1}` : '';
      element('sound').textContent = save.muted ? 'Effects: off' : 'Effects: on';
      element('sound').setAttribute('aria-pressed', String(save.muted));
      element('sound').setAttribute('aria-label', save.muted ? 'Enable effects' : 'Mute effects');
      element('music').textContent = save.musicMuted ? 'Music: off' : 'Music: on';
      element('music').setAttribute('aria-pressed', String(save.musicMuted));
      element('music').setAttribute('aria-label', save.musicMuted ? 'Enable music' : 'Turn music off');
      element('current-level').textContent = String(index + 1).padStart(2, '0');
      element('home').disabled = !['playing', 'paused', 'lost'].includes(mode);
      const dialog = {
        paused: ['TAKE A BREATH', 'Thunder Can Wait', 'Everything is paused. Your bolts and the clock are resting, too.', 'Continue'],
        lost: ['TRY AGAIN', 'There Is More to Learn', 'Out of bolts. Try another angle; restarting restores every charge.', 'Retry'],
        victory: ['LESSON COMPLETED', 'Victory!', `${state.shots} ${state.shots === 1 ? 'bolt' : 'bolts'} · ${state.time.toFixed(1)} s`, ''],
      }[mode];
      element('overlay').hidden = !dialog;
      element('fade').style.opacity = fade;
      element('fade').style.pointerEvents = fade > 0 ? 'auto' : 'none';
      element('restart').disabled = ['victory', 'fadeOut', 'fadeIn', 'story'].includes(mode);
      element('pause').disabled = !['playing', 'paused'].includes(mode);
      element('pause').textContent = mode === 'paused' ? 'Continue · Esc' : 'Pause · Esc';
      if (dialog) {
        element('dialog-label').textContent = dialog[0];
        element('dialog-title').textContent = dialog[1];
        element('dialog-text').textContent = dialog[2];
        element('dialog-button').textContent = dialog[3];
        element('dialog-button').hidden = !dialog[3];
        element('stars').hidden = mode !== 'victory';
        element('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        if (lastDialog !== mode && dialog[3]) element('dialog-button').focus({ preventScroll: true });
      } else if (lastDialog && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      lastDialog = dialog ? mode : '';
    },
  };
}
