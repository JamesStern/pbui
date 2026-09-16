// localStorage persistence. One JSON blob under a versioned key.
const KEY = 'pbui.v1';

export function defaultState() {
  return {
    measurements: {},   // unitId -> decimal inches
    progress: null,     // quiz progress (see quiz.js)
    wizardIndex: 0,     // where the measure wizard left off
    version: 1,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    return { ...defaultState(), ...data };
  } catch (e) {
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode, quota: ignore */
  }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function exportJSON(state) {
  return JSON.stringify({ app: 'pbui', exported: new Date().toISOString(), ...state }, null, 2);
}

/** Returns the imported state, or throws with a readable message. */
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.measurements) throw new Error('That file does not look like a PBUI export.');
  const measurements = {};
  for (const [k, v] of Object.entries(data.measurements)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) measurements[k] = n;
  }
  return { ...defaultState(), ...data, measurements };
}
