import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Check, Clock, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const Index = () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { getTasksForDate, completeTask, scheduleTask, getEnterprise, getProject } = usePrp();
  const todayTasks = getTasksForDate(todayStr);
  const totalMinutes = todayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold capitalize">
          {format(new Date(), 'EEEE d MMMM', { locale: it })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {todayTasks.length > 0
            ? `${todayTasks.length} task pianificate · ${hours}h ${mins}m di lavoro`
            : 'Nessuna task pianificata'}
        </p>
      </div>

      {todayTasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">Giornata libera!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vai al{' '}
            <Link to="/calendar" className="text-primary underline underline-offset-4">
              calendario
            </Link>{' '}
            per pianificare le tue task
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {todayTasks.map(task => {
              const enterprise = getEnterprise(task.enterpriseId);
              const project = getProject(task.projectId);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -200 }}
                  layout
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="p-4 flex items-center gap-4"
                    style={{ borderLeft: `4px solid hsl(${enterprise?.color || '0 0% 50%'})` }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 rounded-full h-9 w-9 border border-border hover:bg-accent"
                      onClick={() => completeTask(task.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {enterprise?.name} · {project?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.estimatedMinutes}m
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => scheduleTask(task.id, tomorrow)}
                        title="Sposta a domani"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Index;
