// Keyline — io/guard
import { $ } from '../core/constants';
import { S, doc } from '../core/state';
import { saveProject } from './save';

export let discardResolve = null;
export function confirmDiscard(msg?) {
  if (!S.dirty || !doc.layers.length) return Promise.resolve(true);
  return new Promise<any>((res?) => {
    discardResolve = res;
    $('#dMsg').textContent = msg || 'This project has changes that aren’t saved to a .klp file.';
    $('#mDiscard').hidden = false;
    $('#dSave').focus();
  });
}
export function endDiscard(v?) {
  $('#mDiscard').hidden = true;
  const r = discardResolve;
  discardResolve = null;
  if (r) r(v);
}

export function init(): void {
  $('#dCancel').addEventListener('click', () => endDiscard(false));
  $('#dDiscard').addEventListener('click', () => endDiscard(true));
  $('#dSave').addEventListener('click', async () => {
    $('#mDiscard').hidden = true;
    const ok = await saveProject();
    endDiscard(!!ok);
  });
  $('#mDiscard').addEventListener(
    'click',
    (e?) => {
      if ((e.target as any).id === 'mDiscard' || (e.target as any).closest('[data-close]')) endDiscard(false);
    },
    true,
  );
}
