import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDayView } from '@/components/calendar/MobileDayView';
import { DesktopWeekView } from '@/components/calendar/DesktopWeekView';

const Calendar = () => {
  const isMobile = useIsMobile();
  return (
    <div className="fixed inset-0 top-14 flex flex-col md:p-6 md:static md:inset-auto md:top-auto md:h-full">
      {isMobile ? <MobileDayView /> : <DesktopWeekView />}
    </div>
  );
};

export default Calendar;
