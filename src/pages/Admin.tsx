import { useAdmin } from '@/hooks/use-admin';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Bot, Volume2 } from 'lucide-react';
import { AiPromptsSettings } from '@/components/AiPromptsSettings';
import { AiVoiceSettings } from '@/components/admin/AiVoiceSettings';

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Verifica accesso...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurazione avanzata AI e sistema vocale Radar
        </p>
      </div>

      <Tabs defaultValue="voice" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="voice" className="flex-1 gap-1.5">
            <Volume2 className="h-4 w-4" />
            Voice AI
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex-1 gap-1.5">
            <Bot className="h-4 w-4" />
            AI Prompts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice">
          <AiVoiceSettings />
        </TabsContent>

        <TabsContent value="prompts">
          <AiPromptsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
