import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Overview from "./pages/Overview";
import CleanerPerformance from "./pages/CleanerPerformance";
import PropertyIntelligence from "./pages/PropertyIntelligence";
import MaintenanceTracker from "./pages/MaintenanceTracker";
import MaintenanceCommandCenter from "./pages/MaintenanceCommandCenter";
import TeamWorkload from "./pages/TeamWorkload";
import TimeAccountability from "./pages/TimeAccountability";
import PersonProfile from "./pages/PersonProfile";
import PropertyProfilePage from "./pages/PropertyProfile";
import BillingRevenue from "./pages/BillingRevenue";
import TrendsInsights from "./pages/TrendsInsights";
import GuestSatisfaction from "./pages/GuestSatisfaction";
import HousekeepingLeaderboard from "./pages/HousekeepingLeaderboard";
import TVSlideshow from "./pages/TVSlideshow";
import TechDispatch from "./pages/TechDispatch";
import SchedulingQueue from "./pages/SchedulingQueue";
import MaintenanceInsights from "./pages/MaintenanceInsights";
import MaintenanceTimeEfficiency from "./pages/MaintenanceTimeEfficiency";
import MaintenancePulsePage from "./pages/MaintenancePulsePage";
import MaintenanceProperties from "./pages/MaintenanceProperties";
import TechProfilePage from "./pages/TechProfilePage";
import NotFound from "./pages/NotFound";
import { AdminGuard } from "@/components/admin/AdminGuard";
import SystemHealth from "./pages/admin/SystemHealth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DateRangeProvider>
        <BrowserRouter>
          <Routes>
            {/* Full-screen routes (no layout) */}
            <Route path="/leaderboard/tv" element={<TVSlideshow />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminGuard />}>
              <Route path="system-health" element={
                <AppLayout>
                  <SystemHealth />
                </AppLayout>
              } />
            </Route>

            {/* Main app routes */}
            <Route path="*" element={
              <AppLayout>
                <Routes>
                  {/* Overview */}
                  <Route path="/" element={<Overview />} />

                  {/* Daily Operations */}
                  <Route path="/ops/timeline" element={<MaintenanceTimeEfficiency />} />
                  <Route path="/ops/pulse" element={<MaintenancePulsePage />} />
                  <Route path="/ops/command" element={<MaintenanceCommandCenter />} />
                  <Route path="/ops/dispatch" element={<TechDispatch />} />

                  {/* Housekeeping */}
                  <Route path="/housekeeping/performance" element={<CleanerPerformance />} />
                  <Route path="/housekeeping/leaderboard" element={<HousekeepingLeaderboard />} />
                  <Route path="/housekeeping/satisfaction" element={<GuestSatisfaction />} />

                  {/* Maintenance */}
                  <Route path="/maintenance" element={<MaintenanceTracker />} />
                  <Route path="/maintenance/queue" element={<SchedulingQueue />} />
                  <Route path="/maintenance/insights" element={<MaintenanceInsights />} />
                  <Route path="/maintenance/properties" element={<MaintenanceProperties />} />

                  {/* People & Time */}
                  <Route path="/people/accountability" element={<TimeAccountability />} />
                  <Route path="/people/team" element={<TeamWorkload />} />

                  {/* Analytics */}
                  <Route path="/analytics/trends" element={<TrendsInsights />} />
                  <Route path="/analytics/properties" element={<PropertyIntelligence />} />
                  <Route path="/analytics/billing" element={<BillingRevenue />} />

                  {/* Hidden routes (not in nav) */}
                  <Route path="/property/:id" element={<PropertyProfilePage />} />
                  <Route path="/person/:name" element={<PersonProfile />} />
                  <Route path="/maintenance/tech/:techName" element={<TechProfilePage />} />

                  {/* Redirects from old routes to new routes */}
                  <Route path="/maintenance/efficiency" element={<Navigate to="/ops/timeline" replace />} />
                  <Route path="/maintenance/pulse" element={<Navigate to="/ops/pulse" replace />} />
                  <Route path="/maintenance/command" element={<Navigate to="/ops/command" replace />} />
                  <Route path="/maintenance/dispatch" element={<Navigate to="/ops/dispatch" replace />} />
                  <Route path="/cleaners" element={<Navigate to="/housekeeping/performance" replace />} />
                  <Route path="/leaderboard" element={<Navigate to="/housekeeping/leaderboard" replace />} />
                  <Route path="/satisfaction" element={<Navigate to="/housekeeping/satisfaction" replace />} />
                  <Route path="/accountability" element={<Navigate to="/people/accountability" replace />} />
                  <Route path="/team" element={<Navigate to="/people/team" replace />} />
                  <Route path="/trends" element={<Navigate to="/analytics/trends" replace />} />
                  <Route path="/properties" element={<Navigate to="/analytics/properties" replace />} />
                  <Route path="/billing" element={<Navigate to="/analytics/billing" replace />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            } />
          </Routes>
        </BrowserRouter>
      </DateRangeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
