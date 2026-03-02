import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProjectType, Project } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Link2, Unlink } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export function EditProjectDialog({ open, onOpenChange, project }: Props) {
  const { updateProject, deleteProject, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective } = usePrp();
  const [name, setName] = useState(project.name);
  const [type, setType] = useState<ProjectType>(project.type);
  const [keyResultId, setKeyResultId] = useState<string | undefined>(project.keyResultId);

  useEffect(() => {
    setName(project.name);
    setType(project.type);
    setKeyResultId(project.keyResultId);
  }, [project]);

  // Get available KRs from active focus
  const availableKRs = useMemo(() => {
    const focusPeriods = getFocusPeriodsForEnterprise(project.enterpriseId);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    if (!activeFocus) return [];
    const objectives = getObjectivesForFocus(activeFocus.id);
    return objectives.flatMap(o => 
      getKeyResultsForObjective(o.id).map(kr => ({ ...kr, objectiveTitle: o.title }))
    );
  }, [project.enterpriseId, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective]);

  // Validation: strategic must have KR, operational/maintenance must NOT
  const isStrategic = type === 'strategic';
  const hasKR = !!keyResultId;
  const isValid = isStrategic ? hasKR : !hasKR;
  const validationError = isStrategic && !hasKR 
    ? 'I progetti Strategic devono essere collegati a un Key Result attivo'
    : !isStrategic && hasKR
    ? `I progetti ${type === 'operational' ? 'Operational' : 'Maintenance'} non possono essere collegati a KR`
    : null;

  // Auto-clear KR when switching to non-strategic
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifica Progetto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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

          {/* KR Linking — only for strategic */}
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

          {/* Validation message */}
          {validationError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {validationError}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!name.trim() || !isValid}>
              Salva
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Elimina
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}