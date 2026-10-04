import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Paperclip, Upload, Trash2, Download, Loader2, Eye, File, FileText, Image as ImageIcon } from 'lucide-react';
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

function isImage(a: Attachment): boolean {
  return a.content_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.file_name);
}

function isPdf(a: Attachment): boolean {
  return a.content_type === 'application/pdf' || /\.pdf$/i.test(a.file_name);
}

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewApi, setPreviewApi] = useState<CarouselApi>();
  const [visibleIndex, setVisibleIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (!data) return;
    const attachments = data as Attachment[];
    setItems(attachments);
    const urls = await Promise.all(attachments.map(async attachment => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.file_path, 3600);
      return [attachment.id, signed?.signedUrl] as const;
    }));
    setSignedUrls(Object.fromEntries(urls.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
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
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.file_path, 60, { download: a.file_name });
    if (error || !data) { toast.error('Impossibile aprire il file'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setVisibleIndex(index);
  };

  useEffect(() => {
    if (previewIndex === null || !previewApi) return;
    previewApi.scrollTo(previewIndex, true);
  }, [previewApi, previewIndex]);

  useEffect(() => {
    if (!previewApi) return;
    const updateIndex = () => setVisibleIndex(previewApi.selectedScrollSnap());
    updateIndex();
    previewApi.on('select', updateIndex);
    return () => { previewApi.off('select', updateIndex); };
  }, [previewApi]);

  const remove = async (a: Attachment) => {
    if (!window.confirm(`Eliminare l'allegato "${a.file_name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([a.file_path]);
    await supabase.from('task_attachments').delete().eq('id', a.id);
    setItems(prev => prev.filter(x => x.id !== a.id));
    setSignedUrls(prev => {
      const next = { ...prev };
      delete next[a.id];
      return next;
    });
    setPreviewIndex(null);
  };

  const previewAttachment = items[visibleIndex];

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
        <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
          <CarouselContent className="-ml-2">
            {items.map((a, index) => {
              const url = signedUrls[a.id];
              return (
                <CarouselItem key={a.id} className="basis-[78%] pl-2 sm:basis-[48%]">
                  <div className="overflow-hidden rounded-md border bg-accent/30">
                    <button
                      type="button"
                      onClick={() => openPreview(index)}
                      className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Visualizza ${a.file_name}`}
                    >
                      <div className="flex h-24 items-center justify-center overflow-hidden bg-muted/60">
                        {isImage(a) && url ? (
                          <img src={url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                        ) : isPdf(a) ? (
                          <FileText className="h-9 w-9 text-destructive" />
                        ) : (
                          <File className="h-9 w-9 text-muted-foreground" />
                        )}
                        <span className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Eye className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="px-2 pt-2">
                        <p className="truncate text-xs font-medium">{a.file_name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtSize(a.size_bytes)}</p>
                      </div>
                    </button>
                    <div className="flex justify-end gap-1 px-1 pb-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openPreview(index)} title="Anteprima">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(a)} title="Scarica">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a)} title="Elimina">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}

      <Dialog open={previewIndex !== null} onOpenChange={open => { if (!open) setPreviewIndex(null); }}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-4xl flex-col gap-3 p-3 sm:p-5">
          <DialogHeader className="min-w-0 pr-8 text-left">
            <DialogTitle className="truncate text-base">{previewAttachment?.file_name || 'Anteprima allegato'}</DialogTitle>
          </DialogHeader>
          <Carousel setApi={setPreviewApi} opts={{ startIndex: previewIndex ?? 0 }} className="min-h-0 w-full px-0 sm:px-10">
            <CarouselContent>
              {items.map(a => {
                const url = signedUrls[a.id];
                return (
                  <CarouselItem key={a.id}>
                    <div className="flex h-[65dvh] items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                      {!url ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : isImage(a) ? (
                        <img src={url} alt={a.file_name} className="max-h-full max-w-full object-contain" />
                      ) : isPdf(a) ? (
                        <iframe src={url} title={a.file_name} className="h-full w-full bg-background" />
                      ) : (
                        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          <p className="break-words text-sm font-medium">{a.file_name}</p>
                          <p className="text-xs text-muted-foreground">Questo formato non dispone di anteprima.</p>
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            {items.length > 1 && (
              <>
                <CarouselPrevious className="left-1 hidden sm:inline-flex" />
                <CarouselNext className="right-1 hidden sm:inline-flex" />
              </>
            )}
          </Carousel>
          <div className="flex min-h-9 items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{items.length > 0 ? `${visibleIndex + 1} di ${items.length}` : ''}</span>
            {previewAttachment && (
              <Button size="sm" onClick={() => download(previewAttachment)} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Scarica
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
