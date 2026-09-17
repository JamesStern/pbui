// Screens, routing, input handling, persistence, service worker registration.
import { UNITS, UNIT_BY_ID } from './units.js';
import { parseInches, formatInches, formatAlt, roundTo16, sameMeasurement } from './measure.js';
import { buildPoster } from './poster.js';
import * as store from './store.js';
import {
  MAX_LEVEL, CHOICES_BY_LEVEL, ROUND_LENGTH, ensureProgress, pickQueue, makeChoices,
  hintStages, applyAnswer, masteryStats, newProgress, requeueMiss,
} from './quiz.js';
import { APP_VERSION } from './version.js';

const UNIT_IDS = UNITS.map((u) => u.id);
const FRACTION_CHIPS = ['1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];

let state = store.load();
state.progress = ensureProgress(state.progress, UNIT_IDS);
const app = document.getElementById('app');

function persist() { store.save(state); }
function measuredCount() { return UNIT_IDS.filter((id) => state.measurements[id] > 0).length; }
function measuredIds() { return UNIT_IDS.filter((id) => state.measurements[id] > 0); }
function valuesText() {
  const out = {};
  for (const id of UNIT_IDS) if (state.measurements[id] > 0) out[id] = formatInches(state.measurements[id]);
  return out;
}

// ---------- tiny DOM helpers ----------
function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

let toastTimer = null;
function toast(text, { sticky = false, onClick } = {}) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.hidden = false;
  t.onclick = () => { t.hidden = true; if (onClick) onClick(); };
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function confetti() {
  const c = h('div', { class: 'confetti' });
  for (let i = 0; i < 70; i++) {
    const p = h('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 3200);
}

function fractionChips(input) {
  return h('div', { class: 'chips' },
    FRACTION_CHIPS.map((f) => h('button', {
      class: 'chip', type: 'button',
      onclick: () => {
        const cur = input.value.replace(/"+$/, '').trim();
        const whole = cur.match(/^(\d+)(?:\s+\d+\/\d+)?$/);
        input.value = whole ? `${whole[1]} ${f}` : f;
        input.dispatchEvent(new Event('input'));
        input.focus();
      },
    }, f)),
  );
}

// ---------- routing ----------
function route() {
  const hash = location.hash.replace(/^#/, '') || 'poster';
  const [name, arg] = hash.split('/');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  app.replaceChildren();
  window.scrollTo(0, 0);
  if (name === 'measure') renderMeasure(arg);
  else if (name === 'quiz') renderQuiz();
  else if (name === 'progress') renderProgress();
  else renderPoster();
}
window.addEventListener('hashchange', route);

// ---------- Poster (home) ----------
function renderPoster() {
  const count = measuredCount();
  const screen = h('div', { class: 'screen' });
  if (count < UNIT_IDS.length) {
    screen.appendChild(h('div', { class: 'banner' },
      count === 0
        ? h('span', {}, 'Your index is blank. ', h('a', { href: '#measure' }, 'Take your measurements'), ' to fill it in.')
        : h('span', {}, `${count} of ${UNIT_IDS.length} units measured. `, h('a', { href: '#measure' }, 'Keep going'), '.'),
    ));
  }
  const poster = buildPoster({ values: valuesText(), interactive: true });
  for (const id of UNIT_IDS) poster.setMastered(id, state.progress.units[id].mastered);
  poster.svg.addEventListener('unitclick', (e) => { location.hash = `#measure/${UNIT_IDS.indexOf(e.detail.id)}`; });
  screen.appendChild(h('div', { class: 'poster-wrap' }, poster.svg));

  const ms = masteryStats(state.progress, UNIT_IDS);
  screen.appendChild(h('div', { class: 'card' },
    h('div', { class: 'row between' },
      h('div', { class: 'stat' }, h('b', {}, `${count}/${UNIT_IDS.length}`), h('span', {}, 'measured')),
      h('div', { class: 'stat' }, h('b', {}, `${ms.mastered}/${ms.total}`), h('span', {}, 'memorized')),
      h('div', { class: 'stat' }, h('b', {}, `${ms.percent}%`), h('span', {}, 'progress')),
    ),
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '#measure' }, count ? 'Edit measurements' : 'Measure'),
      h('a', { class: `btn primary`, href: '#quiz' }, 'Quiz me'),
    ),
    h('p', { class: 'small muted' }, 'Tap any label on the poster to edit that measurement.'),
  ));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: onImportFile });
  screen.appendChild(h('div', { class: 'card' },
    h('h2', {}, 'Data'),
    h('p', { class: 'small muted' }, 'Everything is stored on this device only. Export to move your index to another device.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', onclick: onExport }, 'Export'),
      h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, 'Import'),
      h('button', { class: 'btn ghost', onclick: onResetAll }, 'Reset'),
    ),
    fileInput,
  ));
  screen.appendChild(h('p', { class: 'credit' },
    'Personal Body Unit Index is a poster by ', h('a', { href: 'https://cwandt.com/products/personal-body-unit-index', target: '_blank', rel: 'noopener' }, 'CW&T'),
    '. This is an unofficial study companion. ', h('br'), `PBUI Trainer ${APP_VERSION}`,
  ));
  app.appendChild(screen);
}

function onExport() {
  const text = store.exportJSON(state);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'pbui-index.json' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  toast('Exported (and copied to clipboard).');
}

function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      state = store.importJSON(text);
      state.progress = ensureProgress(state.progress, UNIT_IDS);
      persist();
      toast('Imported.');
      route();
    } catch (err) {
      toast(err.message || 'Could not import that file.');
    }
  });
}

function onResetAll() {
  if (!confirm('Erase all measurements and quiz progress on this device?')) return;
  store.reset();
  state = store.load();
  state.progress = ensureProgress(null, UNIT_IDS);
  route();
}

// ---------- Measure wizard ----------
function renderMeasure(arg) {
  let index = arg !== undefined ? Number(arg) : state.wizardIndex;
  if (!Number.isInteger(index) || index < 0) index = 0;
  if (index >= UNIT_IDS.length) { renderMeasureDone(); return; }
  state.wizardIndex = index;
  persist();

  const unit = UNITS[index];
  const current = state.measurements[unit.id];
  const screen = h('div', { class: 'screen' });

  const poster = buildPoster({ values: valuesText(), grain: false });
  poster.svg.classList.add('cropped');
  poster.spotlight(unit.id);

  const input = h('input', {
    class: 'labelbar', type: 'text', inputmode: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    placeholder: 'e.g. 18 1/2  or  18.5', value: current ? formatInches(current) : '',
    'aria-label': `${unit.label} measurement in inches`,
  });
  const alt = h('div', { class: 'alt' });
  const updateAlt = () => {
    const v = parseInches(input.value);
    if (!input.value.trim()) { alt.textContent = 'Inches. Fractions, decimals, feet (7\'9"), or cm all work.'; alt.classList.remove('error'); return; }
    if (v === null || v <= 0) { alt.textContent = 'Hmm, I can\'t read that. Try 18 1/2, 18.5, 7\'9" or 47 cm.'; alt.classList.add('error'); return; }
    alt.textContent = `= ${formatInches(roundTo16(v))}  ·  ${formatAlt(v)}`;
    alt.classList.remove('error');
  };
  input.addEventListener('input', updateAlt);
  updateAlt();

  const saveAndGo = (delta) => {
    const raw = input.value.trim();
    if (raw) {
      const v = parseInches(raw);
      if (v === null || v <= 0) { input.focus(); updateAlt(); return; }
      state.measurements[unit.id] = roundTo16(v);
    }
    persist();
    location.hash = `#measure/${index + delta}`;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveAndGo(1); } });

  const steps = h('div', { class: 'steps' }, UNIT_IDS.map((id, i) => h('i', { class: i < index ? 'done' : i === index ? 'current' : '', title: UNIT_BY_ID[id].label })));

  screen.appendChild(h('div', { class: 'card' },
    h('div', { class: 'row between' },
      h('span', { class: 'eyebrow' }, `Measure ${index + 1} of ${UNIT_IDS.length}`),
      h('span', { class: 'eyebrow' }, `${measuredCount()} filled in`),
    ),
    steps,
    h('div', { class: 'unit-name' }, unit.label, h('small', {}, unit.aka)),
    h('div', { class: 'poster-wrap' }, poster.svg),
    h('p', { class: 'howto' }, unit.howto),
    input,
    alt,
    fractionChips(input),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', disabled: index === 0, onclick: () => saveAndGo(-1) }, 'Back'),
      h('button', { class: 'btn ghost', onclick: () => { persist(); location.hash = `#measure/${index + 1}`; } }, 'Skip'),
      h('button', { class: 'btn primary', onclick: () => saveAndGo(1) }, index === UNIT_IDS.length - 1 ? 'Finish' : 'Next'),
    ),
  ));
  app.appendChild(screen);
  poster.crop(unit.id);
  requestAnimationFrame(() => poster.crop(unit.id));
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

function renderMeasureDone() {
  state.wizardIndex = 0;
  persist();
  const count = measuredCount();
  const missing = UNIT_IDS.filter((id) => !(state.measurements[id] > 0));
  const screen = h('div', { class: 'screen' },
    h('div', { class: 'card' },
      h('h2', {}, 'Measurements'),
      h('div', { class: 'unit-name' }, count === UNIT_IDS.length ? 'Index complete' : `${count} of ${UNIT_IDS.length} measured`),
      missing.length
        ? h('p', { class: 'howto' }, 'Still blank: ', missing.map((id) => UNIT_BY_ID[id].label).join(', '), '. You can quiz on what you have and come back for the rest.')
        : h('p', { class: 'howto' }, 'Every unit is filled in. Now the real work: committing them to memory.'),
      h('div', { class: 'actions' },
        h('a', { class: 'btn', href: '#poster' }, 'See the poster'),
        h('a', { class: 'btn primary', href: '#quiz' }, 'Start the quiz'),
      ),
    ),
  );
  if (count === UNIT_IDS.length) confetti();
  app.appendChild(screen);
}

// ---------- Quiz ----------
const MIN_FOR_QUIZ = 4;
let round = null; // { queue, index, points, streak, correct, answered, promoted:[], mastered:[], startedRounds }

function renderQuiz() {
  const ids = measuredIds();
  if (ids.length < MIN_FOR_QUIZ) {
    app.appendChild(h('div', { class: 'screen' }, h('div', { class: 'card' },
      h('h2', {}, 'Quiz'),
      h('div', { class: 'unit-name' }, 'Measure first'),
      h('p', { class: 'howto' }, `The quiz needs at least ${MIN_FOR_QUIZ} measurements to work with. You have ${ids.length}.`),
      h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#measure' }, 'Measure')),
    )));
    return;
  }
  if (!round || round.finished) startRound(ids);
  renderQuestion();
}

function startRound(ids) {
  state.progress.rounds += 1;
  const queue = pickQueue(state.progress, ids, ROUND_LENGTH);
  round = { queue, index: 0, points: 0, streak: 0, correct: 0, answered: 0, promoted: [], demoted: [], mastered: [], finished: false, requeued: 0 };
  persist();
}

function levelBadge(level) {
  const n = CHOICES_BY_LEVEL[level];
  return `Level ${level} · ${n ? `${n} choices` : 'type it'}`;
}

function renderQuestion() {
  app.replaceChildren();
  if (round.index >= round.queue.length) { renderRoundEnd(); return; }
  const id = round.queue[round.index];
  const unit = UNIT_BY_ID[id];
  const value = state.measurements[id];
  const up = state.progress.units[id];
  const level = up.mastered ? MAX_LEVEL : up.level;
  const choicesCount = CHOICES_BY_LEVEL[level];
  const others = measuredIds().filter((x) => x !== id).map((x) => state.measurements[x]);
  const hints = hintStages(value);
  let hintsUsed = 0;
  let answered = false;

  const poster = buildPoster({ values: {}, grain: false });
  poster.svg.classList.add('cropped');
  poster.spotlight(id);

  const header = h('div', { class: 'row between' },
    h('span', { class: 'eyebrow' }, `Question ${round.index + 1} of ${round.queue.length}`),
    h('span', { class: 'eyebrow' }, h('span', { class: 'streak' }, round.streak >= 2 ? `🔥 ${round.streak}  ` : ''), `${round.points} pts`),
  );
  const feedback = h('div', { class: 'feedback' });
  const hintBox = h('div', { class: 'hints' });
  const hintBtn = h('button', { class: 'btn ghost', type: 'button' }, 'Hint');
  const nextBtn = h('button', { class: 'btn primary', type: 'button', hidden: true }, 'Next');
  const answerArea = h('div', { class: 'choices' });

  const finish = (correct, chosenText) => {
    if (answered) return;
    answered = true;
    const res = applyAnswer(state.progress, id, { correct, hints: hintsUsed, level });
    round.answered += 1;
    const counted = correct && hintsUsed < 3;
    if (counted) {
      round.correct += 1;
      round.streak += 1;
      round.points += res.points;
      if (res.promoted) round.promoted.push(id);
      if (res.mastered) { round.mastered.push(id); confetti(); }
      feedback.className = 'feedback good';
      feedback.replaceChildren(
        res.mastered ? `Memorized! ${unit.label} is yours. ` : res.promoted ? `Correct! ${unit.label} moves up to level ${up.level}. ` : 'Correct! ',
        res.points ? h('span', { class: 'points-pop' }, `+${res.points}`) : null,
      );
    } else {
      round.streak = 0;
      if (res.demoted) round.demoted.push(id);
      feedback.className = 'feedback bad';
      feedback.textContent = correct
        ? `Right, but revealed. ${unit.label} is ${formatInches(value)}.`
        : `Not quite. ${unit.label} is ${formatInches(value)}${chosenText ? `, not ${chosenText}` : ''}.`;
      requeueMiss(round, id, measuredIds()); // comes back at the end of the round
    }
    hintBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    persist();
  };
  nextBtn.addEventListener('click', () => { round.index += 1; renderQuestion(); });

  hintBtn.addEventListener('click', () => {
    if (hintsUsed >= hints.length) return;
    const stage = hints[hintsUsed];
    hintsUsed += 1;
    hintBox.appendChild(h('div', { class: 'hint' }, h('b', {}, stage.label), stage.text));
    if (stage.reveals) {
      answerArea.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      finish(true, null);
    } else {
      hintBtn.textContent = hintsUsed === 1 ? 'Another hint' : 'Just tell me';
    }
  });

  if (choicesCount) {
    const { options, correctIndex } = makeChoices(value, choicesCount, others, Math.random, level);
    options.forEach((opt, i) => {
      const b = h('button', { class: `labelbar ${i % 2 ? 'right' : ''}`, type: 'button' }, opt.text);
      b.addEventListener('click', () => {
        if (answered) return;
        const correct = i === correctIndex;
        b.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) answerArea.children[correctIndex].classList.add('reveal');
        answerArea.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        finish(correct, opt.text);
      });
      answerArea.appendChild(b);
    });
  } else {
    const input = h('input', { class: 'labelbar', type: 'text', inputmode: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'type it in inches', 'aria-label': `${unit.label} in inches` });
    const check = h('button', { class: 'btn primary', type: 'button' }, 'Check');
    const doCheck = () => {
      if (answered) return;
      const v = parseInches(input.value);
      if (v === null) { input.focus(); toast('Type a number like 18 1/2 or 18.5'); return; }
      const correct = sameMeasurement(v, value);
      input.classList.add(correct ? 'correct' : 'wrong');
      input.disabled = true;
      check.disabled = true;
      finish(correct, formatInches(roundTo16(v)));
    };
    check.addEventListener('click', doCheck);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doCheck(); } });
    answerArea.append(input, fractionChips(input), check);
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  // Brief tap guard: a tap that lands while the next question is appearing must not
  // hit a choice or the hint button.
  const card = h('div', { class: 'card settling' },
    header,
    h('div', { class: 'row between' },
      h('div', { class: 'unit-name' }, unit.label, h('small', {}, unit.aka)),
      h('span', { class: `badge ${up.mastered ? 'orange' : ''}` }, up.mastered ? 'Memorized · keep it' : levelBadge(level)),
    ),
    h('div', { class: 'poster-wrap' }, poster.svg),
    h('p', { class: 'howto' }, unit.howto),
    answerArea,
    hintBox,
    feedback,
    h('div', { class: 'actions' }, hintBtn, nextBtn),
  );
  app.appendChild(h('div', { class: 'screen' }, card));
  poster.crop(id);
  requestAnimationFrame(() => poster.crop(id));
  setTimeout(() => card.classList.remove('settling'), 450);
}

function renderRoundEnd() {
  round.finished = true;
  const prevBest = state.progress.bestRound;
  state.progress.bestRound = Math.max(prevBest, round.points);
  persist();
  const ms = masteryStats(state.progress, UNIT_IDS);
  const acc = round.answered ? Math.round((round.correct / round.answered) * 100) : 0;
  const all = ms.mastered === ms.total;
  if (all) confetti();
  const names = (ids) => [...new Set(ids)].map((id) => UNIT_BY_ID[id].label).join(', ');
  app.appendChild(h('div', { class: 'screen' }, h('div', { class: 'card' },
    h('h2', {}, 'Round complete'),
    h('div', { class: 'unit-name' }, all ? 'All 17 committed to memory' : `${round.points} points`),
    h('div', { class: 'row between' },
      h('div', { class: 'stat' }, h('b', {}, `${acc}%`), h('span', {}, 'accuracy')),
      h('div', { class: 'stat' }, h('b', {}, `${round.correct}/${round.answered}`), h('span', {}, 'correct')),
      h('div', { class: 'stat' }, h('b', {}, `${ms.mastered}/${ms.total}`), h('span', {}, 'memorized')),
    ),
    h('div', { class: 'meter' }, Object.assign(h('i'), { style: `width:${ms.percent}%` })),
    round.mastered.length ? h('p', { class: 'howto' }, h('b', {}, 'Memorized: '), names(round.mastered)) : null,
    round.promoted.length ? h('p', { class: 'howto' }, h('b', {}, 'Moved up: '), names(round.promoted)) : null,
    round.demoted.length ? h('p', { class: 'howto' }, h('b', {}, 'Needs work: '), names(round.demoted)) : null,
    round.points > prevBest && prevBest > 0 ? h('p', { class: 'small muted' }, `New best round (was ${prevBest}).`) : null,
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '#progress' }, 'Progress'),
      h('button', { class: 'btn primary', onclick: () => { startRound(measuredIds()); renderQuestion(); } }, 'Another round'),
    ),
  )));
}

// ---------- Progress ----------
function renderProgress() {
  const p = state.progress;
  const ms = masteryStats(p, UNIT_IDS);
  const rows = UNITS.map((u) => {
    const up = p.units[u.id];
    const dots = h('span', { class: 'dots' }, [1, 2, 3, 4].map((l) => h('i', { class: up.mastered ? 'master' : l < up.level ? 'on' : '' })));
    const v = state.measurements[u.id];
    return h('div', { class: `unit-row ${up.mastered ? 'mastered' : ''}` },
      h('div', {}, h('div', { class: 'name' }, u.label), h('div', { class: 'small muted' }, up.mastered ? 'memorized' : `level ${up.level} · ${up.correct} right, ${up.wrong} wrong`)),
      h('span', { class: 'val' }, v ? formatInches(v) : '—'),
      dots,
    );
  });
  const acc = p.answered ? Math.round((p.answeredCorrect / p.answered) * 100) : 0;
  app.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'card' },
      h('h2', {}, 'Committed to memory'),
      h('div', { class: 'unit-name' }, `${ms.mastered} of ${ms.total}`),
      h('div', { class: 'meter' }, Object.assign(h('i'), { style: `width:${ms.percent}%` })),
      h('div', { class: 'row between' },
        h('div', { class: 'stat' }, h('b', {}, p.rounds), h('span', {}, 'rounds')),
        h('div', { class: 'stat' }, h('b', {}, p.totalPoints), h('span', {}, 'points')),
        h('div', { class: 'stat' }, h('b', {}, p.bestStreak), h('span', {}, 'best streak')),
        h('div', { class: 'stat' }, h('b', {}, `${acc}%`), h('span', {}, 'accuracy')),
      ),
      h('p', { class: 'small muted' }, 'A unit climbs one level per correct answer without hints: 2 choices, then 3, then 4 close together, then typed from memory. Typing it right in two separate rounds commits it. A miss drops it a level.'),
    ),
    h('div', { class: 'card' }, h('h2', {}, 'Units'), h('div', {}, rows)),
    h('div', { class: 'card' },
      h('div', { class: 'actions' },
        h('a', { class: 'btn primary', href: '#quiz' }, 'Quiz me'),
        h('button', { class: 'btn ghost', onclick: () => {
          if (!confirm('Reset quiz progress? Your measurements stay.')) return;
          state.progress = newProgress(UNIT_IDS);
          round = null;
          persist();
          route();
        } }, 'Reset progress'),
      ),
    ),
  ));
}

// ---------- service worker ----------
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('New version available. Tap to update.', { sticky: true, onClick: () => nw.postMessage({ type: 'SKIP_WAITING' }) });
          }
        });
      });
    }).catch(() => {});
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  });
}

registerSW();
route();
