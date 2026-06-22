import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/use-admin";
import { PrpProvider } from "@/context/PrpContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Enterprises from "./pages/Enterprises";
import EnterpriseDetail from "./pages/EnterpriseDetail";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Cockpit from "./pages/Cockpit";
import Requests from "./pages/Requests";
import Rituals from "./pages/Rituals";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import PublicBooking from "./pages/PublicBooking";
import PublicTaskRequest from "./pages/PublicTaskRequest";
import ResetPassword from "./pages/ResetPassword";
import PublicShowcase from "./pages/PublicShowcase";
import PublicSlotPicker from "./pages/PublicSlotPicker";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
import { AiAssistant } from "./components/AiAssistant";
import { OnboardingTour } from "./components/OnboardingTour";
import { useFeatureFlags } from "./hooks/use-feature-flags";

const queryClient = new QueryClient();

function AdminRoute() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Verifica accesso...</div>
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <Admin />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Caricamento...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/home" replace />;

  return (
    <PrpProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/enterprises" element={<Enterprises />} />
          <Route path="/enterprise/:id" element={<EnterpriseDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/cockpit" element={<Cockpit />} />
          <Route path="/dashboard" element={<Navigate to="/cockpit" replace />} />
          <Route path="/radar" element={<Navigate to="/cockpit" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/rituals" element={<Rituals />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {isFeatureEnabled('feature_ai_assistant') && <AiAssistant />}
      <OnboardingTour />
    </PrpProvider>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Landing />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/home" element={<LandingRoute />} />
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/google-calendar/callback" element={<GoogleCalendarCallback />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/:slug/opencalendar" element={<PublicBooking />} />
            <Route path="/:slug/openrequest" element={<PublicTaskRequest />} />
            <Route path="/:slug/slots/:invitationSlug" element={<PublicSlotPicker />} />
            <Route path="/:slug/showcase" element={<PublicShowcase />} />
            <Route path="/:slug/showcase/:enterpriseId" element={<PublicShowcase />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
