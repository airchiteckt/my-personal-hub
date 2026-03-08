import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, Target, FolderPlus, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'planning_thresholds';
const DEFAULTS = { minProjectsPerKR: 1, minTasksPerProject: 1 };

export function PlanningThresholds() {
  const [minProjectsPerKR, setMinProjectsPerKR] = useState(DEFAULTS.minProjectsPerKR);
  const [minTasksPerProject, setMinTasksPerProject] = useState(DEFAULTS.minTasksPerProject);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMinProjectsPerKR(parsed.minProjectsPerKR ?? DEFAULTS.minProjectsPerKR);
        setMinTasksPerProject(parsed.minTasksPerProject ?? DEFAULTS.minTasksPerProject);
      }
    } catch {}
  }, []);

  const save = () => {
    const values = {
      minProjectsPerKR: Math.max(1, minProjectsPerKR),
      minTasksPerProject: Math.max(1, minTasksPerProject),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    toast.success('Soglie pianificazione salvate');
  };

  const reset = () => {
    setMinProjectsPerKR(DEFAULTS.minProjectsPerKR);
    setMinTasksPerProject(DEFAULTS.minTasksPerProject);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    toast.success('Soglie ripristinate');
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Soglie Pianificazione Strategica
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Definisci i requisiti minimi per completare ogni fase della barra di avanzamento nel wizard strategico.
            Solo i progetti <strong>Strategic</strong> collegati a KR vengono considerati.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" />
            Progetti strategic per KR
          </Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={minProjectsPerKR}
            onChange={e => setMinProjectsPerKR(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <p className="text-[10px] text-muted-foreground">
            Ogni Key Result deve avere almeno questo numero di progetti strategic collegati per completare la fase "Progetti"
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Task per progetto strategic
          </Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={minTasksPerProject}
            onChange={e => setMinTasksPerProject(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <p className="text-[10px] text-muted-foreground">
            Ogni progetto strategic deve avere almeno questo numero di task per completare la fase "Task"
          </p>
        </div>
      </div>

      <Button onClick={save} className="w-full">
        Salva soglie
      </Button>
    </Card>
  );
}
