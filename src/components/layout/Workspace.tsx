import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  Home,
  LayoutDashboard,
  Barcode,
  Boxes,
  ShoppingCart,
  ArrowRightLeft,
  ClipboardList,
  ChefHat,
  Truck,
  UserCheck,
  Bed,
  Wallet,
  Building,
  FileEdit,
  CreditCard,
  TrendingDown,
  Settings,
  BarChart3,
  FileText,
  Users,
  FolderInput,
  Tag,
  Printer,
  ShoppingBag,
  Grid,
  Ticket,
  Calculator,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Import all page components
import Dashboard from '@/pages/Dashboard';
import DashboardMenu from '@/pages/DashboardMenu';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import POS from '@/pages/POS';
import Invoicing from '@/pages/Invoicing';
import CustomerAccounts from '@/pages/CustomerAccounts';
import StockAdjustment from '@/pages/StockAdjustment';
import StockTake from '@/pages/StockTake';
import StockTransfer from '@/pages/StockTransfer';
import Reports from '@/pages/Reports';
import SettingsPage from '@/pages/Settings';
import UsersPage from '@/pages/Users';
import Customers from '@/pages/Customers';
import Locations from '@/pages/Locations';
import InventoryTransactions from '@/pages/InventoryTransactions';
import Slides from '@/pages/Slides';
import Promotions from '@/pages/Promotions';
import OnlineOrders from '@/pages/OnlineOrders';
import Recipes from '@/pages/Recipes';
import Purchasing from '@/pages/Purchasing';
import SupplierAccounts from '@/pages/SupplierAccounts';
import Accommodation from '@/pages/Accommodation';
import AccommodationExpenses from '@/pages/AccommodationExpenses';
import Properties from '@/pages/Properties';
import Leases from '@/pages/Leases';
import RentCollection from '@/pages/RentCollection';
import PmsExpenses from '@/pages/PmsExpenses';
import Maintenance from '@/pages/Maintenance';
import CustomReports from '@/pages/CustomReports';
import Accounting from '@/pages/Accounting';
import NotFound from '@/pages/NotFound';

interface TabItem {
  id: string;
  title: string;
  path: string;
}

const tabMetadata: Record<string, { title: string; icon: any; component: React.ComponentType<any> }> = {
  '/': { title: 'Main Menu', icon: Home, component: DashboardMenu },
  '/stats': { title: 'Dashboard Stats', icon: LayoutDashboard, component: Dashboard },
  '/products': { title: 'Products & Variants', icon: Barcode, component: Products },
  '/inventory': { title: 'Inventory Asset', icon: Boxes, component: Inventory },
  '/pos': { title: 'Point of Sale', icon: ShoppingCart, component: POS },
  '/invoicing': { title: 'Invoicing', icon: FileText, component: Invoicing },
  '/customer-accounts': { title: 'Customer Accounts', icon: Wallet, component: CustomerAccounts },
  '/adjustments': { title: 'Stock Adjustments', icon: ArrowRightLeft, component: StockAdjustment },
  '/stock-take': { title: 'Stock Take', icon: ClipboardList, component: StockTake },
  '/recipes': { title: 'Recipes & Production', icon: ChefHat, component: Recipes },
  '/purchasing': { title: 'Purchasing', icon: Truck, component: Purchasing },
  '/supplier-accounts': { title: 'Supplier Accounts', icon: UserCheck, component: SupplierAccounts },
  '/accommodation': { title: 'Accommodation', icon: Bed, component: Accommodation },
  '/accommodation-expenses': { title: 'Accommodation Expenses', icon: Wallet, component: AccommodationExpenses },
  '/properties': { title: 'Properties & Units', icon: Building, component: Properties },
  '/leases': { title: 'Leases', icon: FileEdit, component: Leases },
  '/rent-collection': { title: 'Rent Collection', icon: CreditCard, component: RentCollection },
  '/pms-expenses': { title: 'Property Expenses', icon: TrendingDown, component: PmsExpenses },
  '/maintenance': { title: 'Maintenance', icon: Settings, component: Maintenance },
  '/transfers': { title: 'Stock Transfers', icon: ArrowRightLeft, component: StockTransfer },
  '/reports': { title: 'Reports & Analytics', icon: BarChart3, component: Reports },
  '/custom-reports': { title: 'Custom Reports', icon: FileText, component: CustomReports },
  '/settings': { title: 'System Settings', icon: Settings, component: SettingsPage },
  '/accounting': { title: 'Accounting & GL', icon: Calculator, component: Accounting },
  '/users': { title: 'Users & Rights', icon: Users, component: UsersPage },
  '/customers': { title: 'Customers', icon: FolderInput, component: Customers },
  '/locations': { title: 'Locations', icon: Tag, component: Locations },
  '/journal': { title: 'Transaction Journals', icon: Printer, component: InventoryTransactions },
  '/orders': { title: 'Online Orders', icon: ShoppingBag, component: OnlineOrders },
  '/slides': { title: 'Home Slides', icon: Grid, component: Slides },
  '/promotions': { title: 'Promotions', icon: Ticket, component: Promotions },
};

export function Workspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [openTabs, setOpenTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('home');

  // Per-user storage key
  const tabStorageKey = user?.id ? `workspace_tabs_${user.id}` : 'workspace_tabs';

  // Load tabs from localStorage on mount or user change
  useEffect(() => {
    const defaultTabs: TabItem[] = [{ id: 'home', title: 'Main Menu', path: '/' }];

    // Check who last owned the generic key and migrate if needed
    const lastUser = localStorage.getItem('workspace_tabs_owner');
    const currentUserId = user?.id ? String(user.id) : null;

    if (lastUser && currentUserId && lastUser !== currentUserId) {
      // Different user — clear old generic tabs
      localStorage.removeItem('workspace_tabs');
    }

    // Store current user as owner
    if (currentUserId) {
      localStorage.setItem('workspace_tabs_owner', currentUserId);
    }

    const savedTabs = localStorage.getItem(tabStorageKey);
    
    if (savedTabs) {
      try {
        const parsed = JSON.parse(savedTabs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure main menu is always first and present
          if (!parsed.some(t => t.id === 'home')) {
            parsed.unshift(defaultTabs[0]);
          }
          setOpenTabs(parsed);
        } else {
          setOpenTabs(defaultTabs);
        }
      } catch (e) {
        setOpenTabs(defaultTabs);
      }
    } else {
      setOpenTabs(defaultTabs);
    }
  }, [user?.id]);

  // Synchronize path changes with tabs
  useEffect(() => {
    const path = location.pathname;
    const meta = tabMetadata[path];
    
    if (!meta) {
      // If path is unknown, we can open NotFound
      return;
    }

    const tabId = path === '/' ? 'home' : path.replace('/', 'tab-');
    
    setOpenTabs(prev => {
      const exists = prev.some(t => t.id === tabId);
      if (exists) {
        setActiveTabId(tabId);
        return prev;
      }
      
      const newTab: TabItem = {
        id: tabId,
        title: meta.title,
        path: path
      };
      
      const updated = [...prev, newTab];
      localStorage.setItem(tabStorageKey, JSON.stringify(updated));
      setActiveTabId(tabId);
      return updated;
    });
  }, [location.pathname]);

  const handleTabClick = (tab: TabItem) => {
    navigate(tab.path);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabId === 'home') return;

    const index = openTabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    localStorage.setItem(tabStorageKey, JSON.stringify(newTabs));

    if (activeTabId === tabId) {
      const nextActiveTab = newTabs[index - 1] || newTabs[index] || newTabs[0];
      if (nextActiveTab) {
        navigate(nextActiveTab.path);
      }
    }
  };

  const handleCloseAll = () => {
    const defaultTabs: TabItem[] = [{ id: 'home', title: 'Main Menu', path: '/' }];
    setOpenTabs(defaultTabs);
    localStorage.setItem(tabStorageKey, JSON.stringify(defaultTabs));
    navigate('/');
  };

  const handleCloseOthers = () => {
    if (activeTabId === 'home') {
      handleCloseAll();
      return;
    }
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    const defaultTabs: TabItem[] = [
      { id: 'home', title: 'Main Menu', path: '/' },
      activeTab
    ];
    setOpenTabs(defaultTabs);
    localStorage.setItem(tabStorageKey, JSON.stringify(defaultTabs));
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* Sticky Tab Bar */}
      <div className="sticky top-0 z-40 h-10 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 flex items-center justify-between px-2 select-none">
        <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-none flex-1 pr-4">
          {openTabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const meta = tabMetadata[tab.path];
            const Icon = meta?.icon || Home;
            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "h-8 px-3.5 mr-1 flex items-center justify-between gap-2.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-150 border border-transparent select-none",
                  isActive
                    ? "bg-slate-800 dark:bg-slate-900 text-indigo-400 dark:text-indigo-400 border-slate-700/80 shadow-md font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-indigo-400" : "text-slate-500")} />
                  <span>{tab.title}</span>
                </div>
                {tab.id !== 'home' && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 rounded-full hover:bg-slate-700/60 text-slate-500 hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Workspace Tab Actions Dropdown */}
        <div className="flex items-center border-l border-slate-800 pl-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors duration-150 focus:outline-none">
                <MoreHorizontal className="h-4.5 w-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-250">
              <DropdownMenuItem 
                onClick={handleCloseOthers}
                disabled={openTabs.length <= 2 && activeTabId !== 'home'}
                className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white text-xs cursor-pointer py-2"
              >
                Close Other Tabs
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem 
                onClick={handleCloseAll}
                disabled={openTabs.length <= 1}
                className="hover:bg-slate-800 focus:bg-slate-800 focus:text-white text-xs cursor-pointer py-2 text-rose-400 hover:text-rose-300 focus:text-rose-300"
              >
                Close All Tabs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Render open tabs (keep in DOM to preserve state) */}
      <div className="flex-1 flex flex-col relative">
        {openTabs.map((tab) => {
          const meta = tabMetadata[tab.path];
          if (!meta) return null;
          const Component = meta.component;
          const isCurrentActive = activeTabId === tab.id;
          
          return (
            <div
              key={tab.id}
              style={{ display: isCurrentActive ? 'block' : 'none' }}
              className="w-full flex-1 flex flex-col"
            >
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}
