import {
  LayoutDashboard,
  SprayCan,
  Building2,
  Wrench,
  Users,
  Clock,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Overview', url: '/', icon: LayoutDashboard },
  { title: 'Time Accountability', url: '/accountability', icon: Clock, isNew: true },
  { title: 'Cleaner Performance', url: '/cleaners', icon: SprayCan },
  { title: 'Property Intelligence', url: '/properties', icon: Building2 },
  { title: 'Maintenance Tracker', url: '/maintenance', icon: Wrench },
  { title: 'Team Workload', url: '/team', icon: Users },
  { title: 'Billing & Revenue', url: '/billing', icon: DollarSign, isNew: true },
  { title: 'Trends & Insights', url: '/trends', icon: TrendingUp },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-black tracking-tight text-gradient">
          Renjoy
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">Property Operations</p>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors border-l-2 border-transparent"
                      activeClassName="bg-accent text-primary font-semibold !border-l-2 !border-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
                      {(item as any).isNew && (
                        <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-primary text-primary-foreground ml-auto">NEW</Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
