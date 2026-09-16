// Renders the poster as an inline SVG and exposes a small API to fill in values,
// mark mastery, spotlight a unit, and compute a crop region for one unit's row.
import { POSTER_W, POSTER_H, BAR, FIGURES, UNITS, UNIT_BY_ID, TITLE, FOOTER } from './units.js';

const NS = 'http://www.w3.org/2000/svg';
const FIG_BASE = './assets/figures/';

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    e.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(e);
  return e;
}

function figureRect(f) {
  return { x: f.cx - f.w / 2, y: f.cy - f.h / 2, w: f.w, h: f.h };
}

function barRect(u) {
  const side = u.side === 'L' ? BAR.left : BAR.right;
  return { x: side.x, y: u.barY, w: side.w, h: BAR.h };
}

/**
 * Build the poster. Options:
 *   values: { unitId -> text } handwritten values to show
 *   interactive: bars get a pointer cursor and emit 'unitclick' CustomEvents on the svg
 */
export function buildPoster({ values = {}, interactive = false, grain = true } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${POSTER_W} ${POSTER_H}`, class: 'poster', role: 'img', 'aria-label': 'Personal Body Unit Index poster' });
  const defs = el('defs', {}, svg);
  if (grain) {
    const filter = el('filter', { id: 'grain', x: 0, y: 0, width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.8', numOctaves: 2, seed: 7, stitchTiles: 'stitch', result: 'noise' }, filter);
    el('feColorMatrix', { in: 'noise', type: 'saturate', values: 0 }, filter);
  }
  el('rect', { class: 'paper', x: 0, y: 0, width: POSTER_W, height: POSTER_H }, svg);
  if (grain) el('rect', { class: 'grain', x: 0, y: 0, width: POSTER_W, height: POSTER_H, filter: 'url(#grain)' }, svg);

  const title = el('text', { class: 'title', x: POSTER_W / 2, y: 72, 'text-anchor': 'middle' }, svg);
  title.textContent = TITLE;

  const figGroup = el('g', { class: 'figures' }, svg);
  const figEls = {};
  for (const [name, f] of Object.entries(FIGURES)) {
    const r = figureRect(f);
    figEls[name] = el('image', { class: 'figure', 'data-figure': name, href: FIG_BASE + f.src, x: r.x, y: r.y, width: r.w, height: r.h, preserveAspectRatio: 'xMidYMid meet' }, figGroup);
  }

  const unitEls = {};
  for (const u of UNITS) {
    const g = el('g', { class: 'unit', 'data-id': u.id }, svg);
    const marks = el('g', { class: 'marks' }, g);
    el('path', { class: 'leader', d: u.leader }, marks);
    if (u.ext) el('path', { class: 'ext', d: u.ext }, marks);
    el('path', { class: 'dim', d: u.dim }, marks);
    for (const [cx, cy, r] of u.circles || []) el('circle', { class: 'ring', cx, cy, r }, marks);
    for (const [cx, cy] of u.dots || []) el('circle', { class: 'dot', cx, cy, r: 3.2 }, marks);

    const b = barRect(u);
    const label = el('text', {
      class: 'label',
      x: u.side === 'L' ? b.x : b.x + b.w,
      y: b.y - 5,
      'text-anchor': u.side === 'L' ? 'start' : 'end',
    }, g);
    label.textContent = u.label;
    el('rect', { class: 'bar', x: b.x, y: b.y, width: b.w, height: b.h }, g);
    el('rect', { class: 'tab', x: u.side === 'L' ? b.x + b.w - BAR.tab : b.x, y: b.y, width: BAR.tab, height: b.h }, g);
    el('rect', { class: 'ring-mastered', x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, rx: 2 }, g);
    const value = el('text', {
      class: 'value',
      x: u.side === 'L' ? b.x + 14 : b.x + BAR.tab + 12,
      y: b.y + 13.5,
    }, g);
    value.textContent = values[u.id] || '';
    if (interactive) {
      const hit = el('rect', { class: 'hit', x: b.x - 4, y: b.y - 16, width: b.w + 8, height: b.h + 22 }, g);
      hit.addEventListener('click', () => svg.dispatchEvent(new CustomEvent('unitclick', { detail: { id: u.id } })));
    }
    unitEls[u.id] = g;
  }

  const footer = el('text', { class: 'footer', x: POSTER_W / 2, y: 1836, 'text-anchor': 'middle' }, svg);
  footer.textContent = FOOTER;

  const api = {
    svg,
    setValue(id, text) {
      const g = unitEls[id];
      if (!g) return;
      g.querySelector('.value').textContent = text || '';
      g.classList.toggle('filled', Boolean(text));
    },
    setMastered(id, on) {
      const g = unitEls[id];
      if (g) g.classList.toggle('mastered', Boolean(on));
    },
    /** Spotlight one unit (or an array) and dim the rest; null clears. */
    spotlight(ids) {
      const set = new Set(ids === null || ids === undefined ? [] : [].concat(ids));
      const any = set.size > 0;
      svg.classList.toggle('spotlit', any);
      const litFigures = new Set([...set].map((id) => UNIT_BY_ID[id].figure));
      for (const [id, g] of Object.entries(unitEls)) g.classList.toggle('lit', set.has(id));
      for (const [name, img] of Object.entries(figEls)) img.classList.toggle('lit', litFigures.has(name));
    },
    /** The region {x,y,w,h} covering one unit's row: figure, marks, and its bar. */
    regionFor(id, pad = 24) {
      const u = UNIT_BY_ID[id];
      const boxes = [figureRect(FIGURES[u.figure]), barRect(u)];
      boxes[1] = { x: boxes[1].x, y: boxes[1].y - 16, w: boxes[1].w, h: boxes[1].h + 16 };
      try {
        const bb = unitEls[id].querySelector('.marks').getBBox();
        if (bb.width || bb.height) boxes.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height });
      } catch (e) { /* not in DOM yet */ }
      const x0 = Math.min(...boxes.map((b) => b.x)) - pad;
      const y0 = Math.min(...boxes.map((b) => b.y)) - pad;
      const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + pad;
      const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + pad;
      return { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(POSTER_W, x1) - Math.max(0, x0), h: Math.min(POSTER_H, y1) - Math.max(0, y0) };
    },
    /** Zoom the svg to a region (full-width strip by default so the row reads like the print). */
    crop(id, { fullWidth = true, pad = 24 } = {}) {
      const r = api.regionFor(id, pad);
      const x = fullWidth ? 0 : r.x;
      const w = fullWidth ? POSTER_W : r.w;
      svg.setAttribute('viewBox', `${x} ${r.y} ${w} ${r.h}`);
      svg.style.aspectRatio = `${w} / ${r.h}`;
      return { x, y: r.y, w, h: r.h };
    },
    uncrop() {
      svg.setAttribute('viewBox', `0 0 ${POSTER_W} ${POSTER_H}`);
      svg.style.aspectRatio = `${POSTER_W} / ${POSTER_H}`;
    },
    unitElement(id) { return unitEls[id]; },
  };
  for (const [id, text] of Object.entries(values)) if (text) unitEls[id]?.classList.add('filled');
  return api;
}
