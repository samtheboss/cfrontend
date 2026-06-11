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
  ChevronRight,
  Image as ImageIcon,
  Truck,
  X,
  ChefHat,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { UserRights } from '@/types/user';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  requiredRight: keyof UserRights;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, requiredRight: 'viewDashboard' },
  { name: 'Products', href: '/products', icon: Package, requiredRight: 'viewProducts' },
  { name: 'Inventory', href: '/inventory', icon: Boxes, requiredRight: 'viewInventory' },
  { name: 'Stock Adjustment', href: '/adjustments', icon: SlidersHorizontal, requiredRight: 'stockAdjustment' },
  { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, requiredRight: 'viewOrders' },
  { name: 'Online Orders', href: '/orders', icon: Truck, requiredRight: 'viewOrders' },
  { name: 'Stock Take', href: '/stock-take', icon: ClipboardList, requiredRight: 'stockTake' },
  { name: 'Recipes/Production', href: '/recipes', icon: ChefHat, requiredRight: 'manageRecipes' },
  { name: 'Purchasing', href: '/purchasing', icon: ShoppingBag, requiredRight: 'managePurchasing' },
  { name: 'Supplier Accounts', href: '/supplier-accounts', icon: Wallet, requiredRight: 'managePurchasing' },
  { name: 'Stock Transfer', href: '/transfers', icon: ArrowRightLeft, requiredRight: 'stockAdjustment' },
  { name: 'Reports', href: '/reports', icon: BarChart3, requiredRight: 'viewReports' },
  { name: 'Stock Journal', href: '/journal', icon: History, requiredRight: 'viewInventory' },
  { name: 'Customers', href: '/customers', icon: Users, requiredRight: 'viewCustomers' },
  { name: 'Locations', href: '/locations', icon: MapPin, requiredRight: 'viewSettings' },
  { name: 'Users', href: '/users', icon: Users, requiredRight: 'viewUsers' },
  { name: 'Banners', href: '/slides', icon: ImageIcon, requiredRight: 'viewSettings' },
  { name: 'Promotions', href: '/promotions', icon: Boxes, requiredRight: 'viewProducts' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user, getUserRights } = useAuth();

  const rights = user ? getUserRights(user) : null;

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity duration-300",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
      />

      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen transition-all duration-300 ease-in-out bg-sidebar border-r border-sidebar-border text-sidebar-foreground",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-16" : "lg:w-64",
        "w-64 shadow-2xl lg:shadow-none"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo & Toggle */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-3 transition-all duration-300",
            "justify-between lg:justify-between",
            isCollapsed && "lg:justify-center"
          )}>
            <div className={cn("flex items-center gap-2 px-2 overflow-hidden transition-all duration-300", (isCollapsed && !isMobileOpen) ? "lg:w-0 lg:opacity-0 lg:hidden" : "w-auto opacity-100")}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
                <Boxes className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold whitespace-nowrap">StockFlow</span>
            </div>

            <div className="flex items-center">
              {/* Desktop Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className={cn(
                  "h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground transition-all duration-300 hidden lg:flex",
                  isCollapsed && "scale-110"
                )}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>

              {/* Mobile Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onMobileClose}
                className="h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border">
            {navigation.map((item) => {
              // Check rights
              if (rights && rights[item.requiredRight] === 'no') return null;

              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onMobileClose}
                  title={(isCollapsed && !isMobileOpen) ? item.name : undefined}
                  className={cn(
                    'sidebar-link flex items-center gap-3',
                    isActive && 'sidebar-link-active',
                    (isCollapsed && !isMobileOpen) && 'lg:justify-center lg:px-0'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {(!isCollapsed || isMobileOpen) && <span className="transition-opacity duration-300">{item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* Settings - manually check rights */}
          {rights?.viewSettings !== 'no' && (
            <div className="border-t border-sidebar-border p-3">
              <NavLink
                to="/settings"
                onClick={onMobileClose}
                title={(isCollapsed && !isMobileOpen) ? 'Settings' : undefined}
                className={cn(
                  'sidebar-link flex items-center gap-3',
                  location.pathname === '/settings' && 'sidebar-link-active',
                  (isCollapsed && !isMobileOpen) && 'lg:justify-center lg:px-0'
                )}
              >
                <Settings className="h-5 w-5 shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span className="transition-opacity duration-300">Settings</span>}
              </NavLink>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
