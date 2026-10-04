import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Paperclip, Upload, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const BUCKET = 'task-attachments';
const MAX_MB = 20;

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (data) setItems(data as Attachment[]);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    const tooBig = list.find(f => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(`"${tooBig.name}" supera il limite di ${MAX_MB} MB`);
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      const safeName = file.name.replace(/[^\w.\-() ]/g, '_');
      const path = `${user.id}/${taskId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (upErr) { toast.error(`Errore caricamento "${file.name}"`); continue; }
      const { error: dbErr } = await supabase.from('task_attachments').insert({
        user_id: user.id,
        task_id: taskId,
        file_name: file.name,
        file_path: path,
        content_type: file.type || null,
        size_bytes: file.size,
      });
      if (dbErr) { toast.error(`Errore salvataggio "${file.name}"`); continue; }
      ok++;
    }
    setUploading(false);
    if (ok > 0) { toast.success(ok === 1 ? 'File allegato' : `${ok} file allegati`); load(); }
  };

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.file_path, 60);
    if (error || !data) { toast.error('Impossibile aprire il file'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (a: Attachment) => {
    if (!window.confirm(`Eliminare l'allegato "${a.file_name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([a.file_path]);
    await supabase.from('task_attachments').delete().eq('id', a.id);
    setItems(prev => prev.filter(x => x.id !== a.id));
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" /> Allegati
        {items.length > 0 && <span className="text-xs text-muted-foreground">({items.length})</span>}
      </Label>

      <div
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent/50'}`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Caricamento...</span>
        ) : (
          <span className="flex items-center justify-center gap-2"><Upload className="h-3.5 w-3.5" /> Trascina qui i file o tocca per scegliere (max {MAX_MB} MB)</span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map(a => (
            <div key={a.id} className="text-xs bg-accent/50 rounded-md p-2 flex items-center gap-2">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate flex-1">{a.file_name}</span>
              <span className="text-muted-foreground shrink-0">{fmtSize(a.size_bytes)}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => download(a)} title="Apri">
                <Download className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive" onClick={() => remove(a)} title="Elimina">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
