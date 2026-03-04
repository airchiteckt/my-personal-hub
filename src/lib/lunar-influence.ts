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
