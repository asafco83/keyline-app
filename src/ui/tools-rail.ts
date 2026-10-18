// Keyline — ui/tools-rail
import { $, ICON, TOOLS } from '../core/constants';
import { setTool } from '../core/history';
import { S } from '../core/state';

export function renderTools() {
  $('#tools').innerHTML = TOOLS.map(t =>
    t
      ? `<button class="tool${S.tool === t[0] ? ' on' : ''}" data-tool="${t[0]}" title="${t[1]} (${t[2]})" aria-label="${t[1]}" aria-pressed="${S.tool === t[0]}">${ICON[t[0]]}<kbd>${t[2]}</kbd></button>`
      : '<span class="sep"></span>',
  ).join('');
}

export function init(): void {
  $('#tools').addEventListener('click', e => {
    const b = (e.target as any).closest('[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
}
