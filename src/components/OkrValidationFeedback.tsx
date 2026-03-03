import { CheckCircle2, AlertTriangle, XCircle, Loader2, Sparkles, Lightbulb } from 'lucide-react';

interface ValidationData {
  quality_score: number;
  is_valid: boolean;
  issue_type: string;
  feedback: string;
  improved_version: string;
}

interface Props {
  data: ValidationData | null;
  loading: boolean;
  onApplySuggestion?: (improved: string) => void;
  type: 'objective' | 'key_result' | 'task';
}

const typeLabels = {
  objective: 'Objective',
  key_result: 'Key Result',
  task: 'Task',
};

export function OkrValidationFeedback({ data, loading, onApplySuggestion, type }: Props) {
  if (!loading && !data) return null;

  const scoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 dark:text-green-400';
    if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-destructive';
  };

  const scoreBg = (score: number) => {
    if (score >= 4) return 'border-green-500/20 bg-green-500/5';
    if (score >= 3) return 'border-yellow-500/20 bg-yellow-500/5';
    return 'border-destructive/20 bg-destructive/5';
  };

  const ScoreIcon = ({ score }: { score: number }) => {
    if (score >= 4) return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    if (score >= 3) return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  return (
    <div className={`rounded-lg border p-2.5 animate-in fade-in duration-300 ${data ? scoreBg(data.quality_score) : 'border-primary/20 bg-primary/5'}`}>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analisi qualità {typeLabels[type]}...
        </div>
      ) : data && (
        <div className="space-y-2">
          {/* Score + Feedback */}
          <div className="flex items-start gap-2">
            <ScoreIcon score={data.quality_score} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold ${scoreColor(data.quality_score)}`}>
                  {data.quality_score}/5
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {data.is_valid ? '✅ Valido' : '⚠️ Da rivedere'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.feedback}</p>
            </div>
          </div>

          {/* Improved version suggestion */}
          {!data.is_valid && data.improved_version && onApplySuggestion && (
            <button
              onClick={() => onApplySuggestion(data.improved_version)}
              className="w-full text-left p-2 rounded-md border border-dashed border-primary/30 hover:bg-primary/10 transition-colors group"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-primary mb-0.5">
                <Lightbulb className="h-3 w-3" />
                Suggerimento AI — clicca per applicare
              </div>
              <p className="text-xs text-foreground">{data.improved_version}</p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
