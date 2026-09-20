import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarClock, ListChecks, Bell } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeLabel: string;
  onChooseAppointment: () => void;
  onChooseTask: () => void;
  onChooseReminder: () => void;
}

export function CalendarCreateChoice({ open, onOpenChange, timeLabel, onChooseAppointment, onChooseTask, onChooseReminder }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Cosa vuoi creare?</DialogTitle>
          <p className="text-xs text-muted-foreground">{timeLabel}</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 pt-2">
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={onChooseAppointment}
          >
            <CalendarClock className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Appuntamento</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={onChooseTask}
          >
            <ListChecks className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Task</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={onChooseReminder}
          >
            <Bell className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Promemoria</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
