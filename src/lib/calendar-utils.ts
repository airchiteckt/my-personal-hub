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

/**
 * Compute horizontal layout for overlapping tasks (Google Calendar style).
 * Returns a map of taskId → { column, totalColumns } so each task knows
 * its horizontal position within overlapping groups.
 */
export interface TaskTimeInfo {
  id: string;
  startSlot: number;
  endSlot: number;
}

export interface TaskLayout {
  column: number;
  totalColumns: number;
}

export function computeOverlapLayout(tasks: TaskTimeInfo[]): Map<string, TaskLayout> {
  const result = new Map<string, TaskLayout>();
  if (tasks.length === 0) return result;

  // Sort by start, then by longer duration first
  const sorted = [...tasks].sort((a, b) => a.startSlot - b.startSlot || (b.endSlot - b.startSlot) - (a.endSlot - a.startSlot));

  // Group overlapping tasks into clusters
  const clusters: TaskTimeInfo[][] = [];
  let currentCluster: TaskTimeInfo[] = [sorted[0]];
  let clusterEnd = sorted[0].endSlot;

  for (let i = 1; i < sorted.length; i++) {
    const task = sorted[i];
    if (task.startSlot < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(task);
      clusterEnd = Math.max(clusterEnd, task.endSlot);
    } else {
      clusters.push(currentCluster);
      currentCluster = [task];
      clusterEnd = task.endSlot;
    }
  }
  clusters.push(currentCluster);

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns: number[] = []; // end slot per column
    for (const task of cluster) {
      // Find first column where this task fits (no overlap)
      let col = columns.findIndex(colEnd => task.startSlot >= colEnd);
      if (col === -1) {
        col = columns.length;
        columns.push(0);
      }
      columns[col] = task.endSlot;
      result.set(task.id, { column: col, totalColumns: 0 }); // totalColumns set after
    }
    // Set totalColumns for all tasks in cluster
    const totalCols = columns.length;
    for (const task of cluster) {
      const layout = result.get(task.id)!;
      layout.totalColumns = totalCols;
    }
  }

  return result;
}
