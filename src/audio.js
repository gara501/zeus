import { Sound } from 'littlejsengine';
const sounds = {
  fire: new Sound([.25, .03, 160, .005, .04, .12, 4, 1.5, -10]),
  bounce: new Sound([.2, .01, 900, .005, .025, .12, 1, 1.5, 8]),
  water: new Sound([.12, .04, 280, .01, .05, .15, 4, 1, 8]),
  metal: new Sound([.15, .01, 640, .005, .02, .15, 1, 1, 4]),
  burn: new Sound([.14, .08, 130, .01, .08, .25, 4, 1, -5]),
  break: new Sound([.2, .05, 70, .005, .04, .2, 4, 1, -8]),
  crack: new Sound([.12, .02, 120, .005, .025, .12, 4, 1, -3]),
  split: new Sound([.16, .01, 980, .005, .03, .22, 1, 1, 10]),
  charge: new Sound([.16, .02, 180, .03, .12, .3, 0, 1, 5]),
  discharge: new Sound([.2, .01, 360, .005, .06, .18, 4, 1, 8]),
  absorb: new Sound([.12, .03, 70, .01, .03, .12, 4, 1, -5]),
  attract: new Sound([.13, .01, 300, .02, .08, .15, 0, 1, 7]),
  redirect: new Sound([.17, .01, 700, .005, .04, .16, 1, 1, 5]),
  monsterBlock: new Sound([.18, .02, 65, .005, .06, .18, 4, 1, -4]),
  monsterBreak: new Sound([.22, .04, 85, .01, .12, .35, 4, 1, -7]),
  wall: new Sound([.1, .04, 90, .005, .01, .09, 4]),
  totem: new Sound([.2, 0, 520, .01, .09, .25, 0, 1, 6]),
  wrongOrder: new Sound([.16, .01, 180, .01, .06, .2, 1, 1, -6]),
  timeout: new Sound([.14, .01, 260, .02, .1, .25, 0, 1, -8]),
  victory: new Sound([.25, 0, 440, .02, .2, .5, 0, 1, 2, 0, 0, 0, 0, .1]),
};
export function playEvents(events, muted) {
  if (muted) return;
  for (const event of events) sounds[event.type]?.play();
}
