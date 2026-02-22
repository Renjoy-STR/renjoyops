import { useState } from 'react';
import {
  LayoutDashboard,
  SprayCan,
  Building2,
  Wrench,
  Users,
  Clock,
  TrendingUp,
  DollarSign,
  CreditCard,
  Star,
  Monitor,
  Radio,
  Truck,
  ClipboardList,
  BarChart2,
  Timer,
  Flame,
  HeartPulse,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

interface NavGroup {
  label: string;
  emoji: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: 'Daily Operations',
    emoji: '⏱️',
    defaultOpen: true,
    items: [
      { title: 'Daily Task Timeline', url: '/ops/timeline', icon: Timer },
      { title: 'Pulse', url: '/ops/pulse', icon: Flame },
      { title: 'Command Center', url: '/ops/command', icon: Radio },
      { title: 'Tech Dispatch', url: '/ops/dispatch', icon: Truck },
    ],
  },
  {
    label: 'Housekeeping',
    emoji: '🧹',
    items: [
      { title: 'Cleaner Performance', url: '/housekeeping/performance', icon: SprayCan },
      { title: 'Leaderboard', url: '/housekeeping/leaderboard', icon: Monitor },
      { title: 'Guest Satisfaction', url: '/housekeeping/satisfaction', icon: Star },
    ],
  },
  {
    label: 'Maintenance',
    emoji: '🔧',
    items: [
      { title: 'Maintenance Tracker', url: '/maintenance', icon: Wrench },
      { title: 'Scheduling Queue', url: '/maintenance/queue', icon: ClipboardList },
      { title: 'Property Health', url: '/maintenance/properties', icon: HeartPulse },
      { title: 'Maintenance Insights', url: '/maintenance/insights', icon: BarChart2 },
    ],
  },
  {
    label: 'People & Time',
    emoji: '👥',
    items: [
      { title: 'Time Accountability', url: '/people/accountability', icon: Clock },
      { title: 'Team Workload', url: '/people/team', icon: Users },
    ],
  },
  {
    label: 'Finance',
    emoji: '💰',
    items: [
      { title: 'Spend Dashboard', url: '/finance/spend', icon: CreditCard },
    ],
  },
  {
    label: 'Analytics',
    emoji: '📈',
    items: [
      { title: 'Trends & Insights', url: '/analytics/trends', icon: TrendingUp },
      { title: 'Property Intelligence', url: '/analytics/properties', icon: Building2 },
      { title: 'Billing & Revenue', url: '/analytics/billing', icon: DollarSign },
    ],
  },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(item => pathname === item.url || pathname.startsWith(item.url + '/'));
}

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-black tracking-tight" style={{ color: '#F04C3B' }}>
          Renjoy
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#75241C' }}>Property Operations</p>
      </div>
      <SidebarContent>
        {/* Overview — standalone, no group */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/"
                    end
                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors border-l-2 border-transparent hover:bg-[#FFEFEF]"
                    activeClassName="bg-[#FFEFEF] font-semibold !border-l-2 !border-[#F04C3B]"
                    style={{ color: '#242427' }}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" style={{ color: '#F04C3B' }} />
                    <span className="text-sm" style={{ fontFamily: 'Figtree, sans-serif' }}>Overview</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsible nav groups */}
        {navGroups.map((group) => {
          const groupActive = isGroupActive(group, location.pathname);
          return (
            <CollapsibleNavGroup
              key={group.label}
              group={group}
              pathname={location.pathname}
              defaultOpen={group.defaultOpen || groupActive}
            />
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

function CollapsibleNavGroup({ group, pathname, defaultOpen }: { group: NavGroup; pathname: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup className="py-0">
        <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[#FFEFEF]/50 rounded-md transition-colors group">
          <span className="text-xs">{group.emoji}</span>
          <span
            className="text-[11px] font-bold uppercase tracking-wider flex-1"
            style={{ color: '#75241C', fontFamily: 'Figtree, sans-serif' }}
          >
            {group.label}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
            style={{ color: '#75241C' }}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 pl-7 pr-3 py-1.5 rounded-md transition-colors border-l-2 border-transparent hover:bg-[#FFEFEF]"
                      activeClassName="bg-[#FFEFEF] font-semibold !border-l-2 !border-[#F04C3B]"
                      style={{ color: '#242427' }}
                    >
                      <item.icon className="h-4 w-4 shrink-0" style={{ color: '#F04C3B' }} />
                      <span className="text-sm" style={{ fontFamily: 'Figtree, sans-serif' }}>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
