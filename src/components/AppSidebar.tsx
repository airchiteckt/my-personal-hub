import { Building2, CalendarDays, CalendarRange, Settings } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { usePrp } from '@/context/PrpContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Oggi', url: '/', icon: CalendarDays },
  { title: 'Calendario', url: '/calendar', icon: CalendarRange },
  { title: 'Imprese', url: '/enterprises', icon: Building2 },
  { title: 'Priorità', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { enterprises } = usePrp();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="p-5 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">PRP</h1>
            <p className="text-[11px] text-muted-foreground tracking-wide uppercase">Personal Resource Planning</p>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigazione</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && enterprises.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Imprese</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {enterprises.map(e => (
                  <SidebarMenuItem key={e.id}>
                    <SidebarMenuButton asChild>
                      <NavLink to={`/enterprise/${e.id}`} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent font-medium">
                        <span className="mr-2 h-3 w-3 rounded-full inline-block shrink-0" style={{ backgroundColor: `hsl(${e.color})` }} />
                        <span className="truncate">{e.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
