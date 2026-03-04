/**
 * Moon phase, rise, set, and transit calculations.
 * Uses simplified astronomical algorithms based on Meeus "Astronomical Algorithms".
 */

const SYNODIC_MONTH = 29.53058770576;
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export type MoonPhase = {
  name: string;
  nameIt: string;
  emoji: string;
  age: number; // days into cycle
  illumination: number; // 0-100%
};

export type MoonTimes = {
  rise: string | null;   // HH:mm or null if doesn't rise
  set: string | null;    // HH:mm or null if doesn't set
  transit: string | null; // HH:mm culmination
  transitAltitude: number; // degrees above horizon at transit
};

const PHASES: { maxAge: number; name: string; nameIt: string; emoji: string }[] = [
  { maxAge: 1.84566,  name: 'New Moon',        nameIt: 'Luna Nuova',          emoji: '🌑' },
  { maxAge: 5.53699,  name: 'Waxing Crescent', nameIt: 'Luna Crescente',      emoji: '🌒' },
  { maxAge: 9.22831,  name: 'First Quarter',   nameIt: 'Primo Quarto',        emoji: '🌓' },
  { maxAge: 12.91963, name: 'Waxing Gibbous',  nameIt: 'Gibbosa Crescente',   emoji: '🌔' },
  { maxAge: 16.61096, name: 'Full Moon',        nameIt: 'Luna Piena',          emoji: '🌕' },
  { maxAge: 20.30228, name: 'Waning Gibbous',  nameIt: 'Gibbosa Calante',     emoji: '🌖' },
  { maxAge: 23.99361, name: 'Last Quarter',     nameIt: 'Ultimo Quarto',       emoji: '🌗' },
  { maxAge: 27.68493, name: 'Waning Crescent',  nameIt: 'Luna Calante',        emoji: '🌘' },
  { maxAge: SYNODIC_MONTH, name: 'New Moon',    nameIt: 'Luna Nuova',          emoji: '🌑' },
];

export function getMoonPhase(date: Date): MoonPhase {
  const diff = date.getTime() - KNOWN_NEW_MOON;
  const daysSince = diff / (1000 * 60 * 60 * 24);
  const age = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * age / SYNODIC_MONTH)) / 2 * 100);

  for (const phase of PHASES) {
    if (age < phase.maxAge) {
      return { name: phase.name, nameIt: phase.nameIt, emoji: phase.emoji, age, illumination };
    }
  }

  return { name: 'New Moon', nameIt: 'Luna Nuova', emoji: '🌑', age, illumination: 0 };
}

// ---- Low-precision lunar position (Meeus simplified) ----

function toJulianDay(date: Date): number {
  const ms = date.getTime();
  return ms / 86400000 + 2440587.5;
}

function moonPosition(jd: number): { ra: number; dec: number; dist: number } {
  // Centuries from J2000.0
  const T = (jd - 2451545.0) / 36525.0;

  // Moon's mean longitude (deg)
  const L0 = (218.3164477 + 481267.88123421 * T - 0.0015786 * T * T) % 360;
  // Mean anomaly (deg)
  const M = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) % 360;
  // Mean elongation (deg)
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) % 360;
  // Argument of latitude (deg)
  const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) % 360;
  // Sun's mean anomaly
  const Ms = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) % 360;

  // Longitude corrections (simplified)
  let dL = 0;
  dL += 6.289 * Math.sin(M * DEG);
  dL += 1.274 * Math.sin((2 * D - M) * DEG);
  dL += 0.658 * Math.sin(2 * D * DEG);
  dL += 0.214 * Math.sin(2 * M * DEG);
  dL -= 0.186 * Math.sin(Ms * DEG);
  dL -= 0.114 * Math.sin(2 * F * DEG);

  const lon = ((L0 + dL) % 360 + 360) % 360;

  // Latitude corrections (simplified)
  let dB = 0;
  dB += 5.128 * Math.sin(F * DEG);
  dB += 0.281 * Math.sin((M + F) * DEG);
  dB += 0.278 * Math.sin((M - F) * DEG);

  const lat = dB;

  // Distance (km, simplified)
  let dR = 0;
  dR -= 20.905 * Math.cos(M * DEG);
  dR -= 3.699 * Math.cos((2 * D - M) * DEG);
  dR -= 2.956 * Math.cos(2 * D * DEG);
  const dist = 385000.56 + dR * 1000;

  // Ecliptic to equatorial
  const obliquity = 23.4393 - 0.0130 * T;
  const lonRad = lon * DEG;
  const latRad = lat * DEG;
  const oblRad = obliquity * DEG;

  const ra = Math.atan2(
    Math.sin(lonRad) * Math.cos(oblRad) - Math.tan(latRad) * Math.sin(oblRad),
    Math.cos(lonRad)
  ) * RAD;

  const dec = Math.asin(
    Math.sin(latRad) * Math.cos(oblRad) + Math.cos(latRad) * Math.sin(oblRad) * Math.sin(lonRad)
  ) * RAD;

  return { ra: ((ra % 360) + 360) % 360, dec, dist };
}

function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let s = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  return ((s % 360) + 360) % 360;
}

function hourAngle(ra: number, lst: number): number {
  let ha = lst - ra;
  if (ha < -180) ha += 360;
  if (ha > 180) ha -= 360;
  return ha;
}

function altitude(ha: number, dec: number, lat: number): number {
  return Math.asin(
    Math.sin(lat * DEG) * Math.sin(dec * DEG) +
    Math.cos(lat * DEG) * Math.cos(dec * DEG) * Math.cos(ha * DEG)
  ) * RAD;
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m >= 60 ? 59 : m).padStart(2, '0')}`;
}

/**
 * Calculate moon rise, set, and transit times for a given date and location.
 * Uses iterative approach sampling altitude through the day.
 */
export function getMoonTimes(date: Date, latitude: number, longitude: number): MoonTimes {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Sample every 10 minutes through the day (144 samples)
  const samples: { hour: number; alt: number; ha: number }[] = [];
  
  for (let minutes = 0; minutes <= 1440; minutes += 10) {
    const h = minutes / 60;
    const sampleDate = new Date(year, month, day, 0, minutes, 0);
    const jd = toJulianDay(sampleDate);
    const pos = moonPosition(jd);
    const siderealTime = gmst(jd) + longitude;
    const ha = hourAngle(pos.ra, siderealTime);
    const alt = altitude(ha, pos.dec, latitude);
    samples.push({ hour: h, alt, ha });
  }

  // Find rise (alt crosses from negative to positive)
  let rise: string | null = null;
  let set: string | null = null;
  let transitHour: number | null = null;
  let maxAlt = -90;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];

    // Rise: crosses -0.833° (refraction correction) upward
    if (prev.alt < -0.833 && curr.alt >= -0.833 && !rise) {
      // Linear interpolation
      const fraction = (-0.833 - prev.alt) / (curr.alt - prev.alt);
      const riseHour = prev.hour + fraction * (curr.hour - prev.hour);
      rise = formatTime(riseHour);
    }

    // Set: crosses -0.833° downward
    if (prev.alt >= -0.833 && curr.alt < -0.833 && !set) {
      const fraction = (-0.833 - prev.alt) / (curr.alt - prev.alt);
      const setHour = prev.hour + fraction * (curr.hour - prev.hour);
      set = formatTime(setHour);
    }

    // Track maximum altitude for transit
    if (curr.alt > maxAlt) {
      maxAlt = curr.alt;
      transitHour = curr.hour;
    }
  }

  return {
    rise,
    set,
    transit: transitHour !== null ? formatTime(transitHour) : null,
    transitAltitude: Math.round(maxAlt * 10) / 10,
  };
}

/**
 * Get moon altitude samples throughout the day (every 30 min) for charting.
 */
export function getMoonAltitudeSamples(date: Date, latitude: number, longitude: number): { hour: number; altitude: number }[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const result: { hour: number; altitude: number }[] = [];

  for (let minutes = 0; minutes <= 1440; minutes += 30) {
    const h = minutes / 60;
    const sampleDate = new Date(year, month, day, 0, minutes, 0);
    const jd = toJulianDay(sampleDate);
    const pos = moonPosition(jd);
    const siderealTime = gmst(jd) + longitude;
    const ha = hourAngle(pos.ra, siderealTime);
    const alt = altitude(ha, pos.dec, latitude);
    result.push({ hour: Math.round(h * 10) / 10, altitude: Math.round(alt * 10) / 10 });
  }

  return result;
}

/**
 * Get moon data at a specific hour of a given day (used by LII calculator).
 * Optionally accepts pre-computed times to avoid redundant getMoonTimes calls.
 */
export function getMoonDataAtHour(
  date: Date, hour: number, lat: number, lon: number,
  precomputedTimes?: MoonTimes
): {
  altitude: number;
  illumination: number;
  transitHour: number | null;
  riseHour: number | null;
  setHour: number | null;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const minutes = hour * 60;
  const sampleDate = new Date(year, month, day, 0, minutes, 0);
  const jd = toJulianDay(sampleDate);
  const pos = moonPosition(jd);
  const siderealTime = gmst(jd) + lon;
  const ha = hourAngle(pos.ra, siderealTime);
  const alt = altitude(ha, pos.dec, lat);

  const phase = getMoonPhase(sampleDate);

  const times = precomputedTimes ?? getMoonTimes(date, lat, lon);
  const parseTime = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h + m / 60;
  };

  return {
    altitude: alt,
    illumination: phase.illumination,
    transitHour: parseTime(times.transit),
    riseHour: parseTime(times.rise),
    setHour: parseTime(times.set),
  };
}

/**
 * Get next major moon events (next full moon, next new moon)
 */
export function getNextMoonEvents(date: Date): { nextFull: Date; nextNew: Date } {
  const phase = getMoonPhase(date);
  const daysToFull = phase.age < (SYNODIC_MONTH / 2)
    ? (SYNODIC_MONTH / 2) - phase.age
    : SYNODIC_MONTH - phase.age + (SYNODIC_MONTH / 2);
  const daysToNew = SYNODIC_MONTH - phase.age;

  return {
    nextFull: new Date(date.getTime() + daysToFull * 86400000),
    nextNew: new Date(date.getTime() + daysToNew * 86400000),
  };
}

/**
 * Get the zodiac sign the moon is currently in (simplified)
 */
export function getMoonZodiac(date: Date): { sign: string; signIt: string; emoji: string } {
  const jd = toJulianDay(date);
  const pos = moonPosition(jd);
  // Approximate ecliptic longitude from RA (simplified)
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = (218.3164477 + 481267.88123421 * T) % 360;
  const M = (134.9633964 + 477198.8675055 * T) % 360;
  const D = (297.8501921 + 445267.1114034 * T) % 360;
  const Ms = (357.5291092 + 35999.0502909 * T) % 360;
  const F = (93.2720950 + 483202.0175233 * T) % 360;
  let dL = 6.289 * Math.sin(M * DEG) + 1.274 * Math.sin((2 * D - M) * DEG) + 0.658 * Math.sin(2 * D * DEG);
  dL += 0.214 * Math.sin(2 * M * DEG) - 0.186 * Math.sin(Ms * DEG) - 0.114 * Math.sin(2 * F * DEG);
  const lon = ((L0 + dL) % 360 + 360) % 360;

  const signs = [
    { sign: 'Aries', signIt: 'Ariete', emoji: '♈' },
    { sign: 'Taurus', signIt: 'Toro', emoji: '♉' },
    { sign: 'Gemini', signIt: 'Gemelli', emoji: '♊' },
    { sign: 'Cancer', signIt: 'Cancro', emoji: '♋' },
    { sign: 'Leo', signIt: 'Leone', emoji: '♌' },
    { sign: 'Virgo', signIt: 'Vergine', emoji: '♍' },
    { sign: 'Libra', signIt: 'Bilancia', emoji: '♎' },
    { sign: 'Scorpio', signIt: 'Scorpione', emoji: '♏' },
    { sign: 'Sagittarius', signIt: 'Sagittario', emoji: '♐' },
    { sign: 'Capricorn', signIt: 'Capricorno', emoji: '♑' },
    { sign: 'Aquarius', signIt: 'Acquario', emoji: '♒' },
    { sign: 'Pisces', signIt: 'Pesci', emoji: '♓' },
  ];

  const idx = Math.floor(lon / 30) % 12;
  return signs[idx];
}
