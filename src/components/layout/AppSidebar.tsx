import {
  LayoutDashboard,
  SprayCan,
  Building2,
  Wrench,
  Users,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
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
  { title: 'Cleaner Performance', url: '/cleaners', icon: SprayCan },
  { title: 'Property Intelligence', url: '/properties', icon: Building2 },
  { title: 'Maintenance Tracker', url: '/maintenance', icon: Wrench },
  { title: 'Team Workload', url: '/team', icon: Users },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-sidebar-border">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-extrabold tracking-tight">
          <span className="text-gradient">Renjoy</span>
        </h1>
        <p className="text-[11px] text-sidebar-foreground/60 mt-0.5">Property Operations</p>
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
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
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
