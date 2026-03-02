import { Brain, Shield, Cog, Repeat } from 'lucide-react';

export interface RitualData {
  id: string;
  user_id: string;
  name: string;
  category: string;
  frequency: string;
  custom_frequency_days: number[] | null;
  estimated_minutes: number;
  enterprise_id: string | null;
  suggested_day: number | null;
  suggested_time: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  weekly_specific_days: number[] | null;
  weekly_times_per_week: number | null;
  planning_mode: 'fixed' | 'flexible';
}

export interface RitualCompletion {
  id: string;
  ritual_id: string;
  completed_date: string;
  completed_time: string | null;
}

export const CATEGORY_META: Record<string, { label: string; icon: typeof Brain; color: string; calendarColor: string }> = {
  performance: { label: 'Performance', icon: Brain, color: 'text-violet-500', calendarColor: '270 60% 55%' },
  governance: { label: 'Governance', icon: Shield, color: 'text-amber-500', calendarColor: '40 80% 50%' },
  operational: { label: 'Operativo', icon: Cog, color: 'text-blue-500', calendarColor: '210 70% 55%' },
};

/** For fixed rituals: determines if this ritual should appear on a given date */
export function shouldCompleteOnDate(ritual: RitualData, date: Date): boolean {
  const dow = date.getDay();
  switch (ritual.frequency) {
    case 'daily': return true;
    case 'weekly': {
      if (ritual.weekly_specific_days && ritual.weekly_specific_days.length > 0) {
        return ritual.weekly_specific_days.includes(dow);
      }
      if (ritual.weekly_times_per_week) {
        return dow >= 1 && dow <= 5;
      }
      if (ritual.suggested_day != null) return dow === ritual.suggested_day;
      return dow >= 1 && dow <= 5;
    }
    case 'monthly': return date.getDate() === 1;
    case 'custom': return ritual.custom_frequency_days?.includes(dow) ?? false;
    default: return false;
  }
}

/** Get the weekly target count for a ritual */
export function getWeeklyTarget(ritual: RitualData): number {
  if (ritual.planning_mode === 'flexible' && ritual.weekly_times_per_week) {
    return ritual.weekly_times_per_week;
  }
  if (ritual.frequency === 'daily') return 7;
  if (ritual.frequency === 'weekly') {
    if (ritual.weekly_specific_days?.length) return ritual.weekly_specific_days.length;
    if (ritual.weekly_times_per_week) return ritual.weekly_times_per_week;
    return 5; // default weekdays
  }
  if (ritual.frequency === 'custom') return ritual.custom_frequency_days?.length || 0;
  if (ritual.frequency === 'monthly') return 1;
  return 0;
}

export function getRitualCategoryLabel(category: string): string {
  return CATEGORY_META[category]?.label || category;
}

export function getRitualCalendarColor(category: string): string {
  return CATEGORY_META[category]?.calendarColor || '270 60% 55%';
}

export function getRitualIcon(category: string) {
  return CATEGORY_META[category]?.icon || Repeat;
}
