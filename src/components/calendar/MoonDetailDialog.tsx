import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMoonPhase, getMoonTimes, getNextMoonEvents, getMoonZodiac } from '@/lib/moon-utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

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
  const zodiac = getMoonZodiac(date);
  const nextEvents = getNextMoonEvents(date);
  const times = location ? getMoonTimes(date, location.lat, location.lon) : null;

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

          {/* Zodiac */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-2xl">{zodiac.emoji}</span>
            <div>
              <p className="text-sm font-medium">Luna in {zodiac.signIt}</p>
              <p className="text-xs text-muted-foreground">Segno zodiacale lunare</p>
            </div>
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
