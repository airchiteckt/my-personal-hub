import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExternalCalendarEvent } from '@/types/prp';
import { CalendarClock, MapPin, ExternalLink, FileText, CalendarDays, Users, Video, UserCircle2, Check, X, HelpCircle, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ExternalCalendarEvent | null;
  enterpriseName?: string;
}

function statusIcon(status?: string) {
  switch (status) {
    case 'accepted': return <Check className="h-3 w-3 text-emerald-600" />;
    case 'declined': return <X className="h-3 w-3 text-red-600" />;
    case 'tentative': return <HelpCircle className="h-3 w-3 text-amber-600" />;
    default: return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function meetingLinkFromConference(conf: any): string | undefined {
  if (!conf) return undefined;
  const entry = conf.entryPoints?.find((e: any) => e.entryPointType === 'video') ?? conf.entryPoints?.[0];
  return entry?.uri;
}

export function ExternalEventDetailDialog({ open, onOpenChange, event, enterpriseName }: Props) {
  if (!event) return null;

  const color = event.color || '210 80% 50%';
  const solidColor = color.startsWith('#') ? color : `hsl(${color})`;
  const meetLink = event.hangoutLink || meetingLinkFromConference(event.conferenceData);
  const organizerLabel = event.organizer?.displayName || event.organizer?.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 leading-tight">
            <CalendarClock className="h-5 w-5 shrink-0 mt-0.5" style={{ color: solidColor }} />
            <span>{event.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {event.allDay
                ? `${event.date} — Tutto il giorno`
                : `${event.date} · ${event.startTime} – ${event.endTime}`}
            </span>
          </div>

          {event.calendarName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: solidColor }} />
              <span className="text-muted-foreground">Calendario:</span>
              <span className="truncate">{event.calendarName}</span>
            </div>
          )}

          {enterpriseName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: solidColor }} />
              <span className="text-muted-foreground">Impresa:</span>
              <span>{enterpriseName}</span>
            </div>
          )}

          {organizerLabel && (
            <div className="flex items-center gap-2 text-sm">
              <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Organizzatore:</span>
              <span className="truncate">{organizerLabel}</span>
            </div>
          )}

          {event.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="break-words">{event.location}</span>
            </div>
          )}

          {meetLink && (
            <div className="flex items-start gap-2 text-sm">
              <Video className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {meetLink}
              </a>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>Partecipanti ({event.attendees.length})</span>
              </div>
              <ul className="space-y-1.5 bg-muted/50 rounded-lg p-3">
                {event.attendees.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {statusIcon(a.responseStatus)}
                    <span className="truncate flex-1">
                      {a.displayName || a.email || 'Sconosciuto'}
                      {a.displayName && a.email && (
                        <span className="text-muted-foreground ml-1">· {a.email}</span>
                      )}
                    </span>
                    {a.organizer && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Org.</Badge>}
                    {a.optional && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opz.</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {event.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Descrizione</span>
              </div>
              <div
                className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-3 [&_a]:text-primary [&_a]:underline break-words"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

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
