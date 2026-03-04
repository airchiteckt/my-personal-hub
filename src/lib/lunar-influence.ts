/**
 * Lunar Influence Index (LII) — calculates a 0–1 index representing
 * the moon's perceived influence at a given moment, based on:
 *   - Phase (illumination)
 *   - Presence above horizon (gate)
 *   - Altitude
 *   - Distance from culmination
 *   - Proximity to rise/set events (boost/drag)
 */

// Tunable parameters
const ALPHA = 1.3;   // phase exponent
const BETA = 1.0;    // altitude exponent
const GAMMA = 1.0;   // culmination proximity exponent
const SIGMA = 2.0;   // culmination bell width (hours)
const RHO = 1.5;     // rise/set bell width (hours)
const K_RISE = 0.15; // boost near moonrise
const K_SET = 0.20;  // drag near moonset

function gaussian(dt: number, sigma: number): number {
  return Math.exp(-Math.pow(dt / sigma, 2));
}

export interface LIIInput {
  /** Illumination percentage 0-100 */
  illumination: number;
  /** Current altitude in degrees (-90 to 90) */
  altitude: number;
  /** Whether moon is above horizon */
  isAboveHorizon: boolean;
  /** Hours from culmination (abs value) */
  hoursFromTransit: number;
  /** Hours from moonrise (abs value), null if no rise today */
  hoursFromRise: number | null;
  /** Hours from moonset (abs value), null if no set today */
  hoursFromSet: number | null;
}

export interface LIIResult {
  /** Base LII (0-1) */
  base: number;
  /** Extended LII with rise/set effects (can be slightly negative) */
  extended: number;
  /** Clamped 0-100 score for display */
  score: number;
  /** Human-readable level */
  level: 'nulla' | 'bassa' | 'moderata' | 'alta' | 'molto alta';
  /** Emoji indicator */
  emoji: string;
}

export function calculateLII(input: LIIInput): LIIResult {
  const { illumination, altitude, isAboveHorizon, hoursFromTransit, hoursFromRise, hoursFromSet } = input;

  // A) Phase normalization
  const f = Math.pow(illumination / 100, ALPHA);

  // B) Presence gate
  const isUp = isAboveHorizon ? 1 : 0;

  // C) Altitude (sine-based for realism)
  const a = Math.pow(Math.max(0, Math.sin((Math.PI / 180) * Math.max(0, altitude))), BETA);

  // D) Culmination proximity (bell curve)
  const c = Math.pow(gaussian(hoursFromTransit, SIGMA), GAMMA);

  // Base LII
  const base = isUp * f * a * c;

  // E) Rise/set boost/drag
  const riseBoost = hoursFromRise !== null ? K_RISE * gaussian(hoursFromRise, RHO) : 0;
  const setDrag = hoursFromSet !== null ? K_SET * gaussian(hoursFromSet, RHO) : 0;

  const extended = base + riseBoost - setDrag;

  // Clamp to 0-1 for display
  const clamped = Math.max(0, Math.min(1, extended));
  const score = Math.round(clamped * 100);

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
 */
export function getLIIDaySamples(
  date: Date,
  latitude: number,
  longitude: number,
  getMoonDataAtHour: (date: Date, hour: number, lat: number, lon: number) => {
    altitude: number;
    illumination: number;
    transitHour: number | null;
    riseHour: number | null;
    setHour: number | null;
  }
): { hour: number; lii: number }[] {
  const result: { hour: number; lii: number }[] = [];

  for (let minutes = 0; minutes <= 1440; minutes += 30) {
    const h = minutes / 60;
    const data = getMoonDataAtHour(date, h, latitude, longitude);

    const isAboveHorizon = data.altitude > -0.833;
    const hoursFromTransit = data.transitHour !== null ? Math.abs(h - data.transitHour) : 12;
    const hoursFromRise = data.riseHour !== null ? Math.abs(h - data.riseHour) : null;
    const hoursFromSet = data.setHour !== null ? Math.abs(h - data.setHour) : null;

    const lii = calculateLII({
      illumination: data.illumination,
      altitude: data.altitude,
      isAboveHorizon,
      hoursFromTransit,
      hoursFromRise,
      hoursFromSet,
    });

    result.push({ hour: Math.round(h * 10) / 10, lii: lii.score });
  }

  return result;
}
