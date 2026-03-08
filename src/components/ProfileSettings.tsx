import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Lock, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function ProfileSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || '');
          setAvatarUrl(data.avatar_url || '');
        }
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null })
      .eq('user_id', user.id);
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
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email-display">Email</Label>
            <Input id="email-display" value={user?.email || ''} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome visualizzato</Label>
            <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Il tuo nome" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar-url">URL Avatar</Label>
            <Input id="avatar-url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
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
    </div>
  );
}
