import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  Settings,
  SlidersHorizontal,
  Users,
  ArrowRightLeft,
  History,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Boxes },
  { name: 'Stock Adjustment', href: '/adjustments', icon: SlidersHorizontal },
  { name: 'Point of Sale', href: '/pos', icon: ShoppingCart },
  { name: 'Stock Take', href: '/stock-take', icon: ClipboardList },
  { name: 'Stock Transfer', href: '/transfers', icon: ArrowRightLeft },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Stock Journal', href: '/journal', icon: History },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Users', href: '/users', icon: Users },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out bg-sidebar border-r border-sidebar-border text-sidebar-foreground",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full flex-col">
        {/* Logo & Toggle */}
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-3 transition-all duration-300",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <div className={cn("flex items-center gap-2 px-2 overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
              <Boxes className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold whitespace-nowrap">StockFlow</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn("h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground transition-all duration-300", isCollapsed && "scale-110")}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  'sidebar-link flex items-center gap-3',
                  isActive && 'sidebar-link-active',
                  isCollapsed && 'justify-center px-0'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="transition-opacity duration-300">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="border-t border-sidebar-border p-3">
          <NavLink
            to="/settings"
            title={isCollapsed ? 'Settings' : undefined}
            className={cn(
              'sidebar-link flex items-center gap-3',
              location.pathname === '/settings' && 'sidebar-link-active',
              isCollapsed && 'justify-center px-0'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="transition-opacity duration-300">Settings</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
