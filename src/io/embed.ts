// SVGcinema — io/embed
// The project data an SVGcinema export can carry (filled in with the embedding option).
import type { Asset, Doc } from '../model/types';

export function readEmbedded(root: Element): { doc: Doc; assets: Record<string, Asset> } | null {
  void root;
  return null;
}
