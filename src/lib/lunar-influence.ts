/**
 * Lunar Influence Index (LII) v2
 *
 * Implements the spreadsheet-style formula with:
 *   - Circular time deltas (handles midnight wrap)
 *   - Robust isUp gate (handles moonrise > moonset wrap)
 *   - Sine-based altitude normalization
 *   - Gaussian bells for transit proximity and rise/set edges
 */

// Tunable parameters (matching spreadsheet J1–P1)
const ALPHA = 1.3;   // phase exponent
const BETA = 1.0;    // altitude exponent
const GAMMA = 1.0;   // culmination proximity exponent
const SIGMA = 2.5;   // culmination bell width (hours) — was 2.0
const RHO = 1.8;     // rise/set bell width (hours) — was 1.5
const K_RISE = 0.15; // boost near moonrise
const K_SET = 0.20;  // drag near moonset

export interface LIIInput {
  /** Current hour as fraction of day (0–24) */
  currentHour: number;
  /** Moonrise hour (0–24), null if no rise */
  riseHour: number | null;
  /** Moonset hour (0–24), null if no set */
  setHour: number | null;
  /** Transit/culmination hour (0–24), null if unknown */
  transitHour: number | null;
  /** Illumination percentage 0–100 */
  illumination: number;
  /** Altitude in degrees (can be negative) */
  altitude: number;
}

export interface LIIResult {
  /** Base LII before rise/set terms (0–1) */
  base: number;
  /** Extended LII with rise/set, floored at 0 */
  extended: number;
  /** Clamped 0–100 score for display */
  score: number;
  /** Human-readable level */
  level: 'nulla' | 'bassa' | 'moderata' | 'alta' | 'molto alta';
  /** Emoji indicator */
  emoji: string;
}

/** Circular distance in hours between two hour-of-day values (0–24 range) */
function circularDeltaHours(a: number, b: number): number {
  const frac_a = a / 24;
  const frac_b = b / 24;
  return Math.min(
    ((frac_a - frac_b) % 1 + 1) % 1,
    ((frac_b - frac_a) % 1 + 1) % 1
  ) * 24;
}

/** Robust isUp: handles moonrise after moonset (midnight wrap) */
function computeIsUp(currentHour: number, riseHour: number | null, setHour: number | null): boolean {
  if (riseHour === null || setHour === null) {
    // If we don't have rise/set, fall back to altitude check (caller handles)
    return false;
  }
  if (riseHour < setHour) {
    // Normal case: rise before set
    return currentHour >= riseHour && currentHour <= setHour;
  } else {
    // Wrap case: rise after set (moon crosses midnight)
    return currentHour >= riseHour || currentHour <= setHour;
  }
}

function gaussian(dt: number, sigma: number): number {
  return Math.exp(-Math.pow(dt / sigma, 2));
}

export function calculateLII(input: LIIInput): LIIResult {
  const { currentHour, riseHour, setHour, transitHour, illumination, altitude } = input;

  // 1) f — phase normalized
  const f = illumination / 100;

  // 2) isUp — robust with midnight wrap; fallback to altitude if no rise/set
  const isUp = (riseHour !== null && setHour !== null)
    ? computeIsUp(currentHour, riseHour, setHour)
    : altitude > -0.833;
  const isUpGate = isUp ? 1 : 0;

  // 3) a — altitude normalized with sine
  const a = Math.max(0, Math.sin((Math.PI / 180) * Math.max(0, altitude)));

  // 4) Δt — circular hours from transit
  const deltaTransit = transitHour !== null
    ? circularDeltaHours(currentHour, transitHour)
    : 12;

  // 5) c — culmination bell
  const c = gaussian(deltaTransit, SIGMA);

  // 6) LII base = isUp · f^α · a^β · c^γ
  const base = isUpGate * Math.pow(f, ALPHA) * Math.pow(a, BETA) * Math.pow(c, GAMMA);

  // 7) Δrise and Δset — circular hours
  const deltaRise = riseHour !== null ? circularDeltaHours(currentHour, riseHour) : null;
  const deltaSet = setHour !== null ? circularDeltaHours(currentHour, setHour) : null;

  // 8) r and s — gaussian bells
  const r = deltaRise !== null ? gaussian(deltaRise, RHO) : 0;
  const s = deltaSet !== null ? gaussian(deltaSet, RHO) : 0;

  // 9) LII_ext = MAX(0, base + k_r·r - k_s·s)
  const extended = Math.max(0, base + K_RISE * r - K_SET * s);

  // Score 0–100
  const score = Math.round(Math.min(1, extended) * 100);

  let level: LIIResult['level'];
  let emoji: string;
  if (score === 0) { level = 'nulla'; emoji = '⚫'; }
  else if (score <= 25) { level = 'bassa'; emoji = '🔵'; }
  else if (score <= 50) { level = 'moderata'; emoji = '🟡'; }
  else if (score <= 75) { level = 'alta'; emoji = '🟠'; }
  else { level = 'molto alta'; emoji = '🔴'; }

  return { base, extended, score, level, emoji };
}

// ── Energia Attesa (Expected Energy) 0–10 ──
// Anti-saturation model: linear combination → single sigmoid → 0–10

// Weights
const W0 = -2.2;   // intercept (bias)
const W_L = 3.0;    // LII weight
const W_B = 0.9;    // evening boost weight
const W_F = 1.2;    // full moon proximity boost
const W_C = 1.4;    // post-full-moon crash weight

// Shape parameters
const EVENING_CENTER = 23;
const EVENING_WIDTH = 2.5;
const FULLMOON_SIGMA = 16;         // full moon boost bell width (hours)
const CRASH_CENTER = 18;           // crash bell centered 18h after full moon
const CRASH_SIGMA = 8;             // crash bell width (hours)

export interface EnergiaAttesaInput {
  /** LII score 0–100 */
  lii: number;
  /** Current hour as fraction of day (0–24) */
  currentHour: number;
  /** Hours distance to nearest full moon (signed: negative=past, positive=future), null if unknown */
  hoursToFullMoon: number | null;
}

export interface EnergiaAttesaResult {
  /** Raw logit x(t) before sigmoid */
  raw: number;
  /** Clamped 0–10 score */
  score: number;
  /** Human-readable level */
  level: 'minima' | 'bassa' | 'moderata' | 'alta' | 'massima';
  /** Emoji */
  emoji: string;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function calculateEnergiaAttesa(input: EnergiaAttesaInput): EnergiaAttesaResult {
  const { lii, currentHour, hoursToFullMoon } = input;

  // Evening boost bell
  const B = Math.exp(-Math.pow((currentHour - EVENING_CENTER) / EVENING_WIDTH, 2));

  // Full moon proximity boost (absolute Δf)
  const deltaF = hoursToFullMoon !== null ? Math.abs(hoursToFullMoon) : 999;
  const FMP = Math.exp(-Math.pow(deltaF / FULLMOON_SIGMA, 2));

  // Post-full-moon crash bell centered at CRASH_CENTER hours after full moon
  const crash = Math.exp(-Math.pow((deltaF - CRASH_CENTER) / CRASH_SIGMA, 2));

  // Linear combination → single sigmoid
  const x = W0 + W_L * (lii / 100) + W_B * B + W_F * FMP - W_C * crash;

  // Single sigmoid → 0–10
  const raw = x;
  const score = Math.round(10 * sigmoid(x) * 10) / 10;

  let level: EnergiaAttesaResult['level'];
  let emoji: string;
  if (score <= 1) { level = 'minima'; emoji = '😴'; }
  else if (score <= 3) { level = 'bassa'; emoji = '🧘'; }
  else if (score <= 5) { level = 'moderata'; emoji = '⚡'; }
  else if (score <= 7.5) { level = 'alta'; emoji = '🔥'; }
  else { level = 'massima'; emoji = '🚀'; }

  return { raw, score, level, emoji };
}

/**
 * Calculate Energia Attesa samples throughout a day (every 30 min) for charting.
 */
export function getEnergiaDaySamples(
  hoursToFullMoon: number | null,
  getLIIAtHour: (hour: number) => number
): { hour: number; energia: number }[] {
  const result: { hour: number; energia: number }[] = [];
  for (let minutes = 0; minutes <= 1440; minutes += 30) {
    const h = minutes / 60;
    const lii = getLIIAtHour(h);
    const e = calculateEnergiaAttesa({ lii, currentHour: h, hoursToFullMoon });
    result.push({ hour: Math.round(h * 10) / 10, energia: e.score });
  }
  return result;
}

/**
 * Calculate LII samples throughout a day (every 30 min) for charting.
 * Accepts precomputed rise/set/transit to avoid redundant calculations.
 */
export function getLIIDaySamples(
  illumination: number,
  riseHour: number | null,
  setHour: number | null,
  transitHour: number | null,
  getAltitudeAtHour: (hour: number) => number
): { hour: number; lii: number }[] {
  const result: { hour: number; lii: number }[] = [];

  for (let minutes = 0; minutes <= 1440; minutes += 30) {
    const h = minutes / 60;
    const alt = getAltitudeAtHour(h);

    const lii = calculateLII({
      currentHour: h,
      riseHour,
      setHour,
      transitHour,
      illumination,
      altitude: alt,
    });

    result.push({ hour: Math.round(h * 10) / 10, lii: lii.score });
  }

  return result;
}
