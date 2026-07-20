import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Users,
  Boxes,
  Truck,
  Bed,
  ChefHat,
  Wallet,
  Clock,
  Link2,
  Calculator,
  Tv,
  MonitorPlay,
  CreditCard,
  GitBranch,
  UserCheck,
  BarChart3,
  Heart,
  Ticket,
  Barcode,
  FolderInput,
  CalendarRange,
  CalendarClock,
  Printer,
  RefreshCw,
  Settings,
  Search,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ClipboardList,
  ArrowRightLeft,
  FileEdit
} from 'lucide-react';

interface MenuCard {
  name: string;
  description: string;
  href: string;
  icon: any;
  iconGradientClass: string;
  requiredRight?: string;
  hasRedDot?: boolean;
  isComingSoon?: boolean;
  category: 'core' | 'catalog' | 'purchasing' | 'management';
}

export default function DashboardMenu() {
  const { user, getUserRights, getLandingPage } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'catalog' | 'purchasing' | 'management'>('all');

  useEffect(() => {
    if (user) {
      const landingPage = getLandingPage(user);
      if (landingPage !== '/') {
        navigate(landingPage, { replace: true });
      }
    }
  }, [user, getLandingPage, navigate]);

  const rights = user ? getUserRights(user) : null;

  const menuItems: MenuCard[] = [
    {
      name: 'Dashboard Stats',
      description: 'Overview of business performance and key metrics',
      href: '/stats',
      icon: LayoutDashboard,
      iconGradientClass: 'from-rose-500 to-pink-500 shadow-rose-500/20',
      requiredRight: 'viewDashboard',
      category: 'management'
    },
    {
      name: 'Point of Sale (POS)',
      description: 'Process quick counter sales and checkout transactions',
      href: '/pos',
      icon: ShoppingCart,
      iconGradientClass: 'from-amber-500 to-orange-550 shadow-amber-500/20',
      requiredRight: 'viewOrders',
      hasRedDot: true,
      category: 'core'
    },
    {
      name: 'Hotel & Accommodation',
      description: 'Guest room assignments, bookings, and schedules',
      href: '/accommodation',
      icon: Bed,
      iconGradientClass: 'from-emerald-500 to-teal-500 shadow-emerald-500/20',
      requiredRight: 'viewAccommodation',
      hasRedDot: true,
      category: 'core'
    },
    {
      name: 'Online Orders',
      description: 'View and manage orders received from e-commerce',
      href: '/orders',
      icon: ShoppingBag,
      iconGradientClass: 'from-indigo-500 to-blue-500 shadow-indigo-500/20',
      requiredRight: 'viewOnlineOrders',
      hasRedDot: true,
      category: 'core'
    },
    {
      name: 'Customer Listing',
      description: 'Manage guest details, accounts, and contact history',
      href: '/customers',
      icon: Users,
      iconGradientClass: 'from-cyan-500 to-blue-500 shadow-cyan-500/20',
      requiredRight: 'viewCustomers',
      category: 'catalog'
    },
    {
      name: 'Inventory & Stock',
      description: 'Track stock takes, transfers, and warehouse counts',
      href: '/inventory',
      icon: Boxes,
      iconGradientClass: 'from-sky-500 to-blue-600 shadow-sky-500/20',
      requiredRight: 'viewInventory',
      category: 'catalog'
    },
    {
      name: 'Stock Take',
      description: 'Perform physical stock counts and reconcile variances',
      href: '/stock-take',
      icon: ClipboardList,
      iconGradientClass: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
      requiredRight: 'stockTake',
      category: 'catalog'
    },
    {
      name: 'Stock Transfers',
      description: 'Move stock between locations and track transit',
      href: '/transfers',
      icon: ArrowRightLeft,
      iconGradientClass: 'from-violet-500 to-purple-600 shadow-violet-500/20',
      requiredRight: 'stockAdjustment',
      category: 'catalog'
    },
    {
      name: 'Stock Adjustments',
      description: 'Manually adjust stock levels for damages or losses',
      href: '/adjustments',
      icon: FileEdit,
      iconGradientClass: 'from-red-500 to-rose-600 shadow-red-500/20',
      requiredRight: 'stockAdjustment',
      category: 'catalog'
    },
    {
      name: 'Purchases & Procurement',
      description: 'Supplier purchase orders, receiving, and ledgers',
      href: '/purchasing',
      icon: Truck,
      iconGradientClass: 'from-pink-500 to-red-500 shadow-pink-500/20',
      requiredRight: 'managePurchasing',
      category: 'purchasing'
    },
    {
      name: 'Production & Recipes',
      description: 'Raw materials formulas and product assembly',
      href: '/recipes',
      icon: ChefHat,
      iconGradientClass: 'from-orange-500 to-red-500 shadow-orange-500/20',
      requiredRight: 'manageRecipes',
      category: 'catalog'
    },
    {
      name: 'Supplier Accounts',
      description: 'Procurement bills, credits, and payables',
      href: '/supplier-accounts',
      icon: Wallet,
      iconGradientClass: 'from-indigo-600 to-purple-600 shadow-indigo-600/20',
      requiredRight: 'managePurchasing',
      category: 'purchasing'
    },
    {
      name: 'Company Branches',
      description: 'Manage store outlets and location parameters',
      href: '/locations',
      icon: GitBranch,
      iconGradientClass: 'from-violet-500 to-fuchsia-500 shadow-violet-500/20',
      requiredRight: 'viewSettings',
      category: 'management'
    },
    {
      name: 'Users & Access',
      description: 'Staff profiles, system credentials, and permissions',
      href: '/users',
      icon: UserCheck,
      iconGradientClass: 'from-emerald-500 to-green-500 shadow-emerald-500/20',
      requiredRight: 'viewUsers',
      category: 'management'
    },
    {
      name: 'System Reports',
      description: 'Export sales reports, stock values, and tax sheets',
      href: '/reports',
      icon: BarChart3,
      iconGradientClass: 'from-amber-600 to-orange-700 shadow-amber-600/20',
      requiredRight: 'viewReports',
      category: 'management'
    },
    {
      name: 'Custom Reports',
      description: 'Upload and execute Jasper report templates dynamically',
      href: '/custom-reports',
      icon: FolderInput,
      iconGradientClass: 'from-amber-500 to-yellow-600 shadow-amber-500/20',
      requiredRight: 'viewReports',
      category: 'management'
    },
    {
      name: 'Coupons & Vouchers',
      description: 'Active customer loyalty discounts and vouchers',
      href: '/promotions',
      icon: Ticket,
      iconGradientClass: 'from-rose-500 to-orange-500 shadow-rose-500/20',
      requiredRight: 'managePromotions',
      category: 'catalog'
    },
    {
      name: 'Products & Variants',
      description: 'Catalog products, sizing variants, and retail pricing',
      href: '/products',
      icon: Barcode,
      iconGradientClass: 'from-blue-600 to-sky-500 shadow-blue-600/20',
      requiredRight: 'viewProducts',
      category: 'catalog'
    },
    {
      name: 'System Settings',
      description: 'Configure receipts, currency, taxes, and integrations',
      href: '/settings',
      icon: Settings,
      iconGradientClass: 'from-slate-600 to-slate-800 shadow-slate-600/20',
      requiredRight: 'viewSettings',
      category: 'management'
    }
  ];

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // 1. Right check
      if (item.requiredRight && rights && rights[item.requiredRight as any] === 'no') {
        return false;
      }
      // 2. Category check
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      // 3. Search check
      if (searchQuery.trim() !== '') {
        return (
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return true;
    });
  }, [rights, searchQuery, activeCategory]);

  const handleCardClick = (item: MenuCard) => {
    if (item.isComingSoon) {
      toast.info(`${item.name} module is coming soon!`);
      return;
    }
    navigate(item.href);
  };

  return (
    <AppLayout title="Main Modules">
      <div className="space-y-8 py-2 max-w-7xl mx-auto px-4">
        
        {/* Welcome Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles className="h-40 w-40 animate-pulse text-indigo-400" />
          </div>
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-450 border border-indigo-500/20 text-xs font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              Smart Business Hub
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight">
                Welcome back, {user?.name || 'Administrator'}!
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Choose a module below to process sales, oversee hotel reservations, or manage store operations.
              </p>
            </div>
            
            {/* Search Input */}
            <div className="relative max-w-md shadow-md pt-2">
              <Search className="absolute left-3.5 top-[calc(50%+4px)] h-4.5 w-4.5 -translate-y-1/2 text-slate-450" />
              <Input
                placeholder="Search modules (e.g. POS, bookings)..."
                className="w-full pl-10 h-11 text-sm bg-slate-800/40 border-slate-700/60 text-white rounded-xl placeholder:text-slate-500 focus-visible:ring-indigo-500/30"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto scrollbar-none gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'core', label: 'Operations & POS' },
            { id: 'catalog', label: 'Inventory & Catalog' },
            { id: 'purchasing', label: 'Purchasing & Ledger' },
            { id: 'management', label: 'Admin & Reports' }
          ].filter(cat => cat.id === 'all' || menuItems.some(item => 
            item.category === cat.id && 
            (!item.requiredRight || !rights || rights[item.requiredRight as any] !== 'no')
          )).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={cn(
                "px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap border border-transparent",
                activeCategory === cat.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Highlighted Operations Grid */}
        {activeCategory === 'all' && searchQuery.trim() === '' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Services</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems
                .filter(item => item.name === 'Point of Sale (POS)' || item.name === 'Hotel & Accommodation')
                .map(item => (
                  <Card 
                    key={item.name} 
                    onClick={() => handleCardClick(item)}
                    className="relative group border border-slate-150/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl p-5 cursor-pointer shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300 overflow-hidden flex flex-row items-center gap-4"
                  >
                    <div className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shrink-0",
                      item.iconGradientClass
                    )}>
                      <item.icon className="h-8 w-8" />
                    </div>
                    <div className="flex-grow min-w-0 pr-6">
                      <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-indigo-650 transition-colors flex items-center gap-2">
                        {item.name}
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    {item.hasRedDot && (
                      <span className="absolute top-4 right-4 flex h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                    )}
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Regular Modules Grid */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {activeCategory === 'all' ? 'All Functions' : 'Filtered Modules'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.name}
                onClick={() => handleCardClick(item)}
                className="group flex items-start gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl cursor-pointer hover:border-slate-200 dark:hover:border-slate-700/80 shadow-card hover:shadow-lg transition-all duration-300 relative overflow-hidden"
              >
                {/* Icon Circle */}
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md group-hover:scale-105 transition-transform shrink-0",
                  item.iconGradientClass
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                
                {/* Text Content */}
                <div className="space-y-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                    {item.name}
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Arrow indicator on hover */}
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />

                {item.hasRedDot && (
                  <span className="absolute top-3 right-3 flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-slate-400 border border-dashed rounded-3xl bg-slate-50/30">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No modules found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
