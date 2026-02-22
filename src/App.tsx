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
import Spend from "./pages/Spend";
import PropertyDirectory from "./pages/PropertyDirectory";
import ListingsManager from "./pages/ListingsManager";
import NetworkWifi from "./pages/NetworkWifi";
import PropertySetup from "./pages/PropertySetup";
import OwnerDirectory from "./pages/owners/OwnerDirectory";
import OwnerStatements from "./pages/owners/OwnerStatements";
import OwnerCommunications from "./pages/owners/OwnerCommunications";
import OwnerSatisfaction from "./pages/owners/OwnerSatisfaction";
import OwnerPipeline from "./pages/owners/OwnerPipeline";
import SalesPipeline from "./pages/sales/SalesPipeline";
import OnboardingTracker from "./pages/sales/OnboardingTracker";
import MarketProspecting from "./pages/sales/MarketProspecting";
import ChurnRisk from "./pages/sales/ChurnRisk";
import GuestDirectory from "./pages/guests/GuestDirectory";
import ReviewManagement from "./pages/guests/ReviewManagement";
import GuestCommunications from "./pages/guests/GuestCommunications";
import ExperienceTracker from "./pages/guests/ExperienceTracker";
import SupplyLevels from "./pages/inventory/SupplyLevels";
import VendorDirectory from "./pages/inventory/VendorDirectory";
import PurchaseOrders from "./pages/inventory/PurchaseOrders";
import OpenRoles from "./pages/hiring/OpenRoles";
import HireOnboarding from "./pages/hiring/HireOnboarding";
import TeamRecognition from "./pages/hiring/TeamRecognition";
import DeviceFleet from "./pages/it/DeviceFleet";
import IntegrationHealth from "./pages/it/IntegrationHealth";
import AutomationDirectory from "./pages/it/AutomationDirectory";
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

                  {/* Finance */}
                  <Route path="/finance/spend" element={<Spend />} />

                  {/* Properties */}
                  <Route path="/properties/directory" element={<PropertyDirectory />} />
                  <Route path="/properties/listings" element={<ListingsManager />} />
                  <Route path="/properties/network" element={<NetworkWifi />} />
                  <Route path="/properties/setup" element={<PropertySetup />} />

                  {/* Analytics */}
                  <Route path="/analytics/trends" element={<TrendsInsights />} />
                  <Route path="/analytics/properties" element={<PropertyIntelligence />} />
                  <Route path="/analytics/billing" element={<BillingRevenue />} />

                  {/* Owner Relations */}
                  <Route path="/owners/directory" element={<OwnerDirectory />} />
                  <Route path="/owners/statements" element={<OwnerStatements />} />
                  <Route path="/owners/communications" element={<OwnerCommunications />} />
                  <Route path="/owners/satisfaction" element={<OwnerSatisfaction />} />
                  <Route path="/owners/pipeline" element={<OwnerPipeline />} />

                  {/* Sales & Growth */}
                  <Route path="/sales/pipeline" element={<SalesPipeline />} />
                  <Route path="/sales/onboarding" element={<OnboardingTracker />} />
                  <Route path="/sales/prospecting" element={<MarketProspecting />} />
                  <Route path="/sales/churn" element={<ChurnRisk />} />

                  {/* Guest Experience */}
                  <Route path="/guests/directory" element={<GuestDirectory />} />
                  <Route path="/guests/reviews" element={<ReviewManagement />} />
                  <Route path="/guests/communications" element={<GuestCommunications />} />
                  <Route path="/guests/experience" element={<ExperienceTracker />} />

                  {/* Inventory & Supplies */}
                  <Route path="/inventory/supplies" element={<SupplyLevels />} />
                  <Route path="/inventory/vendors" element={<VendorDirectory />} />
                  <Route path="/inventory/orders" element={<PurchaseOrders />} />

                  {/* Hiring & Culture */}
                  <Route path="/hiring/roles" element={<OpenRoles />} />
                  <Route path="/hiring/onboarding" element={<HireOnboarding />} />
                  <Route path="/hiring/recognition" element={<TeamRecognition />} />

                  {/* IT & Infrastructure */}
                  <Route path="/it/devices" element={<DeviceFleet />} />
                  <Route path="/it/integrations" element={<IntegrationHealth />} />
                  <Route path="/it/automations" element={<AutomationDirectory />} />

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
                  <Route path="/spend" element={<Navigate to="/finance/spend" replace />} />

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
