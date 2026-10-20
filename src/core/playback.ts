// SVGcinema — core/playback
import { $, ICON } from './constants';
import { S, doc } from './state';
import { frame } from '../render/stage';

export function updatePlayBtn() {
  const b = $('#tPlay');
  b.innerHTML = S.playing ? ICON.pause : ICON.play;
  b.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
  b.classList.toggle('on', S.playing);
}
export function togglePlay() {
  S.playing = !S.playing;
  if (S.playing) {
    if (!S.loop && S.time >= doc.dur - 0.001) S.time = 0;
    S.ptime = S.time;
    S.last = performance.now();
  }
  updatePlayBtn();
}
export function loop(now: number) {
  if (S.playing) {
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    S.ptime += dt;
    const T = doc.dur;
    if (S.loop) {
      const c = Math.floor(S.ptime / T);
      let r = S.ptime - c * T;
      if (/alternate/.test(doc.dir) && c % 2) r = T - r;
      if (/reverse/.test(doc.dir)) r = T - r;
      S.time = r;
    } else {
      if (S.ptime >= T) {
        S.ptime = T;
        S.playing = false;
        updatePlayBtn();
      }
      S.time = S.ptime;
    }
    frame();
  }
  requestAnimationFrame(loop);
}
