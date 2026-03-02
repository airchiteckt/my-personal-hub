import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Check, Clock, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatMinutes } from '@/lib/calendar-utils';

const Index = () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { getTasksForDate, completeTask, scheduleTask, getEnterprise, getProject } = usePrp();
  const todayTasks = getTasksForDate(todayStr);
  const totalMinutes = todayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold capitalize">
          {format(new Date(), 'EEEE d MMMM', { locale: it })}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          {todayTasks.length > 0
            ? `${todayTasks.length} task · ${formatMinutes(totalMinutes)} di lavoro`
            : 'Nessuna task pianificata'}
        </p>
      </div>

      {todayTasks.length === 0 ? (
        <Card className="p-8 md:p-12 text-center border-dashed">
          <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">Giornata libera!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vai al{' '}
            <Link to="/calendar" className="text-primary underline underline-offset-4">
              calendario
            </Link>{' '}
            per pianificare
          </p>
        </Card>
      ) : (
        <div className="space-y-2 md:space-y-3">
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
                    className="p-3 md:p-4 flex items-center gap-3 md:gap-4"
                    style={{ borderLeft: `4px solid hsl(${enterprise?.color || '0 0% 50%'})` }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 rounded-full h-8 w-8 md:h-9 md:w-9 border border-border hover:bg-accent"
                      onClick={() => completeTask(task.id)}
                    >
                      <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {enterprise?.name} · {project?.name}
                        {task.scheduledTime && ` · ${task.scheduledTime}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatMinutes(task.estimatedMinutes)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => scheduleTask(task.id, tomorrow, task.scheduledTime)}
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
