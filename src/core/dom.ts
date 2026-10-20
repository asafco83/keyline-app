// SVGcinema — core/dom
import { $, NS } from './constants';

/** Panel elements. Typed loosely until the UI modules are migrated (see README → Typing). */
export const STAGE: any = $('#stage');
export const CONTENT: any = $('#content');
export const OV: any = $('#overlay');
export const WRAP: any = $('#wrap');
export const ART: any = $('#artboard');
export const INSP: any = $('#insp');
export const TLB: any = $('#tlbody');
export const TLS: any = $('#tlscroll');
export const LP: any = $('#lp');
export const AG: any = $('#ag');
export function svgEl(tag: string, a?: Record<string, string | number>) {
  const e = document.createElementNS(NS, tag);
  for (const k in a) e.setAttribute(k, String(a[k]));
  return e;
}
