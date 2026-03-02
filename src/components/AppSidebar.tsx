import { Building2, CalendarDays, CalendarRange, Settings, BarChart3, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { usePrp } from '@/context/PrpContext';
import { useAuth } from '@/context/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Oggi', url: '/', icon: CalendarDays },
  { title: 'Calendario', url: '/calendar', icon: CalendarRange },
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Imprese', url: '/enterprises', icon: Building2 },
  { title: 'Impostazioni', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { enterprises } = usePrp();
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="p-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 4.3 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-foreground leading-none">FlyDeck</h1>
                <p className="text-[9px] text-muted-foreground tracking-widest uppercase font-medium mt-0.5">Strategic Cockpit</p>
              </div>
            </div>
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

      <SidebarFooter className="p-3 border-t">
        {!collapsed && user && (
          <p className="text-[11px] text-muted-foreground truncate mb-2 px-1">{user.email}</p>
        )}
        <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} className="w-full justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Esci</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
