import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProjectType } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect, useMemo } from 'react';
import { useAiInline } from '@/hooks/use-ai-inline';
import { Sparkles, Loader2, Target, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
}

interface OkrSuggestion {
  objective: string;
  key_results: string[];
  suggested_type: ProjectType;
  alignment_score: number;
  alignment_note: string;
}

export function CreateProjectDialog({ open, onOpenChange, enterpriseId }: Props) {
  const { addProject, getEnterprise, getProjectsForEnterprise, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective } = usePrp();
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('strategic');
  const [keyResultId, setKeyResultId] = useState<string | undefined>(undefined);

  const enterprise = getEnterprise(enterpriseId);
  const existingProjects = getProjectsForEnterprise(enterpriseId);

  // Available KRs from active focus
  const availableKRs = useMemo(() => {
    const focusPeriods = getFocusPeriodsForEnterprise(enterpriseId);
    const activeFocus = focusPeriods.find(f => f.status === 'active');
    if (!activeFocus) return [];
    const objectives = getObjectivesForFocus(activeFocus.id);
    return objectives.flatMap(o =>
      getKeyResultsForObjective(o.id).map(kr => ({ ...kr, objectiveTitle: o.title }))
    );
  }, [enterpriseId, getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective]);

  const { data: okrData, loading: okrLoading, debouncedFetch: fetchOkr, clear: clearOkr } = useAiInline<OkrSuggestion>({
    type: 'okr_project',
    debounceMs: 1000,
  });

  useEffect(() => {
    if (name.trim().length >= 3 && enterprise) {
      fetchOkr(
        {
          enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase, timeHorizon: enterprise.timeHorizon, strategicImportance: enterprise.strategicImportance },
          existingProjects: existingProjects.map(p => ({ name: p.name, type: p.type })),
        },
        `Il progetto si chiama: "${name.trim()}". Suggerisci OKR e valida l'allineamento.`
      );
    } else {
      clearOkr();
    }
  }, [name]);

  useEffect(() => {
    if (okrData?.suggested_type) setType(okrData.suggested_type);
  }, [okrData]);

  // Auto-clear KR when switching to non-strategic
  useEffect(() => {
    if (type !== 'strategic') setKeyResultId(undefined);
  }, [type]);

  // Validation
  const isStrategic = type === 'strategic';
  const hasKR = !!keyResultId;
  const isValid = isStrategic ? hasKR : true; // strategic must have KR
  const validationError = isStrategic && !hasKR && availableKRs.length > 0
    ? 'I progetti Strategic devono essere collegati a un Key Result'
    : isStrategic && availableKRs.length === 0
    ? 'Crea prima un Focus Period attivo con Objective e KR per i progetti Strategic'
    : null;

  const handleSubmit = () => {
    if (!name.trim() || !isValid) return;
    addProject({
      name: name.trim(),
      type,
      enterpriseId,
      keyResultId: isStrategic ? keyResultId : undefined,
      isStrategicLever: isStrategic && hasKR,
    });
    setName('');
    setKeyResultId(undefined);
    clearOkr();
    onOpenChange(false);
  };

  const alignmentColor = (score: number) => {
    if (score >= 4) return 'text-green-600 dark:text-green-400';
    if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-500 dark:text-red-400';
  };

  const alignmentIcon = (score: number) => {
    if (score >= 4) return <CheckCircle2 className="h-3.5 w-3.5" />;
    return <AlertTriangle className="h-3.5 w-3.5" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuovo Progetto
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> AI OKR
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome progetto</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Es. Lancio nuovo prodotto, Ottimizzazione vendite..."
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* AI Inline Suggestions */}
          {(okrLoading || okrData) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                {okrLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisi AI in corso...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Suggerimenti OKR</>
                )}
              </div>

              {okrData && !okrLoading && (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Objective suggerito
                    </p>
                    <p className="text-sm">{okrData.objective}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Key Results</p>
                    <ul className="space-y-1">
                      {okrData.key_results.map((kr, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary font-medium mt-0.5">KR{i + 1}</span>
                          <span>{kr}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-primary/10">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${alignmentColor(okrData.alignment_score)}`}>
                      {alignmentIcon(okrData.alignment_score)}
                      Allineamento: {okrData.alignment_score}/5
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Tipo: {okrData.suggested_type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{okrData.alignment_note}</p>
                </>
              )}
            </div>
          )}

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
                <Link2 className="h-3.5 w-3.5" /> Key Result collegato <span className="text-destructive">*</span>
              </Label>
              {availableKRs.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  ⚠️ Nessun Key Result disponibile. Crea prima un Focus Period attivo con Objective e KR.
                </p>
              ) : (
                <Select value={keyResultId || ''} onValueChange={v => setKeyResultId(v || undefined)}>
                  <SelectTrigger><SelectValue placeholder="Seleziona KR..." /></SelectTrigger>
                  <SelectContent position="popper" className="max-w-[var(--radix-select-trigger-width)] w-full" sideOffset={4}>
                    {availableKRs.map(kr => (
                      <SelectItem key={kr.id} value={kr.id} className="max-w-full">
                        <span className="text-xs truncate block">{kr.objectiveTitle} → {kr.title}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Validation */}
          {validationError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {validationError}
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full" disabled={!name.trim() || !isValid}>
            Crea Progetto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}