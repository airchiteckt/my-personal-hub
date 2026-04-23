import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Bot, Volume2, Target, ArrowLeft, LogOut, ToggleRight, Gauge } from 'lucide-react';
import { AiPromptsSettings } from '@/components/AiPromptsSettings';
import { AiVoiceSettings } from '@/components/admin/AiVoiceSettings';
import { PlanningThresholds } from '@/components/admin/PlanningThresholds';
import { FeatureFlagsSettings } from '@/components/admin/FeatureFlagsSettings';
import { AiUsageLimits } from '@/components/admin/AiUsageLimits';
import { Button } from '@/components/ui/button';

const Admin = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">FlyDeck</span>
          </a>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Backoffice</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>}
          <Button variant="ghost" size="icon" onClick={signOut} title="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configurazione avanzata AI, sistema vocale e pianificazione
          </p>
        </div>

        <Tabs defaultValue="features" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="features" className="flex-1 gap-1.5">
              <ToggleRight className="h-4 w-4" />
              Funzioni
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex-1 gap-1.5">
              <Gauge className="h-4 w-4" />
              Limiti AI
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex-1 gap-1.5">
              <Volume2 className="h-4 w-4" />
              Voice AI
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex-1 gap-1.5">
              <Bot className="h-4 w-4" />
              AI Prompts
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex-1 gap-1.5">
              <Target className="h-4 w-4" />
              Pianificazione
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features">
            <FeatureFlagsSettings />
          </TabsContent>

          <TabsContent value="usage">
            <AiUsageLimits />
          </TabsContent>

          <TabsContent value="voice">
            <AiVoiceSettings />
          </TabsContent>

          <TabsContent value="prompts">
            <AiPromptsSettings />
          </TabsContent>

          <TabsContent value="planning">
            <PlanningThresholds />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
