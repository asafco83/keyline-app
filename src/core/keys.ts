// SVGcinema — core/keys
// Shortcuts that work on any keyboard layout. On a Hebrew, Russian, Greek or Arabic layout the letter keys
// report other characters in `key` ('ז' for the Z key), and Alt on a Mac types symbols ('Ω'), so letter
// shortcuts go by the physical key (`code`) whenever `key` isn't a Latin letter. Latin layouts (AZERTY,
// QWERTZ…) keep their own letters.

/** The key a shortcut means: a Latin letter (lower case without Shift), or `e.key` for anything else. */
export function keyName(e: KeyboardEvent): string {
  const k = e.key || '',
    m = /^Key([A-Z])$/.exec(e.code || '');
  if (m && !/^[a-zA-Z]$/.test(k)) return e.shiftKey ? m[1] : m[1].toLowerCase();
  return k;
}
/** keyName in lower case */
export const keyLower = (e: KeyboardEvent) => keyName(e).toLowerCase();

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
/** A key's label for this system: Ctrl → ⌘ and Alt → ⌥ on a Mac */
export function keyLabel(k: string): string {
  if (!IS_MAC) return k;
  return k === 'Ctrl' ? '⌘' : k === 'Alt' ? '⌥' : k;
}
