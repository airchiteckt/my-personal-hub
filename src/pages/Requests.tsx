import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ClipboardList, Check, X, Archive, Inbox, Clock, User, Mail,
  AlertTriangle, TrendingUp, Calendar as CalendarIcon, Building2, FolderKanban,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface TaskRequest {
  id: string;
  host_user_id: string;
  requester_name: string;
  requester_email: string;
  title: string;
  description: string | null;
  suggested_priority: string | null;
  suggested_deadline: string | null;
  enterprise_id: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const PRIORITY_MAP: Record<string, { label: string; icon: typeof AlertTriangle; className: string }> = {
  high: { label: 'Alta', icon: AlertTriangle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  medium: { label: 'Media', icon: TrendingUp, className: 'bg-primary/10 text-primary border-primary/20' },
  low: { label: 'Bassa', icon: ClipboardList, className: 'bg-muted text-muted-foreground border-border' },
};

const STATUS_TABS = [
  { key: 'pending', label: 'In attesa', icon: Clock },
  { key: 'approved', label: 'Approvate', icon: Check },
  { key: 'rejected', label: 'Rifiutate', icon: X },
  { key: 'archived', label: 'Archiviate', icon: Archive },
] as const;

export default function Requests() {
  const { user } = useAuth();
  const { enterprises, projects, addTask } = usePrp();
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('pending');

  // Approve dialog
  const [approving, setApproving] = useState<TaskRequest | null>(null);
  const [selectedEnterprise, setSelectedEnterprise] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('task_requests')
      .select('*')
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false });
    setRequests((data as TaskRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user]);

  const filteredRequests = requests.filter(r => r.status === activeTab);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('task_requests')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Errore'); return; }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, resolved_at: new Date().toISOString() } : r));
    toast.success(status === 'rejected' ? 'Richiesta rifiutata' : status === 'archived' ? 'Richiesta archiviata' : 'Aggiornato');
  };

  const enterpriseProjects = selectedEnterprise
    ? projects.filter(p => p.enterpriseId === selectedEnterprise)
    : [];

  const handleApprove = async () => {
    if (!approving || !selectedEnterprise || !selectedProject) return;
    setSaving(true);

    // Insert task into backlog
    addTask({
      title: `[Richiesta] ${approving.title}`,
      enterpriseId: selectedEnterprise,
      projectId: selectedProject,
      priority: (approving.suggested_priority as 'high' | 'medium' | 'low') || 'medium',
      deadline: approving.suggested_deadline ? new Date(approving.suggested_deadline + 'T23:59:59').toISOString() : undefined,
      estimatedMinutes: 30,
      isRecurring: false,
    });

    // Update request status
    await supabase
      .from('task_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString(), enterprise_id: selectedEnterprise })
      .eq('id', approving.id);

    setRequests(prev => prev.map(r => r.id === approving.id ? { ...r, status: 'approved', resolved_at: new Date().toISOString() } : r));
    setSaving(false);
    setApproving(null);
    setSelectedEnterprise('');
    setSelectedProject('');
    toast.success('Richiesta approvata e inserita nel backlog!');
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6 md:h-7 md:w-7" />
          Richieste
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingCount}</Badge>
          )}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci le richieste di attività ricevute tramite Open Request
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-muted/40 rounded-xl p-1">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon;
          const count = requests.filter(r => r.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab.key === 'pending' && activeTab !== tab.key ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground/10'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Request list */}
      {filteredRequests.length === 0 ? (
        <Card className="p-8 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {activeTab === 'pending' ? 'Nessuna richiesta in attesa' : `Nessuna richiesta ${STATUS_TABS.find(t => t.key === activeTab)?.label.toLowerCase()}`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const prio = PRIORITY_MAP[req.suggested_priority || 'medium'];
            const PrioIcon = prio.icon;
            return (
              <Card key={req.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${prio.className}`}>
                    <PrioIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm leading-snug">{req.title}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {prio.label}
                      </Badge>
                    </div>

                    {req.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {req.requester_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {req.requester_email}
                      </span>
                      {req.suggested_deadline && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          Scadenza: {format(new Date(req.suggested_deadline + 'T00:00:00'), 'd MMM yyyy', { locale: it })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(req.created_at), 'd MMM, HH:mm', { locale: it })}
                      </span>
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => {
                            setApproving(req);
                            setSelectedEnterprise('');
                            setSelectedProject('');
                          }}
                        >
                          <Check className="h-3.5 w-3.5" /> Approva
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => updateStatus(req.id, 'rejected')}>
                          <X className="h-3.5 w-3.5" /> Rifiuta
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-muted-foreground" onClick={() => updateStatus(req.id, 'archived')}>
                          <Archive className="h-3.5 w-3.5" /> Archivia
                        </Button>
                      </div>
                    )}

                    {req.status !== 'pending' && req.resolved_at && (
                      <p className="text-[10px] text-muted-foreground/60 pt-1">
                        {req.status === 'approved' ? 'Approvata' : req.status === 'rejected' ? 'Rifiutata' : 'Archiviata'} il {format(new Date(req.resolved_at), 'd MMM yyyy, HH:mm', { locale: it })}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approving} onOpenChange={open => { if (!open) setApproving(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approva e classifica</DialogTitle>
          </DialogHeader>

          {approving && (
            <div className="space-y-4">
              <Card className="p-3 bg-primary/5 border-primary/15">
                <p className="text-sm font-medium">{approving.title}</p>
                {approving.description && (
                  <p className="text-xs text-muted-foreground mt-1">{approving.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  Da: {approving.requester_name} ({approving.requester_email})
                </p>
              </Card>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Impresa *
                  </Label>
                  <Select value={selectedEnterprise} onValueChange={v => { setSelectedEnterprise(v); setSelectedProject(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona impresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {enterprises.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: `hsl(${e.color})` }} />
                            {e.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" /> Progetto *
                  </Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject} disabled={!selectedEnterprise}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedEnterprise ? 'Seleziona progetto' : 'Seleziona prima un\'impresa'} />
                    </SelectTrigger>
                    <SelectContent>
                      {enterpriseProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Annulla</Button>
            <Button onClick={handleApprove} disabled={saving || !selectedEnterprise || !selectedProject}>
              {saving ? 'Salvataggio...' : 'Approva e inserisci nel backlog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
