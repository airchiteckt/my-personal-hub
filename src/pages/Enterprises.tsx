import { usePrp } from '@/context/PrpContext';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { CreateEnterpriseDialog } from '@/components/CreateEnterpriseDialog';
import { ENTERPRISE_STATUS_LABELS } from '@/types/prp';

const Enterprises = () => {
  const { enterprises, projects, tasks } = usePrp();
  const [showCreate, setShowCreate] = useState(false);

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

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {enterprises.map(e => {
          const projCount = projects.filter(p => p.enterpriseId === e.id).length;
          const taskCount = tasks.filter(t => t.enterpriseId === e.id && t.status !== 'done').length;
          return (
            <Link key={e.id} to={`/enterprise/${e.id}`}>
              <Card className="p-4 md:p-5 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]" style={{ borderTop: `4px solid hsl(${e.color})` }}>
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-9 w-9 md:h-10 md:w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `hsl(${e.color} / 0.12)` }}
                  >
                    <Building2 className="h-4 w-4 md:h-5 md:w-5" style={{ color: `hsl(${e.color})` }} />
                  </div>
                  <Badge variant="secondary" className="text-[10px] md:text-xs">
                    {ENTERPRISE_STATUS_LABELS[e.status]}
                  </Badge>
                </div>
                <h3 className="font-semibold text-base md:text-lg group-hover:text-primary transition-colors">{e.name}</h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  {projCount} progetti · {taskCount} task attive
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <CreateEnterpriseDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

export default Enterprises;
