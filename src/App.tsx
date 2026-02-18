import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

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
            <Route path="/leaderboard/tv" element={<TVSlideshow />} />
            <Route path="*" element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/accountability" element={<TimeAccountability />} />
                  <Route path="/cleaners" element={<CleanerPerformance />} />
                  <Route path="/properties" element={<PropertyIntelligence />} />
                  <Route path="/property/:id" element={<PropertyProfilePage />} />
                  <Route path="/maintenance" element={<MaintenanceTracker />} />
                  <Route path="/maintenance/command" element={<MaintenanceCommandCenter />} />
                  <Route path="/maintenance/dispatch" element={<TechDispatch />} />
                  <Route path="/maintenance/queue" element={<SchedulingQueue />} />
                  <Route path="/team" element={<TeamWorkload />} />
                  <Route path="/billing" element={<BillingRevenue />} />
                  <Route path="/person/:name" element={<PersonProfile />} />
                  <Route path="/trends" element={<TrendsInsights />} />
                  <Route path="/satisfaction" element={<GuestSatisfaction />} />
                  <Route path="/leaderboard" element={<HousekeepingLeaderboard />} />
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
