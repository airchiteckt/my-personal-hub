import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, Target, FolderPlus, ListTodo, Crosshair, BarChart3, CalendarDays, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export const STORAGE_KEY = 'planning_thresholds';

export const THRESHOLD_DEFAULTS = {
  // Focus
  maxFocusPerEnterprise: 1,
  // Objectives per Focus
  minObjectivesPerFocus: 1,
  maxObjectivesPerFocus: 3,
  // Key Results per Objective
  minKRsPerObjective: 2,
  maxKRsPerObjective: 5,
  // Strategic Projects per KR
  minProjectsPerKR: 1,
  maxProjectsPerKR: 3,
  // Tasks per Project
  minTasksPerProject: 1,
  maxTasksPerProject: 20,
  // Daily tasks
  maxTasksPerDay: 7,
  // Overload warnings
  warnProjectsPerFocus: 10,
  warnTasksPerFocus: 30,
  // Completion thresholds (%)
  objectiveCompletionPct: 70,
  focusCompletionPct: 70,
};

export type PlanningThresholdsConfig = typeof THRESHOLD_DEFAULTS;

export function getThresholds(): PlanningThresholdsConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...THRESHOLD_DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...THRESHOLD_DEFAULTS };
}

type FieldConfig = {
  key: keyof PlanningThresholdsConfig;
  label: string;
  icon: typeof Target;
  min: number;
  max: number;
  description: string;
};

const sections: { title: string; emoji: string; fields: FieldConfig[] }[] = [
  {
    title: 'Focus Period',
    emoji: '🎯',
    fields: [
      { key: 'maxFocusPerEnterprise', label: 'Max Focus attivi per impresa', icon: Crosshair, min: 1, max: 3, description: 'Un solo focus = nessuna dispersione' },
    ],
  },
  {
    title: 'Obiettivi per Focus',
    emoji: '📌',
    fields: [
      { key: 'minObjectivesPerFocus', label: 'Minimo obiettivi', icon: Target, min: 1, max: 5, description: 'Almeno 1 obiettivo per completare la fase' },
      { key: 'maxObjectivesPerFocus', label: 'Massimo obiettivi', icon: Target, min: 1, max: 10, description: 'Più di 3 = dispersione strategica' },
    ],
  },
  {
    title: 'Key Results per Obiettivo',
    emoji: '📊',
    fields: [
      { key: 'minKRsPerObjective', label: 'Minimo KR', icon: BarChart3, min: 1, max: 5, description: '1 KR è troppo poco, standard OKR: 3-4' },
      { key: 'maxKRsPerObjective', label: 'Massimo KR', icon: BarChart3, min: 2, max: 10, description: 'Più di 5 diventa confuso' },
    ],
  },
  {
    title: 'Progetti Strategic per KR',
    emoji: '📂',
    fields: [
      { key: 'minProjectsPerKR', label: 'Minimo progetti', icon: FolderPlus, min: 1, max: 5, description: 'Almeno 1 leva per KR' },
      { key: 'maxProjectsPerKR', label: 'Massimo progetti', icon: FolderPlus, min: 1, max: 10, description: 'Più di 3 = dispersione' },
    ],
  },
  {
    title: 'Task per Progetto',
    emoji: '✅',
    fields: [
      { key: 'minTasksPerProject', label: 'Minimo task', icon: ListTodo, min: 1, max: 10, description: 'Almeno 1 task per completare la fase' },
      { key: 'maxTasksPerProject', label: 'Massimo task', icon: ListTodo, min: 5, max: 50, description: 'Più di 20 = progetto troppo grande, va diviso' },
    ],
  },
  {
    title: 'Limiti giornalieri & avvisi sovraccarico',
    emoji: '⚠️',
    fields: [
      { key: 'maxTasksPerDay', label: 'Max task pianificate/giorno', icon: CalendarDays, min: 1, max: 15, description: 'Evita agende irrealistiche (5-7 consigliato)' },
      { key: 'warnProjectsPerFocus', label: 'Avviso: progetti per focus', icon: FolderPlus, min: 3, max: 30, description: 'Oltre questo numero → "Focus troppo ampio"' },
      { key: 'warnTasksPerFocus', label: 'Avviso: task attive per focus', icon: ListTodo, min: 10, max: 100, description: 'Oltre questo numero → "Focus troppo ampio"' },
    ],
  },
  {
    title: 'Soglie di completamento',
    emoji: '🏆',
    fields: [
      { key: 'objectiveCompletionPct', label: '% KR per completare Objective', icon: Trophy, min: 50, max: 100, description: 'Un Objective è completato quando questa % dei KR è raggiunta (70% consigliato)' },
      { key: 'focusCompletionPct', label: '% Objective per completare Focus', icon: Trophy, min: 50, max: 100, description: 'Un Focus è completato quando questa % degli Objective è completata (70% consigliato)' },
    ],
  },
];

export function PlanningThresholds() {
  const [values, setValues] = useState<PlanningThresholdsConfig>(THRESHOLD_DEFAULTS);

  useEffect(() => {
    setValues(getThresholds());
  }, []);

  const update = (key: keyof PlanningThresholdsConfig, val: number) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    toast.success('Soglie pianificazione salvate');
  };

  const reset = () => {
    setValues(THRESHOLD_DEFAULTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(THRESHOLD_DEFAULTS));
    toast.success('Soglie ripristinate ai valori consigliati');
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Soglie Pianificazione Strategica
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Definisci i limiti min/max per ogni fase. I limiti sono <strong>soft warning</strong> (avviso, non blocco rigido).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>

        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.title}>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <span>{section.emoji}</span> {section.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map(field => {
                  const Icon = field.icon;
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {field.label}
                      </Label>
                      <Input
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={values[field.key]}
                        onChange={e => update(field.key, Math.max(field.min, Math.min(field.max, parseInt(e.target.value) || field.min)))}
                        className="h-8"
                      />
                      <p className="text-[10px] text-muted-foreground">{field.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={save} className="w-full mt-4">
          Salva soglie
        </Button>
      </Card>
    </div>
  );
}
