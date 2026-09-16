// Parsing and formatting of measurements. Everything is stored as decimal inches.
// Pure: no DOM, no state.

const SIXTEENTH = 1 / 16;

export function roundTo16(n) {
  return Math.round(n * 16) / 16;
}

function parseFractionToken(tok) {
  // "1/2", "3/8", "18", "18.5"
  const frac = tok.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (!den) return null;
    return Number(frac[1]) / den;
  }
  if (/^\d*\.?\d+$/.test(tok)) return Number(tok);
  return null;
}

function parseNumberWithFraction(s) {
  // "18", "18.5", "18 1/2", "18-1/2", "1 3/8", "7/8"
  s = s.trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  const parts = s.split(' ');
  if (parts.length === 1) return parseFractionToken(parts[0]);
  if (parts.length === 2) {
    const a = parseFractionToken(parts[0]);
    const b = parseFractionToken(parts[1]);
    if (a === null || b === null) return null;
    if (!/\//.test(parts[1])) return null; // "18 5" is ambiguous, reject
    return a + b;
  }
  return null;
}

/**
 * Parse a measurement typed by a person. Returns decimal inches, or null.
 * Accepts: 18 | 18.5 | 18 1/2 | 18-1/2 | 7/8 | 7'9" | 7' 9 1/2" | 6 ft 1 in | 93" | 93 in
 *          180 cm | 1.8 m | 45mm
 */
export function parseInches(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).toLowerCase().trim();
  if (!s) return null;
  s = s.replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/,/g, '.');
  s = s.replace(/(\d)\s*-\s*(\d)/g, '$1 $2'); // 18-1/2 -> 18 1/2
  // fancy fractions
  const vulgar = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8', '⅓': ' 1/3', '⅔': ' 2/3', '⅙': ' 1/6', '⅚': ' 5/6', '⅕': ' 1/5', '⅖': ' 2/5', '⅗': ' 3/5', '⅘': ' 4/5' };
  s = s.replace(/[½¼¾⅛⅜⅝⅞⅓⅔⅙⅚⅕⅖⅗⅘]/g, (m) => vulgar[m]);

  // metric
  let m = s.match(/^([\d.\s/]+?)\s*(mm|cm|m|millimet\w*|centimet\w*|met\w*)$/);
  if (m) {
    const v = parseNumberWithFraction(m[1]);
    if (v === null) return null;
    const unit = m[2];
    if (unit.startsWith('mm') || unit.startsWith('millimet')) return v / 25.4;
    if (unit.startsWith('cm') || unit.startsWith('centimet')) return v / 2.54;
    return (v * 100) / 2.54; // metres
  }

  // feet and inches: 7'9", 7' 9 1/2", 7 ft 9 in, 6ft, 6'
  m = s.match(/^([\d.]+)\s*(?:'|ft\.?|feet|foot)\s*([\d.\s/]*?)\s*(?:"|in\.?|inch(?:es)?)?$/);
  if (m) {
    const feet = Number(m[1]);
    const rest = m[2].trim();
    const inches = rest ? parseNumberWithFraction(rest) : 0;
    if (Number.isNaN(feet) || inches === null) return null;
    return feet * 12 + inches;
  }

  // inches with optional unit suffix
  m = s.match(/^([\d.\s/]+?)\s*(?:"|in\.?|inch(?:es)?)?$/);
  if (m) return parseNumberWithFraction(m[1]);
  return null;
}

/** {whole, num, den} for n rounded to the nearest 1/16, fraction reduced. */
export function fractionParts(n) {
  const total = Math.round(n * 16);
  const whole = Math.floor(total / 16);
  let num = total - whole * 16;
  let den = 16;
  while (num > 0 && num % 2 === 0) { num /= 2; den /= 2; }
  return { whole, num, den };
}

/** Poster-style: 71" | 18 1/2" | 7/8" | 1 3/8" */
export function formatInches(n, { quote = true } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const { whole, num, den } = fractionParts(n);
  let s;
  if (num === 0) s = String(whole);
  else if (whole === 0) s = `${num}/${den}`;
  else s = `${whole} ${num}/${den}`;
  return quote ? `${s}"` : s;
}

/** Secondary readings shown under a value: feet+inches for big ones, cm always. */
export function formatAlt(n) {
  if (n === null || n === undefined) return '';
  const cm = (n * 2.54).toFixed(1).replace(/\.0$/, '');
  if (n >= 24) {
    const ft = Math.floor(n / 12);
    const rest = n - ft * 12;
    return `${ft}′ ${formatInches(rest, { quote: false })}″ · ${cm} cm`;
  }
  return `${cm} cm`;
}

/** True when a and b agree to within a sixteenth of an inch. */
export function sameMeasurement(a, b) {
  return Math.abs(a - b) <= SIXTEENTH + 1e-9;
}
