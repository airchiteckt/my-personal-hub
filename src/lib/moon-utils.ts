/**
 * Calculate the moon phase for a given date.
 * Uses a simplified synodic month algorithm (29.53059 days).
 * Reference new moon: Jan 6, 2000 18:14 UTC.
 */

const SYNODIC_MONTH = 29.53058770576;
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();

export type MoonPhase = {
  name: string;
  nameIt: string;
  emoji: string;
  age: number; // days into cycle
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

  for (const phase of PHASES) {
    if (age < phase.maxAge) {
      return { name: phase.name, nameIt: phase.nameIt, emoji: phase.emoji, age };
    }
  }

  return { name: 'New Moon', nameIt: 'Luna Nuova', emoji: '🌑', age };
}
