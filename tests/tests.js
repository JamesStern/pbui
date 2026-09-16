// Run: node tests/tests.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseInches, formatInches, fractionParts, roundTo16, sameMeasurement, formatAlt } from '../js/measure.js';
import {
  newProgress, ensureProgress, pickQueue, makeChoices, hintStages, applyAnswer, scoreAnswer,
  masteryStats, makeRng, MAX_LEVEL, CHOICES_BY_LEVEL, distractorOffsets,
} from '../js/quiz.js';
import { UNITS, FIGURES } from '../js/units.js';
import { APP_VERSION } from '../js/version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; } catch (e) { console.error(`FAIL ${name}\n  ${e.message}`); process.exitCode = 1; }
}

// ---------- measure ----------
test('parse plain and decimal inches', () => {
  assert.equal(parseInches('18'), 18);
  assert.equal(parseInches('18.5'), 18.5);
  assert.equal(parseInches(' 71" '), 71);
  assert.equal(parseInches('93 in'), 93);
  assert.equal(parseInches('1.5in'), 1.5);
  assert.equal(parseInches('18,5'), 18.5);
});
test('parse fractions', () => {
  assert.equal(parseInches('18 1/2'), 18.5);
  assert.equal(parseInches('18-1/2"'), 18.5);
  assert.equal(parseInches('7/8'), 0.875);
  assert.equal(parseInches('1 3/8"'), 1.375);
  assert.equal(parseInches('3 ¾'), 3.75);
  assert.equal(parseInches('½'), 0.5);
});
test('parse feet and inches', () => {
  assert.equal(parseInches('7\'9"'), 93);
  assert.equal(parseInches('7\' 9 1/2"'), 93.5);
  assert.equal(parseInches('6 ft 1 in'), 73);
  assert.equal(parseInches('6\''), 72);
  assert.equal(parseInches('5′11″'), 71);
});
test('parse metric', () => {
  assert.ok(Math.abs(parseInches('180.34 cm') - 71) < 0.01);
  assert.ok(Math.abs(parseInches('25.4mm') - 1) < 1e-9);
  assert.ok(Math.abs(parseInches('1.8 m') - 70.866) < 0.01);
});
test('parse rejects junk', () => {
  assert.equal(parseInches(''), null);
  assert.equal(parseInches('abc'), null);
  assert.equal(parseInches('18 5'), null);
  assert.equal(parseInches('1/0'), null);
  assert.equal(parseInches(null), null);
});
test('format poster style', () => {
  assert.equal(formatInches(71), '71"');
  assert.equal(formatInches(18.5), '18 1/2"');
  assert.equal(formatInches(0.875), '7/8"');
  assert.equal(formatInches(1.375), '1 3/8"');
  assert.equal(formatInches(3.75), '3 3/4"');
  assert.equal(formatInches(2.0625), '2 1/16"');
  assert.equal(formatInches(18.5, { quote: false }), '18 1/2');
  assert.equal(formatInches(null), '');
});
test('fractionParts reduces and rounds to sixteenths', () => {
  assert.deepEqual(fractionParts(18.5), { whole: 18, num: 1, den: 2 });
  assert.deepEqual(fractionParts(0.03), { whole: 0, num: 0, den: 16 });
  assert.deepEqual(fractionParts(0.99), { whole: 1, num: 0, den: 16 });
  assert.equal(roundTo16(1.33), 1.3125);
});
test('sameMeasurement tolerance', () => {
  assert.ok(sameMeasurement(18.5, parseInches('18 1/2')));
  assert.ok(sameMeasurement(18.5, 18.5625));
  assert.ok(!sameMeasurement(18.5, 18.75));
});
test('formatAlt', () => {
  assert.equal(formatAlt(71), '5′ 11″ · 180.3 cm');
  assert.equal(formatAlt(9), '22.9 cm');
});

// ---------- quiz ----------
const IDS = UNITS.map((u) => u.id);
test('units are well formed', () => {
  assert.equal(UNITS.length, 17);
  assert.equal(new Set(IDS).size, 17);
  for (const u of UNITS) {
    assert.ok(u.label && u.howto && u.leader && u.dim, u.id);
    assert.ok(['L', 'R'].includes(u.side), u.id);
    assert.ok(FIGURES[u.figure], `${u.id} figure ${u.figure}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'figures', FIGURES[u.figure].src)), `${u.figure} png`);
  }
});
test('choices contain the answer, are distinct and plausible', () => {
  const rng = makeRng(42);
  for (const v of [0.875, 1.375, 4.5, 9, 18.5, 47, 71, 93]) {
    for (let n = 2; n <= 4; n++) {
      const { options, correctIndex } = makeChoices(v, n, [1.5, 2, 4.5, 72, 93], rng);
      assert.equal(options.length, n, `count for ${v}`);
      assert.ok(sameMeasurement(options[correctIndex].value, v));
      const texts = new Set(options.map((o) => o.text));
      assert.equal(texts.size, n, `distinct for ${v}`);
      for (const o of options) assert.ok(o.value > 0);
    }
  }
});
test('distractor offsets scale with size', () => {
  assert.ok(Math.max(...distractorOffsets(0.875)) < 1);
  assert.ok(Math.min(...distractorOffsets(71)) >= 2);
});
test('level progression: up on clean correct, down on wrong, mastery after two typed rounds', () => {
  const p = newProgress(IDS);
  p.rounds = 1;
  let r = applyAnswer(p, 'fathom', { correct: true, hints: 0, level: 1 });
  assert.ok(r.promoted); assert.equal(p.units.fathom.level, 2);
  r = applyAnswer(p, 'fathom', { correct: true, hints: 1, level: 2 });
  assert.ok(!r.promoted); assert.equal(p.units.fathom.level, 2, 'hint blocks promotion');
  r = applyAnswer(p, 'fathom', { correct: false, level: 2 });
  assert.ok(r.demoted); assert.equal(p.units.fathom.level, 1);
  p.units.fathom.level = 4;
  r = applyAnswer(p, 'fathom', { correct: true, hints: 0, level: 4 });
  assert.ok(!r.mastered && p.units.fathom.typedCorrect === 1);
  r = applyAnswer(p, 'fathom', { correct: true, hints: 0, level: 4 });
  assert.ok(!r.mastered, 'same round does not count twice');
  p.rounds = 2;
  r = applyAnswer(p, 'fathom', { correct: true, hints: 0, level: 4 });
  assert.ok(r.mastered && p.units.fathom.mastered);
  r = applyAnswer(p, 'fathom', { correct: false, level: 4 });
  assert.ok(!p.units.fathom.mastered, 'a miss un-masters');
});
test('revealed answer scores zero and counts as a miss', () => {
  const p = newProgress(IDS);
  const r = applyAnswer(p, 'span', { correct: true, hints: 3, level: 2 });
  assert.equal(r.points, 0);
  assert.equal(p.units.span.level, 1);
  assert.equal(scoreAnswer({ correct: true, level: 3, streak: 0, hints: 0 }), 300);
  assert.equal(scoreAnswer({ correct: true, level: 1, streak: 5, hints: 0 }), 150);
  assert.equal(scoreAnswer({ correct: true, level: 1, streak: 0, hints: 1 }), 60);
});
test('queue favours weak units and never repeats back to back', () => {
  const p = newProgress(IDS);
  p.rounds = 3;
  for (const id of IDS) { p.units[id].level = 4; p.units[id].mastered = true; p.units[id].lastSeen = 3; }
  p.units.peek.level = 1; p.units.peek.mastered = false; p.units.peek.lastSeen = 0;
  const rng = makeRng(7);
  let peekCount = 0;
  for (let i = 0; i < 40; i++) {
    const q = pickQueue(p, IDS, 10, rng);
    assert.equal(q.length, 10);
    for (let j = 1; j < q.length; j++) assert.notEqual(q[j], q[j - 1]);
    peekCount += q.filter((x) => x === 'peek').length;
  }
  assert.ok(peekCount >= 40, `peek should appear at least once per round on average, got ${peekCount}/40`);
});
test('hints are sensible', () => {
  const h = hintStages(9);
  assert.equal(h.length, 3);
  assert.match(h[0].text, /Between 7" and 12"/);
  assert.equal(h[1].text, '9 inches, no fraction.');
  assert.ok(h[2].reveals && h[2].text.includes('9"'));
  assert.equal(hintStages(0.875)[1].text, 'Less than an inch.');
  assert.equal(hintStages(18.5)[1].text, '18 inches and a fraction.');
  const big = hintStages(93);
  assert.match(big[0].text, /Between 70" and 120"/);
});
test('ensureProgress fills in missing units', () => {
  const p = ensureProgress({ units: { fathom: { level: 3 } } }, IDS);
  assert.equal(p.units.fathom.level, 3);
  assert.equal(p.units.peek.level, 1);
  assert.equal(p.rounds, 0);
  const s = masteryStats(newProgress(IDS), IDS);
  assert.deepEqual(s, { mastered: 0, total: 17, percent: 0 });
});
test('CHOICES_BY_LEVEL matches MAX_LEVEL', () => {
  assert.equal(Object.keys(CHOICES_BY_LEVEL).length, MAX_LEVEL);
  assert.equal(CHOICES_BY_LEVEL[MAX_LEVEL], 0);
});

// ---------- build guards ----------
test('service worker VERSION matches APP_VERSION', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const m = sw.match(/const VERSION = '([^']+)'/);
  assert.ok(m, 'VERSION in sw.js');
  assert.equal(m[1], APP_VERSION);
});
test('service worker precaches every shipped file', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((f) => f && !f.endsWith('/'));
  for (const f of listed) assert.ok(fs.existsSync(path.join(ROOT, f)), `precached file missing: ${f}`);
  const shouldShip = [];
  for (const dir of ['js', 'css', 'assets/fonts', 'assets/figures', 'icons']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (!f.endsWith('.json')) shouldShip.push(`${dir}/${f}`);
  }
  for (const f of shouldShip) assert.ok(listed.includes(f), `file not precached: ${f}`);
});

console.log(`${passed} tests passed${process.exitCode ? ', with failures' : ''}`);
