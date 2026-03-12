import type { Objective, KeyResult } from '@/types/prp';

export interface KRProgress {
  id: string;
  title: string;
  progress: number; // 0-100
  completed: boolean;
}

export interface ObjectiveProgress {
  id: string;
  title: string;
  progress: number; // 0-100 (average of KR progresses)
  completed: boolean; // true if >= threshold% of KRs are completed
  krs: KRProgress[];
}

export interface FocusProgress {
  progress: number; // 0-100 (average of objective progresses)
  completed: boolean;
  classification: 'success' | 'partial' | 'not_reached' | 'in_progress';
  classificationLabel: string;
  classificationEmoji: string;
  objectives: ObjectiveProgress[];
}

/**
 * Calculate KR progress (0-100)
 */
function getKRProgress(kr: KeyResult): number {
  if (kr.metricType === 'boolean') return kr.currentValue >= 1 ? 100 : 0;
  if (kr.targetValue <= 0) return 0;
  return Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
}

/**
 * Calculate full Focus progress hierarchy:
 * KR progress → Objective progress → Focus progress
 * 
 * @param objectiveCompletionPct - % of KRs that must be completed for an objective to be "completed" (default 70)
 * @param focusCompletionPct - % of objectives that must be completed for focus to be "completed" (default 70)
 * @param isActive - whether the focus period is still active (affects classification)
 */
export function calculateFocusProgress(
  objectives: Objective[],
  getKeyResultsForObjective: (objId: string) => KeyResult[],
  objectiveCompletionPct = 70,
  focusCompletionPct = 70,
  isActive = true,
): FocusProgress {
  if (objectives.length === 0) {
    return {
      progress: 0,
      completed: false,
      classification: 'in_progress',
      classificationLabel: 'In corso',
      classificationEmoji: '🔄',
      objectives: [],
    };
  }

  const objProgresses: ObjectiveProgress[] = objectives.map(obj => {
    const krs = getKeyResultsForObjective(obj.id);
    const krProgresses: KRProgress[] = krs.map(kr => ({
      id: kr.id,
      title: kr.title,
      progress: getKRProgress(kr),
      completed: getKRProgress(kr) >= 100,
    }));

    const objProgress = krProgresses.length > 0
      ? Math.round(krProgresses.reduce((sum, kr) => sum + kr.progress, 0) / krProgresses.length)
      : 0;

    const completedKRs = krProgresses.filter(kr => kr.completed).length;
    const completionRatio = krProgresses.length > 0 ? (completedKRs / krProgresses.length) * 100 : 0;

    return {
      id: obj.id,
      title: obj.title,
      progress: objProgress,
      completed: completionRatio >= objectiveCompletionPct,
      krs: krProgresses,
    };
  });

  const focusProgress = Math.round(
    objProgresses.reduce((sum, o) => sum + o.progress, 0) / objProgresses.length
  );

  const completedObjectives = objProgresses.filter(o => o.completed).length;
  const completionRatio = (completedObjectives / objProgresses.length) * 100;
  const focusCompleted = completionRatio >= focusCompletionPct;

  let classification: FocusProgress['classification'];
  let classificationLabel: string;
  let classificationEmoji: string;

  if (isActive) {
    classification = 'in_progress';
    classificationLabel = 'In corso';
    classificationEmoji = '🔄';
  } else if (focusProgress >= 80) {
    classification = 'success';
    classificationLabel = 'Focus riuscito';
    classificationEmoji = '🏆';
  } else if (focusProgress >= 60) {
    classification = 'partial';
    classificationLabel = 'Parzialmente riuscito';
    classificationEmoji = '📈';
  } else {
    classification = 'not_reached';
    classificationLabel = 'Non raggiunto';
    classificationEmoji = '⚠️';
  }

  return {
    progress: focusProgress,
    completed: focusCompleted,
    classification,
    classificationLabel,
    classificationEmoji,
    objectives: objProgresses,
  };
}
