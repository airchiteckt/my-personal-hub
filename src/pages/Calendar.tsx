import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDayView } from '@/components/calendar/MobileDayView';
import { DesktopWeekView } from '@/components/calendar/DesktopWeekView';
import DayView from './Index';

const Calendar = () => {
  const isMobile = useIsMobile();
  const [dayDate, setDayDate] = useState<Date | null>(null);

  if (!isMobile && dayDate) {
    return (
      <div className="flex flex-col h-full">
        <DayView date={dayDate} onBack={() => setDayDate(null)} />
      </div>
    );
  }

  return (
    <div className={isMobile ? "fixed inset-0 top-14 flex flex-col" : "flex flex-col h-full md:p-6"}>
      {isMobile ? <MobileDayView /> : <DesktopWeekView onOpenDay={setDayDate} />}
    </div>
  );
};

export default Calendar;
