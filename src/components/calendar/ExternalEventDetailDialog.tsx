import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ExternalCalendarEvent } from '@/types/prp';
import { CalendarClock, MapPin, ExternalLink, FileText, CalendarDays } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ExternalCalendarEvent | null;
  enterpriseName?: string;
}

export function ExternalEventDetailDialog({ open, onOpenChange, event, enterpriseName }: Props) {
  if (!event) return null;

  const color = event.color || '210 80% 50%';
  const solidColor = color.startsWith('#') ? color : `hsl(${color})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 leading-tight">
            <CalendarClock className="h-5 w-5 shrink-0 mt-0.5" style={{ color: solidColor }} />
            <span>{event.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Date & time */}
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {event.allDay
                ? `${event.date} — Tutto il giorno`
                : `${event.date} · ${event.startTime} – ${event.endTime}`}
            </span>
          </div>

          {/* Calendar source */}
          {event.calendarName && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: solidColor }}
              />
              <span className="text-muted-foreground">Calendario:</span>
              <span>{event.calendarName}</span>
            </div>
          )}

          {/* Enterprise */}
          {enterpriseName && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: solidColor }}
              />
              <span className="text-muted-foreground">Impresa:</span>
              <span>{enterpriseName}</span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Descrizione</span>
              </div>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3">
                {event.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {event.htmlLink && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(event.htmlLink, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Apri su Google Calendar
              </Button>
            )}
            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
