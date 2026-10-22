// SVGcinema — io/embed
// The editable project an SVGcinema export can carry (Export › Include the editable project): the
// document as JSON in the SVG's <metadata>, with the images taken from the SVG's own image symbols.
import type { Asset, Doc, Layer } from '../model/types';
import { normalizeDoc } from './open';

export function readEmbedded(root: Element): { doc: Doc; assets: Record<string, Asset> } | null {
  const el = Array.from(root.getElementsByTagName('*')).find(e => e.localName === 'svgcinema-project');
  if (!el) return null;
  let data: any;
  try {
    data = JSON.parse(el.textContent || '');
  } catch (_) {
    return null;
  }
  if (!data || data.format !== 'svgcinema-project' || !data.doc || !Array.isArray(data.doc.layers)) return null;
  const pre = el.getAttribute('prefix') || '',
    assets: Record<string, Asset> = {};
  (data.assets || []).forEach((a: any) => {
    const sym = Array.from(root.getElementsByTagName('*')).find(e => e.getAttribute('id') === pre + 'img-' + a.id),
      img = sym && Array.from(sym.getElementsByTagName('*')).find(e => e.localName === 'image'),
      href =
        img &&
        (img.getAttribute('href') ||
          img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
          img.getAttribute('xlink:href'));
    if (!href) return;
    const i = href.indexOf(',');
    assets[a.id] = {
      id: a.id,
      kind: 'image',
      name: a.name || 'image',
      mime: (/^data:([^;,]+)/.exec(href) || [])[1] || a.mime || 'image/png',
      data: href,
      w: a.w,
      h: a.h,
      size: Math.round(((href.length - i - 1) * 3) / 4),
    };
  });
  return { doc: normalizeDoc(data.doc), assets };
}
/** Give embedded layers new ids (so they can join another project): every reference follows. */
export function renumber(layers: Layer[], newId: () => string, assetIds: Record<string, string>): Layer[] {
  const map: Record<string, string> = {};
  layers.forEach(l => (map[l.id] = newId()));
  return layers.map(l => {
    const c: Layer = JSON.parse(JSON.stringify(l));
    c.id = map[l.id];
    if (c.parent) c.parent = map[c.parent] || null;
    (c.pins || []).forEach(p => p.bone && (p.bone = map[p.bone] || p.bone));
    if (c.dord) c.dord = c.dord.map(id => map[id] || id);
    if (c.type === 'image' && c.geo.asset) c.geo.asset = assetIds[c.geo.asset] || c.geo.asset;
    return c;
  });
}
