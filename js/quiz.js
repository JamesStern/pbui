// Quiz engine: mastery levels, question scheduling, distractors, scoring, hints.
// Pure functions over a plain progress object so it can be tested in node.
import { roundTo16, formatInches, sameMeasurement } from './measure.js';

export const MAX_LEVEL = 4;
export const CHOICES_BY_LEVEL = { 1: 2, 2: 3, 3: 4, 4: 0 }; // 0 = type the answer
export const ROUND_LENGTH = 10;
export const MASTERY_TYPED = 2; // typed correctly this many times (separate rounds) => mastered

export function newUnitProgress() {
  return { level: 1, streak: 0, correct: 0, wrong: 0, lastSeen: 0, typedCorrect: 0, typedRound: -1, mastered: false };
}

export function newProgress(unitIds) {
  const units = {};
  for (const id of unitIds) units[id] = newUnitProgress();
  return {
    units,
    rounds: 0,
    bestRound: 0,
    totalPoints: 0,
    bestStreak: 0,
    answered: 0,
    answeredCorrect: 0,
  };
}

/** Make sure every unit has a record (e.g. after an app update). */
export function ensureProgress(progress, unitIds) {
  const p = progress && progress.units ? progress : newProgress(unitIds);
  for (const id of unitIds) if (!p.units[id]) p.units[id] = newUnitProgress();
  for (const k of ['rounds', 'bestRound', 'totalPoints', 'bestStreak', 'answered', 'answeredCorrect']) if (p[k] === undefined) p[k] = 0;
  return p;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  return seed === undefined ? Math.random : mulberry32(seed);
}

/**
 * Pick the units for a round. Weakest and least-recently-seen units come up most;
 * mastered units still appear now and then so they do not fade. No unit twice in a row.
 */
export function pickQueue(progress, unitIds, n = ROUND_LENGTH, rng = Math.random) {
  const now = progress.rounds;
  const weight = (id) => {
    const u = progress.units[id];
    const staleness = Math.min(now - u.lastSeen, 6); // rounds since last seen
    let w = (MAX_LEVEL + 1 - u.level) * 2 + staleness + 1;
    if (u.mastered) w = 0.6 + staleness * 0.3;
    if (u.wrong > u.correct) w *= 1.5;
    return w;
  };
  const queue = [];
  let last = null;
  const counts = Object.fromEntries(unitIds.map((id) => [id, 0]));
  for (let i = 0; i < n; i++) {
    const pool = unitIds.filter((id) => id !== last && counts[id] < 2);
    const weights = pool.map((id) => weight(id) / (1 + counts[id] * 3));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let pick = pool[pool.length - 1];
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r <= 0) { pick = pool[j]; break; }
    }
    queue.push(pick);
    counts[pick] += 1;
    last = pick;
  }
  return queue;
}

/**
 * Plausible wrong answers, scaled to the size of the value. Higher levels use the
 * tighter offsets so the choices crowd the true value; level 1 keeps them far apart.
 */
export function distractorOffsets(value, level = 2) {
  let all;
  if (value < 1.5) all = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75];
  else if (value < 3) all = [0.125, 0.25, 0.375, 0.5, 0.75, 1];
  else if (value < 12) all = [0.5, 1, 1.5, 2, 2.5, 3];
  else if (value < 30) all = [1, 2, 3, 4, 5, 6];
  else all = [2, 3, 4, 5, 6, 8, 10, 12];
  const half = Math.ceil(all.length / 2);
  if (level <= 1) return all.slice(all.length - half); // wide apart
  if (level >= 3) return all.slice(0, half);           // close together
  return all;
}

/**
 * Build the multiple-choice options for a question.
 * otherValues: the person's other measurements (used as confusable distractors).
 * level: 1..3; higher levels get closer distractors and lean more on confusables.
 */
export function makeChoices(value, count, otherValues = [], rng = Math.random, level = 2) {
  const v = roundTo16(value);
  const taken = [v];
  const isTaken = (x) => taken.some((t) => sameMeasurement(t, x));
  const candidates = [];
  for (const off of distractorOffsets(v, level)) {
    if (v - off > 0) candidates.push({ x: roundTo16(v - off), w: 1 });
    candidates.push({ x: roundTo16(v + off), w: 1 });
  }
  const confusableWeight = level >= 3 ? 2.2 : level === 2 ? 1.6 : 0.8;
  for (const o of otherValues) {
    const ov = roundTo16(o);
    if (ov > 0 && !sameMeasurement(ov, v) && ov > v * 0.5 && ov < v * 2) candidates.push({ x: ov, w: confusableWeight });
  }
  const options = [v];
  let guard = 0;
  while (options.length < count && guard++ < 200) {
    const pool = candidates.filter((c) => !isTaken(c.x));
    if (!pool.length) break;
    const total = pool.reduce((a, c) => a + c.w, 0);
    let r = rng() * total;
    let pick = pool[pool.length - 1];
    for (const c of pool) { r -= c.w; if (r <= 0) { pick = c; break; } }
    taken.push(pick.x);
    options.push(pick.x);
  }
  // shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    options: options.map((x) => ({ value: x, text: formatInches(x) })),
    correctIndex: options.findIndex((x) => sameMeasurement(x, v)),
  };
}

function niceStep(value) {
  if (value < 2) return 0.25;
  if (value < 6) return 0.5;
  if (value < 15) return 1;
  if (value < 40) return 5;
  return 10;
}

/** Progressive hints: a range, then the whole-inch part, then the answer. */
export function hintStages(value) {
  const step = niceStep(value);
  let lo = Math.floor((value * 0.8) / step) * step;
  let hi = Math.ceil((value * 1.25) / step) * step;
  if (lo >= value) lo = Math.max(0, value - step);
  if (hi <= value) hi = value + step;
  const whole = Math.floor(value);
  const frac = value - whole > 0;
  const wholeText = whole === 0
    ? 'Less than an inch.'
    : `${whole} ${whole === 1 ? 'inch' : 'inches'}${frac ? ' and a fraction.' : ', no fraction.'}`;
  return [
    { label: 'Range', text: `Between ${formatInches(lo)} and ${formatInches(hi)}.` },
    { label: 'Whole inches', text: wholeText },
    { label: 'Answer', text: `It is ${formatInches(value)}.`, reveals: true },
  ];
}

/** Points for an answer. hints = number of hint stages used (3 = revealed). */
export function scoreAnswer({ correct, level, streak, hints }) {
  if (!correct || hints >= 3) return 0;
  const base = 100 * level;
  const streakBonus = 1 + Math.min(streak, 10) * 0.1;
  const hintPenalty = hints === 0 ? 1 : hints === 1 ? 0.6 : 0.3;
  return Math.round(base * streakBonus * hintPenalty);
}

/**
 * Apply an answer to the progress. Returns { progress, points, promoted, demoted, mastered }.
 * Mutates and returns the same progress object.
 */
export function applyAnswer(progress, id, { correct, hints = 0, level }) {
  const u = progress.units[id];
  const lvl = level || u.level;
  const effectiveCorrect = correct && hints < 3;
  const points = scoreAnswer({ correct: effectiveCorrect, level: lvl, streak: u.streak, hints });
  let promoted = false;
  let demoted = false;
  let mastered = false;
  progress.answered += 1;
  u.lastSeen = progress.rounds;
  if (effectiveCorrect) {
    progress.answeredCorrect += 1;
    u.correct += 1;
    u.streak += 1;
    if (hints === 0) {
      if (lvl >= MAX_LEVEL) {
        if (u.typedRound !== progress.rounds) { u.typedCorrect += 1; u.typedRound = progress.rounds; }
        if (u.typedCorrect >= MASTERY_TYPED && !u.mastered) { u.mastered = true; mastered = true; }
      } else if (u.level === lvl) {
        u.level = lvl + 1;
        promoted = true;
      }
    }
  } else {
    u.wrong += 1;
    u.streak = 0;
    if (u.level > 1) { u.level -= 1; demoted = true; }
    if (u.mastered) { u.mastered = false; u.typedCorrect = 0; }
  }
  progress.totalPoints += points;
  progress.bestStreak = Math.max(progress.bestStreak, u.streak);
  return { progress, points, promoted, demoted, mastered };
}

/**
 * After a miss, put the unit back at the end of the round so it comes around once
 * everything else has been asked. If that would mean asking it again immediately
 * (the miss was the last question), one other unit goes in first as a buffer.
 * At most three re-asks per round. Returns true when the unit was re-queued.
 */
export function requeueMiss(round, id, unitIds, rng = Math.random) {
  if (round.requeued >= 3) return false;
  if (round.queue.slice(round.index + 1).includes(id)) return false;
  if (round.queue[round.queue.length - 1] === id) {
    const pool = unitIds.filter((x) => x !== id);
    if (pool.length) round.queue.push(pool[Math.floor(rng() * pool.length)]);
  }
  round.queue.push(id);
  round.requeued += 1;
  return true;
}

export function masteryStats(progress, unitIds) {
  let mastered = 0;
  let levelSum = 0;
  for (const id of unitIds) {
    const u = progress.units[id];
    if (u.mastered) mastered += 1;
    levelSum += u.mastered ? MAX_LEVEL + 1 : u.level;
  }
  return {
    mastered,
    total: unitIds.length,
    percent: Math.round(((levelSum - unitIds.length) / (unitIds.length * MAX_LEVEL)) * 100),
  };
}
