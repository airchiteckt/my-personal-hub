import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PrpProvider } from "@/context/PrpContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Enterprises from "./pages/Enterprises";
import EnterpriseDetail from "./pages/EnterpriseDetail";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import AiPrompts from "./pages/AiPrompts";
import NotFound from "./pages/NotFound";
import { AiAssistant } from "./components/AiAssistant";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Caricamento...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <PrpProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/enterprises" element={<Enterprises />} />
          <Route path="/enterprise/:id" element={<EnterpriseDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai-prompts" element={<AiPrompts />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AiAssistant />
    </PrpProvider>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
