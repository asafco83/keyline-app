// Keyline — core/dom
import { $, NS } from './constants';

export const STAGE = $('#stage');
export const CONTENT = $('#content');
export const OV = $('#overlay');
export const WRAP = $('#wrap');
export const ART = $('#artboard');
export const INSP = $('#insp');
export const TLB = $('#tlbody');
export const TLS = $('#tlscroll');
export const LP = $('#lp');
export const AG = $('#ag');
export function svgEl(tag?, a?) { const e=document.createElementNS(NS,tag); for(const k in a) e.setAttribute(k,a[k]); return e; }
