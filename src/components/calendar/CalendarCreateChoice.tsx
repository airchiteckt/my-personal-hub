import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarClock, ListChecks, Bell, Timer } from 'lucide-react';
import { LogTimeDialog } from './LogTimeDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeLabel?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  onChooseAppointment: () => void;
  onChooseTask: () => void;
  onChooseReminder: () => void;
}

export function CalendarCreateChoice({ open, onOpenChange, timeLabel, date, startTime, endTime, onChooseAppointment, onChooseTask, onChooseReminder }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const items = [
    { label: 'Appuntamento', icon: CalendarClock, onClick: onChooseAppointment },
    { label: 'Task', icon: ListChecks, onClick: onChooseTask },
    { label: 'Promemoria', icon: Bell, onClick: onChooseReminder },
    { label: 'Tempo lavorato', icon: Timer, onClick: () => { onOpenChange(false); setTimeout(() => setLogOpen(true), 150); } },
  ];
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Cosa vuoi creare?</DialogTitle>
            {timeLabel && <p className="text-xs text-muted-foreground">{timeLabel}</p>}
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {items.map(({ label, icon: Icon, onClick }) => (
              <Button key={label} variant="outline" className="h-20 flex-col gap-2" onClick={onClick}>
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <LogTimeDialog open={logOpen} onOpenChange={setLogOpen} date={date} startTime={startTime} endTime={endTime} />
    </>
  );
}
