import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Mail, Lock, Save, Loader2, Upload, X, Compass } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { resetOnboarding } from '@/components/OnboardingTour';

export function ProfileSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url, phone_number')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || '');
          setAvatarUrl(data.avatar_url || '');
          setPhoneNumber((data as any).phone_number || '');
        }
      });
  }, [user]);

  const normalizePhone = (raw: string) => {
    const cleaned = raw.trim().replace(/[\s.\-()]/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '');
    if (cleaned.startsWith('00')) return '+' + cleaned.slice(2).replace(/\D/g, '');
    const digits = cleaned.replace(/\D/g, '');
    return digits ? `+39${digits}` : '';
  };

  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'File non valido', description: 'Carica un\'immagine (JPG, PNG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File troppo grande', description: 'Massimo 5MB.', variant: 'destructive' });
      return;
    }

    setAvatarUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Errore upload', description: error.message, variant: 'destructive' });
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);

    await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
    setAvatarUploading(false);
    toast({ title: 'Avatar aggiornato' });
  }, [user]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadAvatar(file);
  }, [uploadAvatar]);

  const removeAvatar = async () => {
    if (!user) return;
    setAvatarUrl('');
    await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
    toast({ title: 'Avatar rimosso' });
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const phone = normalizePhone(phoneNumber);
    if (phoneNumber.trim() && !/^\+[1-9]\d{6,14}$/.test(phone)) {
      setLoading(false);
      toast({ title: 'Numero non valido', description: 'Usa il formato internazionale, es. +39 333 1234567.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), phone_number: phone || null })
      .eq('user_id', user.id);
    setPhoneNumber(phone);
    setLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profilo aggiornato' });
    }
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email di conferma inviata', description: 'Controlla la tua casella per confermare il cambio.' });
      setNewEmail('');
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Password troppo corta', description: 'Minimo 6 caratteri.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Le password non coincidono', variant: 'destructive' });
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password aggiornata' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile info */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Informazioni Profilo</h3>
        </div>
        <div className="space-y-4">
          {/* Avatar upload */}
          <div className="space-y-2">
            <Label>Foto profilo</Label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <div className="relative">
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-20 w-20 rounded-full object-cover border-2 border-border"
                    />
                    <button
                      onClick={removeAvatar}
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                {avatarUploading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Caricamento...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Trascina un'immagine o <span className="text-primary font-medium">clicca per caricare</span>
                    </span>
                    <span className="text-xs text-muted-foreground/70">JPG, PNG, WebP • Max 5MB</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-display">Email</Label>
            <Input id="email-display" value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome visualizzato</Label>
            <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Il tuo nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-number">Cellulare</Label>
            <div className="flex gap-2">
              <Input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={e => { setPhoneNumber(e.target.value); setPhoneVerified(false); setOtpSent(false); }}
                placeholder="+39 333 1234567"
              />
              {phoneVerified ? (
                <span className="flex items-center gap-1 text-xs text-primary whitespace-nowrap px-2">
                  <ShieldCheck className="h-4 w-4" /> Verificato
                </span>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={sendOtp} disabled={otpLoading || !phoneNumber.trim()}>
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? 'Rinvia codice' : 'Verifica'}
                </Button>
              )}
            </div>
            {otpSent && !phoneVerified && (
              <div className="flex gap-2 pt-1">
                <Input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Codice a 6 cifre"
                  inputMode="numeric"
                />
                <Button type="button" size="sm" onClick={checkOtp} disabled={otpLoading || otpCode.length < 4}>
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conferma'}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Serve per chiamare Radar e per ricevere le chiamate dei promemoria importanti. Ti inviamo un codice via SMS da "FlyDeck" per confermare che il numero sia tuo.
            </p>
          </div>
          <Button onClick={saveProfile} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Salva Profilo
          </Button>
        </div>
      </Card>

      {/* Change email */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Cambia Email</h3>
        </div>
        <p className="text-xs text-muted-foreground">Riceverai un'email di conferma al nuovo indirizzo.</p>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-email">Nuova email</Label>
            <Input id="new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuova@email.com" />
          </div>
          <Button onClick={changeEmail} disabled={emailLoading || !newEmail.trim()} size="sm" variant="outline">
            {emailLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
            Aggiorna Email
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Cambia Password</h3>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-pw">Nuova password</Label>
            <Input id="new-pw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caratteri" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Conferma password</Label>
            <Input id="confirm-pw" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ripeti la password" />
          </div>
          <Button onClick={changePassword} disabled={pwLoading || !newPassword} size="sm" variant="outline">
            {pwLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Lock className="h-4 w-4 mr-1.5" />}
            Aggiorna Password
          </Button>
        </div>
      </Card>

      {/* Onboarding tour */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Tour Guidato</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Rivedi l'introduzione alle funzionalità principali di FlyDeck.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!user) return;
            resetOnboarding(user.id);
            toast({ title: 'Tour riavviato', description: 'Ricarica la pagina per vederlo.' });
          }}
        >
          <Compass className="h-4 w-4 mr-1.5" />
          Rivedi tour
        </Button>
      </Card>
    </div>
  );
}
