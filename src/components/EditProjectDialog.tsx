import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProjectType, Project, TASK_STATUS_LABELS } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Link2, Check, Clock, ChevronDown, ListTodo } from 'lucide-react';
import { formatMinutes } from '@/lib/calendar-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export function EditProjectDialog({ open, onOpenChange, project }: Props) {
  const { updateProject, deleteProject, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective, getTasksForProject } = usePrp();
  const [name, setName] = useState(project.name);
  const [type, setType] = useState<ProjectType>(project.type);
  const [keyResultId, setKeyResultId] = useState<string | undefined>(project.keyResultId);

  useEffect(() => {
    setName(project.name);
    setType(project.type);
    setKeyResultId(project.keyResultId);
  }, [project]);

  const availableKRs = useMemo(() => {
    const focusPeriods = getFocusPeriodsForEnterprise(project.enterpriseId);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    if (!activeFocus) return [];
    const objectives = getObjectivesForFocus(activeFocus.id);
    return objectives.flatMap(o => 
      getKeyResultsForObjective(o.id).map(kr => ({ ...kr, objectiveTitle: o.title }))
    );
  }, [project.enterpriseId, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective]);

  const projectTasks = getTasksForProject(project.id);
  const activeTasks = projectTasks.filter(t => t.status !== 'done');
  const completedTasks = projectTasks.filter(t => t.status === 'done');

  const isStrategic = type === 'strategic';
  const hasKR = !!keyResultId;
  const isValid = isStrategic ? hasKR : !hasKR;
  const validationError = isStrategic && !hasKR 
    ? 'I progetti Strategic devono essere collegati a un Key Result attivo'
    : !isStrategic && hasKR
    ? `I progetti ${type === 'operational' ? 'Operational' : 'Maintenance'} non possono essere collegati a KR`
    : null;

  useEffect(() => {
    if (type !== 'strategic' && keyResultId) {
      setKeyResultId(undefined);
    }
  }, [type]);

  const handleSave = () => {
    if (!name.trim() || !isValid) return;
    updateProject(project.id, { 
      name: name.trim(), 
      type, 
      keyResultId: isStrategic ? keyResultId : undefined,
      isStrategicLever: isStrategic && hasKR,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteProject(project.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Modifica Progetto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 overflow-y-auto flex-1 min-h-0 pr-1">
          <div className="space-y-2">
            <Label>Nome progetto</Label>
            <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={v => setType(v as ProjectType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strategic">🔵 Strategic</SelectItem>
                <SelectItem value="operational">🟡 Operational</SelectItem>
                <SelectItem value="maintenance">⚪ Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isStrategic && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Key Result collegato
              </Label>
              {availableKRs.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  ⚠️ Nessun Key Result disponibile. Crea prima un Focus Period attivo con Objective e KR.
                </p>
              ) : (
                <Select value={keyResultId || ''} onValueChange={v => setKeyResultId(v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Seleziona KR..." /></SelectTrigger>
                  <SelectContent>
                    {availableKRs.map(kr => (
                      <SelectItem key={kr.id} value={kr.id}>
                        <span className="text-xs">{kr.objectiveTitle} → {kr.title}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {validationError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {validationError}
            </div>
          )}

          {/* Tasks section */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" /> Task ({projectTasks.length})
            </Label>
            {projectTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Nessuna task in questo progetto</p>
            ) : (
              <div className="space-y-1">
                {activeTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                    <div className="h-4 w-4 shrink-0 rounded-full border border-border flex items-center justify-center">
                      <Clock className="h-2 w-2 text-muted-foreground" />
                    </div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <Badge variant="outline" className="text-[10px]">{TASK_STATUS_LABELS[task.status]}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatMinutes(task.estimatedMinutes)}</span>
                  </div>
                ))}
                {completedTasks.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
                      <ChevronDown className="h-3 w-3" />
                      {completedTasks.length} completat{completedTasks.length === 1 ? 'a' : 'e'}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {completedTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                          <div className="h-4 w-4 shrink-0 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2 w-2 text-primary-foreground" />
                          </div>
                          <span className="flex-1 truncate line-through text-muted-foreground">{task.title}</span>
                          <span className="text-[10px] text-muted-foreground">{formatMinutes(task.estimatedMinutes)}</span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-border shrink-0">
          <Button onClick={handleSave} className="flex-1" disabled={!name.trim() || !isValid}>
            Salva
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Elimina
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}