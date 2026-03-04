import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMoonPhase, getMoonTimes, getNextMoonEvents, getMoonAltitudeSamples, getMoonDataAtHour } from '@/lib/moon-utils';
import { calculateLII, getLIIDaySamples, type LIIResult } from '@/lib/lunar-influence';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ComposedChart, Line } from 'recharts';

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

  // LII: current value
  const currentLII = useMemo<LIIResult | null>(() => {
    if (!location || !times) return null;
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const data = getMoonDataAtHour(date, currentHour, location.lat, location.lon, times);
    const isAboveHorizon = data.altitude > -0.833;
    const hoursFromTransit = data.transitHour !== null ? Math.abs(currentHour - data.transitHour) : 12;
    const hoursFromRise = data.riseHour !== null ? Math.abs(currentHour - data.riseHour) : null;
    const hoursFromSet = data.setHour !== null ? Math.abs(currentHour - data.setHour) : null;
    return calculateLII({ illumination: data.illumination, altitude: data.altitude, isAboveHorizon, hoursFromTransit, hoursFromRise, hoursFromSet });
  }, [date, location, times]);

  // LII: day samples for chart
  const liiSamples = useMemo(
    () => (location && times) ? getLIIDaySamples(date, location.lat, location.lon, getMoonDataAtHour, times) : [],
    [date, location, times]
  );

  // Merge altitude + LII for combined chart
  const combinedSamples = useMemo(() => {
    if (altitudeSamples.length === 0) return [];
    return altitudeSamples.map((s, i) => ({
      hour: s.hour,
      altitude: s.altitude,
      lii: liiSamples[i]?.lii ?? 0,
    }));
  }, [altitudeSamples, liiSamples]);

  const dateLabel = format(date, 'EEEE d MMMM yyyy', { locale: it });

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

          {/* Altitude Chart */}
          {combinedSamples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Altitudine & LII nel giorno</p>
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
                      yAxisId="alt"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v: number) => `${v}°`}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.3}
                    />
                    <YAxis
                      yAxisId="lii"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 9 }}
                      hide
                    />
                    <ReferenceLine yAxisId="alt" y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === 'altitude' ? `${v}°` : `${v}`,
                        name === 'altitude' ? 'Altitudine' : 'LII'
                      ]}
                      labelFormatter={(v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`}
                      contentStyle={{ fontSize: 11, borderRadius: 8, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Area
                      yAxisId="alt"
                      type="monotone"
                      dataKey="altitude"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#moonAltGrad)"
                    />
                    <Line
                      yAxisId="lii"
                      type="monotone"
                      dataKey="lii"
                      stroke="hsl(30 90% 55%)"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Altitudine</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded" style={{ background: 'hsl(30 90% 55%)' }} /> LII</span>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
            <MapPin className="h-3 w-3" />
            <span>{locationName}</span>
          </div>

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
