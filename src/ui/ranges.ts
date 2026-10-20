// SVGcinema — ui/ranges
// Sliders (<input type="range">) draw their filled part from a CSS variable, --p, the thumb's
// position as a percentage. Native sliders can't style the filled part in every browser, so this
// keeps --p in step with the value: on user input, when code sets `.value`, and when a panel
// re-render adds new sliders.

function paint(el: HTMLInputElement) {
  const min = parseFloat(el.min) || 0,
    max = el.max === '' ? 100 : parseFloat(el.max),
    v = parseFloat(el.value),
    p = max > min && isFinite(v) ? ((v - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--p', Math.max(0, Math.min(100, p)) + '%');
}
function paintAll(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paint);
}

export function init() {
  // code that sets a slider's value (inspector refresh, zoom fit, …)
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (d && d.set && d.get)
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      configurable: true,
      enumerable: d.enumerable,
      get() {
        return d.get.call(this);
      },
      set(v) {
        d.set.call(this, v);
        if (this.type === 'range') paint(this);
      },
    });
  document.addEventListener(
    'input',
    (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t && t.type === 'range') paint(t);
    },
    true,
  );
  // sliders added by re-rendering a panel
  new MutationObserver(list => {
    for (const m of list)
      m.addedNodes.forEach(n => {
        if (n instanceof HTMLInputElement && n.type === 'range') paint(n);
        else if (n instanceof Element) paintAll(n);
      });
  }).observe(document.body, { childList: true, subtree: true });
  paintAll(document);
}
