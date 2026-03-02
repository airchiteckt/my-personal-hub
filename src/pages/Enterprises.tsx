import { usePrp } from '@/context/PrpContext';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { CreateEnterpriseDialog } from '@/components/CreateEnterpriseDialog';
import { ENTERPRISE_STATUS_LABELS, ENTERPRISE_PHASE_LABELS, EnterprisePhase } from '@/types/prp';
import { calculateEnterpriseScore, getScoreBadge, detectAllocationMismatch } from '@/lib/enterprise-scoring';
import { formatMinutes } from '@/lib/calendar-utils';

const Enterprises = () => {
  const { enterprises, projects, tasks, prioritySettings } = usePrp();
  const [showCreate, setShowCreate] = useState(false);

  const scoredEnterprises = useMemo(() => {
    return enterprises
      .map(e => ({
        enterprise: e,
        score: calculateEnterpriseScore(e, tasks, prioritySettings.strategicWeight),
        projCount: projects.filter(p => p.enterpriseId === e.id).length,
        taskCount: tasks.filter(t => t.enterpriseId === e.id && t.status !== 'done').length,
        scheduledMinutes: tasks
          .filter(t => t.enterpriseId === e.id && t.status === 'scheduled')
          .reduce((sum, t) => sum + t.estimatedMinutes, 0),
      }))
      .sort((a, b) => b.score.total - a.score.total);
  }, [enterprises, tasks, projects, prioritySettings]);

  const allocationAlerts = useMemo(
    () => detectAllocationMismatch(enterprises, tasks),
    [enterprises, tasks]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Imprese</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">{enterprises.length} imprese totali</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="md:size-default">
          <Plus className="h-4 w-4 mr-1 md:mr-2" />
          <span className="hidden md:inline">Nuova Impresa</span>
          <span className="md:hidden">Nuova</span>
        </Button>
      </div>

      {/* Allocation Alerts */}
      {allocationAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {allocationAlerts.map((alert, i) => (
            <Card key={i} className="p-3 border-warning/30 bg-warning/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  <strong>Squilibrio allocazione:</strong> {alert.message}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {scoredEnterprises.map(({ enterprise: e, score, projCount, taskCount, scheduledMinutes }) => {
          const badgeInfo = getScoreBadge(score.badge);
          return (
            <Link key={e.id} to={`/enterprise/${e.id}`}>
              <Card
                className="p-4 md:p-5 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
                style={{ borderTop: `4px solid hsl(${e.color})` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="h-9 w-9 md:h-10 md:w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `hsl(${e.color} / 0.12)` }}
                  >
                    <Building2 className="h-4 w-4 md:h-5 md:w-5" style={{ color: `hsl(${e.color})` }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] md:text-xs">
                      {ENTERPRISE_STATUS_LABELS[e.status]}
                    </Badge>
                    <Badge className={`text-[10px] border ${badgeInfo.className}`}>
                      {badgeInfo.emoji} {score.total}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-base md:text-lg group-hover:text-primary transition-colors">
                  {e.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ENTERPRISE_PHASE_LABELS[e.phase as EnterprisePhase]} · {projCount} progetti · {taskCount} task
                </p>

                {/* Score Indicators */}
                <div className="grid grid-cols-4 gap-1 mt-3">
                  <ScoreIndicator label="Strategica" emoji="🎯" value={score.strategic} />
                  <ScoreIndicator label="Crescita" emoji="📈" value={score.growth} />
                  <ScoreIndicator label="Urgenza" emoji="⏳" value={score.urgency} />
                  <ScoreIndicator label="Carico" emoji="⚙️" value={score.operationalLoad} />
                </div>

                {scheduledMinutes > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📅 {formatMinutes(scheduledMinutes)} pianificate
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      <CreateEnterpriseDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

function ScoreIndicator({ label, emoji, value }: { label: string; emoji: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-bold">{emoji} {value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

export default Enterprises;
