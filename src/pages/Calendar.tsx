import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDayView } from '@/components/calendar/MobileDayView';
import { DesktopWeekView } from '@/components/calendar/DesktopWeekView';

const Calendar = () => {
  const isMobile = useIsMobile();
  return (
    <div className={isMobile ? "fixed inset-0 top-14 flex flex-col" : "flex flex-col h-full md:p-6"}>
      {isMobile ? <MobileDayView /> : <DesktopWeekView />}
    </div>
  );
};

export default Calendar;
