// Keyline — model/sample
import { FONTS, NOFILL, clone } from '../core/constants';
import { blankDoc, mkLayer, setIdc } from '../core/state';
import { N, radial, starNodes } from '../geometry/nodes';

export function sampleDoc(): any {
  setIdc(0);
  const d = blankDoc(640, 400);
  d.name = 'Sunrise badge';
  d.bg = '#14213D';
  d.dur = 3;
  d.it = 0;
  const sunG = mkLayer('group', 'Sunrise', {}, NOFILL);
  const rays = mkLayer('path', 'Rays', {}, { fill: '#FFD27A', op: 0.9, d: starNodes(170, 215, 96, 62, 12) });
  rays.parent = sunG.id;
  rays.t.rot = [
    [0, 0, 'linear'],
    [3, 60, 'linear'],
  ];
  rays.t.scl = [
    [0, [0.35, 0.35], 'outBack'],
    [1.2, [1, 1], 'ease'],
  ];
  rays.t.op = [
    [0, 0, 'outQuad'],
    [0.7, 0.9, 'ease'],
  ];
  const sun = mkLayer('ellipse', 'Sun', { cx: 170, cy: 215, rx: 54, ry: 54 }, { fill: '#FF7A59' });
  sun.parent = sunG.id;
  sun.t.fill = [
    [0, '#FF5F6D', 'inOutSine'],
    [1.6, '#FFC24B', 'ease'],
  ];
  sunG.t.pos = [
    [0, [0, 150], 'outBack'],
    [1.2, [0, 0], 'ease'],
  ];
  const circle = radial(470, 175, [52, 52, 52, 52], [28.7, 28.7, 28.7, 28.7]),
    leaf = radial(470, 175, [72, 40, 72, 40], [8, 44, 8, 44]),
    petal = radial(470, 175, [44, 66, 44, 66], [48, 10, 48, 10]);
  const blob = mkLayer('path', 'Blob', {}, { fill: '#6C8CFF', d: clone(circle) });
  blob.t.d = [
    [0, clone(circle), 'inOutBack'],
    [1.1, leaf, [0.7, 0, 0.2, 1.4]],
    [2.1, petal, 'inOutCubic'],
    [3, clone(circle), 'ease'],
  ];
  blob.t.fill = [
    [0, '#6C8CFF', 'inOut'],
    [1.5, '#C77DFF', 'inOut'],
    [3, '#6C8CFF', 'ease'],
  ];
  blob.t.rot = [
    [0, 0, 'inOutQuart'],
    [3, 180, 'ease'],
  ];
  const comet = mkLayer(
    'path',
    'Comet',
    {},
    { fill: '#F3EEE4', d: [{ c: true, n: [N(-10, -6), N(12, 0), N(-10, 6)] }] },
  );
  comet.o = [0, 0];
  comet.sm = true;
  comet.or = true;
  comet.t.pos = [
    [0, [50, 130], 'linear'],
    [1, [230, 52], 'linear'],
    [2, [420, 58], 'linear'],
    [3, [600, 140], 'linear'],
  ];
  comet.t.op = [
    [0, 0, 'linear'],
    [0.4, 1, 'linear'],
    [2.6, 1, 'linear'],
    [3, 0, 'ease'],
  ];
  const land = mkLayer('group', 'Landscape', {}, NOFILL);
  const ground = mkLayer('rect', 'Ground', { x: 0, y: 296, w: 640, h: 104, rx: 0 }, { fill: '#14213D' });
  ground.parent = land.id;
  const wave = mkLayer(
    'path',
    'Horizon',
    {},
    {
      fill: 'none',
      stk: '#7FD4C1',
      sw: 6,
      d: [
        {
          c: false,
          n: [
            [30, 300, 30, 300, 76, 300],
            [175, 288, 129, 288, 221, 288],
            [320, 304, 274, 304, 366, 304],
            [465, 288, 419, 288, 511, 288],
            [610, 300, 564, 300, 610, 300],
          ],
        },
      ],
    },
  );
  wave.parent = land.id;
  wave.extra = { 'stroke-linecap': 'round' };
  wave.t.te = [
    [0.2, 0, 'inOutCubic'],
    [1.8, 100, 'ease'],
  ];
  const title = mkLayer(
    'text',
    'Title',
    { x: 320, y: 362, text: 'Good morning', size: 40, family: FONTS[1][0], weight: '700', anchor: 'middle' },
    { fill: '#F3EEE4' },
  );
  title.t.op = [
    [1, 0, 'outQuad'],
    [1.8, 1, 'ease'],
  ];
  title.t.pos = [
    [1, [0, 26], 'outBack'],
    [1.8, [0, 0], 'ease'],
  ];
  d.layers = [sunG, rays, sun, blob, comet, land, ground, wave, title];
  return d;
}
