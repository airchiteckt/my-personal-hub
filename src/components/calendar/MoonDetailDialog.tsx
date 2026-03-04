import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMoonPhase, getMoonTimes, getNextMoonEvents, getMoonAltitudeSamples, getMoonDataAtHour, type MoonTimes as MoonTimesType } from '@/lib/moon-utils';
import { calculateLII, getLIIDaySamples, calculateEnergiaAttesa, getEnergiaDaySamples, type LIIResult, type EnergiaAttesaResult } from '@/lib/lunar-influence';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ComposedChart, Line } from 'recharts';
import { usePrp } from '@/context/PrpContext';

const TIME_SLOTS = [
  { key: 'morning' as const, label: 'Mattina', icon: '🌅', hours: [8, 9, 10, 11] },
  { key: 'afternoon' as const, label: 'Pomeriggio', icon: '☀️', hours: [13, 14, 15, 16] },
  { key: 'evening' as const, label: 'Sera', icon: '🌙', hours: [20, 21, 22, 23] },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
}

export function MoonDetailDialog({ open, onOpenChange, date }: Props) {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState('Posizione non disponibile');

  useEffect(() => {
    if (open && !location) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationName(`${pos.coords.latitude.toFixed(2)}°N, ${pos.coords.longitude.toFixed(2)}°E`);
        },
        () => {
          // Default: Rome
          setLocation({ lat: 41.9028, lon: 12.4964 });
          setLocationName('Roma (default)');
        },
        { timeout: 5000 }
      );
    }
  }, [open, location]);

  const phase = getMoonPhase(date);
  const nextEvents = getNextMoonEvents(date);
  const times = location ? getMoonTimes(date, location.lat, location.lon) : null;
  const altitudeSamples = useMemo(
    () => location ? getMoonAltitudeSamples(date, location.lat, location.lon) : [],
    [date, location]
  );

  // Parse times to hours
  const parseTime = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h + m / 60;
  };
  const riseHour = times ? parseTime(times.rise) : null;
  const setHour = times ? parseTime(times.set) : null;
  const transitHour = times ? parseTime(times.transit) : null;

  // LII: current value
  const currentLII = useMemo<LIIResult | null>(() => {
    if (!location || !times) return null;
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const data = getMoonDataAtHour(date, currentHour, location.lat, location.lon, times);
    return calculateLII({
      currentHour,
      riseHour,
      setHour,
      transitHour,
      illumination: data.illumination,
      altitude: data.altitude,
    });
  }, [date, location, times, riseHour, setHour, transitHour]);

  // Full moon timing: nearest (for proximity boost) and post (for crash)
  const { hoursToFullMoon, hoursPostFullMoon } = useMemo(() => {
    const now = new Date();
    const hoursToNext = (nextEvents.nextFull.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Previous full moon: ~synodic month before the next one
    const prevFull = new Date(nextEvents.nextFull.getTime() - 29.53059 * 24 * 60 * 60 * 1000);
    const hoursSincePrev = (now.getTime() - prevFull.getTime()) / (1000 * 60 * 60);
    // Nearest (absolute) for proximity boost
    const hoursToFullMoon = Math.min(Math.abs(hoursToNext), Math.abs(hoursSincePrev));
    // Post: hours since the most recent full moon (always ≥ 0)
    const hoursPostFullMoon = hoursToNext > 0
      ? hoursSincePrev  // next is in the future → prev is the most recent
      : Math.abs(hoursToNext); // next is in the past (shouldn't happen, but safe)
    return { hoursToFullMoon, hoursPostFullMoon };
  }, [nextEvents.nextFull]);

  // Energia Attesa: current value (with LII derivative)
  const currentEnergia = useMemo<EnergiaAttesaResult | null>(() => {
    if (!currentLII || !location || !times) return null;
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    // Compute LII 1h ago for derivative
    const hourAgo = ((currentHour - 1) + 24) % 24;
    const dataAgo = getMoonDataAtHour(date, hourAgo, location.lat, location.lon, times);
    const liiAgo = calculateLII({
      currentHour: hourAgo, riseHour, setHour, transitHour,
      illumination: dataAgo.illumination, altitude: dataAgo.altitude,
    });
    const dLIIScore = (currentLII.score - liiAgo.score); // per-hour (1h delta)
    return calculateEnergiaAttesa({
      liiExt: currentLII.extended,
      currentHour,
      hoursPostFullMoon,
      hoursToFullMoon,
      moonAge: phase.age,
      illuminationFrac: phase.illumination / 100,
      dLIIScore,
      transitHour,
      riseHour,
    });
  }, [currentLII, location, times, date, riseHour, setHour, transitHour, hoursToFullMoon, hoursPostFullMoon, phase.age, phase.illumination]);

  // LII: day samples for chart
  const liiSamples = useMemo(() => {
    if (!location || !times) return [];
    const illum = phase.illumination;
    const getAlt = (hour: number) => {
      const data = getMoonDataAtHour(date, hour, location.lat, location.lon, times);
      return data.altitude;
    };
    return getLIIDaySamples(illum, riseHour, setHour, transitHour, getAlt);
  }, [date, location, times, phase.illumination, riseHour, setHour, transitHour]);

  // Energia Attesa: day samples for chart (uses LII_ext continuous, not score)
  const energiaSamples = useMemo(() => {
    if (!location || !times) return [];
    const illum = phase.illumination;
    const computeLII = (hour: number) => {
      const data = getMoonDataAtHour(date, hour, location.lat, location.lon, times);
      return calculateLII({
        currentHour: hour,
        riseHour, setHour, transitHour,
        illumination: illum,
        altitude: data.altitude,
      });
    };
    const getLIIExtAtHour = (hour: number) => computeLII(hour).extended;
    const getLIIScoreAtHour = (hour: number) => computeLII(hour).score;
    return getEnergiaDaySamples(hoursToFullMoon, hoursPostFullMoon, phase.age, phase.illumination / 100, transitHour, getLIIScoreAtHour, getLIIExtAtHour, riseHour);
  }, [date, location, times, phase.illumination, phase.age, riseHour, setHour, transitHour, hoursToFullMoon, hoursPostFullMoon]);

  // Compute max altitude to scale LII onto the same axis
  const maxAlt = useMemo(() => {
    if (altitudeSamples.length === 0) return 90;
    return Math.max(10, ...altitudeSamples.map(s => Math.abs(s.altitude)));
  }, [altitudeSamples]);

  // Merge altitude + LII + Energia for combined chart, scaling to altitude range
  const combinedSamples = useMemo(() => {
    if (altitudeSamples.length === 0) return [];
    return altitudeSamples.map((s, i) => ({
      hour: s.hour,
      altitude: s.altitude,
      lii: liiSamples[i]?.lii ?? 0,
      liiScaled: ((liiSamples[i]?.lii ?? 0) / 100) * maxAlt,
      energia: energiaSamples[i]?.energia ?? 0,
      energiaScaled: ((energiaSamples[i]?.energia ?? 0) / 10) * maxAlt,
    }));
  }, [altitudeSamples, liiSamples, energiaSamples, maxAlt]);

  const dateLabel = format(date, 'EEEE d MMMM yyyy', { locale: it });
  const dateStr = format(date, 'yyyy-MM-dd');

  // Journal entry for this date
  const { getJournalForDate } = usePrp();
  const journalEntry = getJournalForDate(dateStr);

  // Slot predictions for correlation
  const slotPredictions = useMemo(() => {
    if (!location || !times) return [];
    const lat = location.lat, lon = location.lon;
    return TIME_SLOTS.map(slot => {
      const centerHour = slot.hours[Math.floor(slot.hours.length / 2)];
      const moonData = getMoonDataAtHour(date, centerHour, lat, lon, times);
      const lii = calculateLII({
        currentHour: centerHour, riseHour, setHour, transitHour,
        illumination: moonData.illumination, altitude: moonData.altitude,
      });
      const energia = calculateEnergiaAttesa({
        liiExt: lii.extended, currentHour: centerHour,
        hoursPostFullMoon, hoursToFullMoon, moonAge: phase.age,
        illuminationFrac: phase.illumination / 100, dLIIScore: 0, transitHour, riseHour,
      });
      return { slot: slot.key, predicted: energia.score, liiScore: lii.score };
    });
  }, [date, location, times, riseHour, setHour, transitHour, hoursToFullMoon, hoursPostFullMoon, phase]);

  // Accuracy computation
  const correlationAccuracy = useMemo(() => {
    if (!journalEntry) return null;
    const actual = [journalEntry.energyMorning, journalEntry.energyAfternoon, journalEntry.energyEvening];
    const predicted = slotPredictions.map(p => p.predicted);
    const pairs = actual.map((a, i) => a != null ? { actual: a, predicted: predicted[i] } : null).filter(Boolean) as { actual: number; predicted: number }[];
    if (pairs.length === 0) return null;
    const mae = pairs.reduce((s, p) => s + Math.abs(p.actual - p.predicted), 0) / pairs.length;
    return { mae: Math.round(mae * 10) / 10, count: pairs.length };
  }, [journalEntry, slotPredictions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="text-3xl">{phase.emoji}</span>
            Analisi Lunare
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Date */}
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>

          {/* Phase info */}
          <div className="bg-accent/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{phase.nameIt}</span>
              <span className="text-xs text-muted-foreground">Giorno {Math.round(phase.age)} / 29</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/60 rounded-full transition-all"
                    style={{ width: `${phase.illumination}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold">{phase.illumination}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Illuminazione</p>
          </div>


          {/* Rise / Set / Transit */}
          {times ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <span className="text-lg">🌅</span>
                <p className="text-sm font-bold mt-1">{times.rise || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Sorge</p>
              </div>
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <span className="text-lg">⬆️</span>
                <p className="text-sm font-bold mt-1">{times.transit || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Culminazione</p>
                {times.transitAltitude > 0 && (
                  <p className="text-[9px] text-muted-foreground">{times.transitAltitude}° alt.</p>
                )}
              </div>
              <div className="bg-accent/30 rounded-lg p-3 text-center">
                <span className="text-lg">🌇</span>
                <p className="text-sm font-bold mt-1">{times.set || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Tramonta</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="animate-pulse text-sm text-muted-foreground">Calcolo posizione...</div>
            </div>
          )}

          {/* LII Card */}
          {currentLII && (
            <div className="bg-accent/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lunar Influence Index</span>
                <span className="text-lg">{currentLII.emoji}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${currentLII.score}%`,
                        background: currentLII.score > 75 ? 'hsl(var(--destructive))' :
                                   currentLII.score > 50 ? 'hsl(30 90% 55%)' :
                                   currentLII.score > 25 ? 'hsl(45 90% 55%)' :
                                   'hsl(var(--primary))',
                      }}
                    />
                  </div>
                </div>
                <span className="text-lg font-bold">{currentLII.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground capitalize">Influenza: {currentLII.level}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(), 'HH:mm')} — ora attuale
                </p>
              </div>
            </div>
          )}

          {/* Energia Attesa Card */}
          {currentEnergia && (
            <div className="bg-accent/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Energia Attesa</span>
                <span className="text-lg">{currentEnergia.emoji}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${currentEnergia.score * 10}%`,
                        background: currentEnergia.score > 7.5 ? 'hsl(280 70% 55%)' :
                                   currentEnergia.score > 5 ? 'hsl(340 70% 55%)' :
                                   currentEnergia.score > 3 ? 'hsl(200 70% 55%)' :
                                   'hsl(var(--muted-foreground))',
                      }}
                    />
                  </div>
                </div>
                <span className="text-lg font-bold">{currentEnergia.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground capitalize">Livello: {currentEnergia.level}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(), 'HH:mm')} — ora attuale
                </p>
              </div>
            </div>
          )}

          {/* Altitude Chart */}
          {combinedSamples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Altitudine, LII & Energia</p>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedSamples} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="moonAltGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="liiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(30 90% 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(30 90% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => `${Math.floor(v)}h`}
                      ticks={[0, 6, 12, 18, 24]}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.3}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => `${v}°`}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.3}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" />
                    <Tooltip
                      formatter={(v: number, name: string) => {
                        if (name === 'liiScaled') {
                          const original = Math.round((v / maxAlt) * 100);
                          return [`${original}`, 'LII'];
                        }
                        if (name === 'energiaScaled') {
                          const original = Math.round((v / maxAlt) * 100) / 10;
                          return [`${original}`, 'Energia'];
                        }
                        return [`${v}°`, 'Altitudine'];
                      }}
                      labelFormatter={(v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
                      contentStyle={{ fontSize: 11, borderRadius: 8, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="altitude"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#moonAltGrad)"
                    />
                    <Line
                      type="monotone"
                      dataKey="liiScaled"
                      stroke="hsl(30 90% 55%)"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="energiaScaled"
                      stroke="hsl(280 70% 55%)"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="2 2"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Altitudine</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: 'hsl(30 90% 55%)' }} /> LII</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: 'hsl(280 70% 55%)' }} /> Energia</span>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
            <MapPin className="h-3 w-3" />
            <span>{locationName}</span>
          </div>

          {/* Journal Energy Correlation */}
          {journalEntry && (journalEntry.energyMorning || journalEntry.energyAfternoon || journalEntry.energyEvening) && (
            <div className="border-t border-border/50 pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Energia reale vs prevista</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {TIME_SLOTS.map((slot, i) => {
                  const actual = [journalEntry.energyMorning, journalEntry.energyAfternoon, journalEntry.energyEvening][i];
                  const predicted = slotPredictions[i]?.predicted ?? null;
                  const delta = actual !== undefined && actual !== null && predicted !== null ? actual - predicted : null;
                  return (
                    <div key={slot.key} className="bg-accent/30 rounded-lg p-2 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">{slot.icon} {slot.label}</p>
                      {predicted !== null && (
                        <>
                          <p className="text-sm font-bold">{predicted}</p>
                          <p className="text-[9px] text-muted-foreground">prevista</p>
                        </>
                      )}
                      {actual !== undefined && actual !== null && (
                        <p className={`text-[10px] font-semibold ${
                          delta !== null && Math.abs(delta) <= 1.5 ? 'text-green-500' :
                          delta !== null && delta > 0 ? 'text-blue-500' : 'text-orange-500'
                        }`}>
                          {actual}/10 reale {delta !== null && `(${delta > 0 ? '+' : ''}${delta.toFixed(1)})`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {correlationAccuracy && (
                <div className={`text-[10px] font-medium text-center rounded px-2 py-1 ${
                  correlationAccuracy.mae <= 1.5 ? 'bg-green-500/10 text-green-600' :
                  correlationAccuracy.mae <= 2.5 ? 'bg-yellow-500/10 text-yellow-600' :
                  'bg-orange-500/10 text-orange-600'
                }`}>
                  {correlationAccuracy.mae <= 1.5 ? '✅ Modello accurato' :
                   correlationAccuracy.mae <= 2.5 ? '⚠️ Modello approssimato' :
                   '🔧 Modello da calibrare'} — MAE: {correlationAccuracy.mae} ({correlationAccuracy.count} misure)
                </div>
              )}
            </div>
          )}

          {/* Next events */}
          <div className="border-t border-border/50 pt-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prossimi eventi</p>
            <div className="flex items-center gap-2 text-sm">
              <span>🌕</span>
              <span>Prossima Luna Piena</span>
              <span className="ml-auto text-muted-foreground text-xs">
                {format(nextEvents.nextFull, 'd MMM', { locale: it })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>🌑</span>
              <span>Prossima Luna Nuova</span>
              <span className="ml-auto text-muted-foreground text-xs">
                {format(nextEvents.nextNew, 'd MMM', { locale: it })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
