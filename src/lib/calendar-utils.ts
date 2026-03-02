export const SLOT_MINUTES = 30;
export const START_HOUR = 7;
export const END_HOUR = 22;
export const TOTAL_SLOTS = (END_HOUR - START_HOUR) * (60 / SLOT_MINUTES);
export const MOBILE_SLOT_HEIGHT = 52;
export const DESKTOP_SLOT_HEIGHT = 44;

export const slotToTime = (slotIndex: number): string => {
  const totalMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const timeToSlot = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return Math.max(0, ((h - START_HOUR) * 60 + m) / SLOT_MINUTES);
};

export const getTaskPosition = (time: string, estimatedMinutes: number, slotHeight: number) => {
  const slot = timeToSlot(time);
  const slots = Math.ceil(estimatedMinutes / SLOT_MINUTES);
  return {
    top: slot * slotHeight,
    height: slots * slotHeight,
  };
};

export const formatMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
