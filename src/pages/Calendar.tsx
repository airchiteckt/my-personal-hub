import { useIsMobile } from '@/hooks/use-mobile';
import { MobileDayView } from '@/components/calendar/MobileDayView';
import { DesktopWeekView } from '@/components/calendar/DesktopWeekView';

const Calendar = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileDayView /> : <DesktopWeekView />;
};

export default Calendar;
