import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
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
  Search
} from 'lucide-react';

interface MenuCard {
  name: string;
  href: string;
  icon: any;
  iconColorClass: string;
  iconBgClass: string;
  requiredRight?: string;
  hasRedDot?: boolean;
  isComingSoon?: boolean;
}

export default function DashboardMenu() {
  const { user, getUserRights } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const rights = user ? getUserRights(user) : null;

  const menuItems: MenuCard[] = [
    {
      name: 'Dashboard',
      href: '/stats',
      icon: LayoutDashboard,
      iconColorClass: 'text-rose-600',
      iconBgClass: 'bg-rose-50 dark:bg-rose-950/20',
      requiredRight: 'viewDashboard'
    },
    {
      name: 'POS',
      href: '/pos',
      icon: ShoppingCart,
      iconColorClass: 'text-amber-600',
      iconBgClass: 'bg-amber-50 dark:bg-amber-950/20',
      requiredRight: 'viewOrders',
      hasRedDot: true
    },
    {
      name: 'Online Orders',
      href: '/orders',
      icon: ShoppingBag,
      iconColorClass: 'text-indigo-600',
      iconBgClass: 'bg-indigo-50 dark:bg-indigo-950/20',
      requiredRight: 'viewOrders',
      hasRedDot: true
    },
    {
      name: 'Customer Listing',
      href: '/customers',
      icon: Users,
      iconColorClass: 'text-teal-600',
      iconBgClass: 'bg-teal-50 dark:bg-teal-950/20',
      requiredRight: 'viewCustomers'
    },
    {
      name: 'Inventory & Stock',
      href: '/inventory',
      icon: Boxes,
      iconColorClass: 'text-sky-600',
      iconBgClass: 'bg-sky-50 dark:bg-sky-950/20',
      requiredRight: 'viewInventory'
    },
    {
      name: 'Purchases & Procurement',
      href: '/purchasing',
      icon: Truck,
      iconColorClass: 'text-pink-600',
      iconBgClass: 'bg-pink-50 dark:bg-pink-950/20',
      requiredRight: 'managePurchasing'
    },
    {
      name: 'Hotel & Accomodation',
      href: '/accommodation',
      icon: Bed,
      iconColorClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
      hasRedDot: true
    },
    {
      name: 'Production',
      href: '/recipes',
      icon: ChefHat,
      iconColorClass: 'text-rose-600',
      iconBgClass: 'bg-rose-50 dark:bg-rose-950/20',
      requiredRight: 'manageRecipes'
    },
    {
      name: 'Suppier Accounts',
      href: '/supplier-accounts',
      icon: Wallet,
      iconColorClass: 'text-blue-600',
      iconBgClass: 'bg-blue-50 dark:bg-blue-950/20',
      requiredRight: 'managePurchasing'
    },
    {
      name: 'User Shifts',
      href: '#',
      icon: Clock,
      iconColorClass: 'text-purple-600',
      iconBgClass: 'bg-purple-50 dark:bg-purple-950/20',
      isComingSoon: true
    },
    {
      name: 'API Payments',
      href: '#',
      icon: Link2,
      iconColorClass: 'text-teal-600',
      iconBgClass: 'bg-teal-50 dark:bg-teal-950/20',
      isComingSoon: true
    },
    {
      name: 'TIMS Transactions',
      href: '#',
      icon: Calculator,
      iconColorClass: 'text-amber-800',
      iconBgClass: 'bg-amber-100/50 dark:bg-amber-950/20',
      isComingSoon: true
    },
    {
      name: 'Kitchen Display (KDS)',
      href: '#',
      icon: Tv,
      iconColorClass: 'text-red-600',
      iconBgClass: 'bg-red-50 dark:bg-red-950/20',
      isComingSoon: true
    },
    {
      name: 'Customer Order Display (COD)',
      href: '#',
      icon: MonitorPlay,
      iconColorClass: 'text-cyan-600',
      iconBgClass: 'bg-cyan-50 dark:bg-cyan-950/20',
      isComingSoon: true
    },
    {
      name: 'Payment Methods',
      href: '#',
      icon: CreditCard,
      iconColorClass: 'text-blue-600',
      iconBgClass: 'bg-blue-50 dark:bg-blue-950/20',
      requiredRight: 'viewSettings',
      isComingSoon: true
    },
    {
      name: 'Company Branches',
      href: '/locations',
      icon: GitBranch,
      iconColorClass: 'text-purple-600',
      iconBgClass: 'bg-purple-50 dark:bg-purple-950/20',
      requiredRight: 'viewSettings'
    },
    {
      name: 'Users & Access',
      href: '/users',
      icon: UserCheck,
      iconColorClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
      requiredRight: 'viewUsers'
    },
    {
      name: 'System Reports',
      href: '/reports',
      icon: BarChart3,
      iconColorClass: 'text-amber-800',
      iconBgClass: 'bg-amber-100/50 dark:bg-amber-950/20',
      requiredRight: 'viewReports'
    },
    {
      name: 'Loyalty Cards',
      href: '#',
      icon: Heart,
      iconColorClass: 'text-purple-600',
      iconBgClass: 'bg-purple-50 dark:bg-purple-950/20',
      isComingSoon: true
    },
    {
      name: 'Coupons ,promotions & Vouchers',
      href: '/promotions',
      icon: Ticket,
      iconColorClass: 'text-amber-600',
      iconBgClass: 'bg-amber-50 dark:bg-amber-950/20',
      requiredRight: 'viewProducts'
    },
    {
      name: 'Products',
      href: '/products',
      icon: Barcode,
      iconColorClass: 'text-blue-600',
      iconBgClass: 'bg-blue-50 dark:bg-blue-950/20',
      requiredRight: 'viewProducts'
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: FolderInput,
      iconColorClass: 'text-amber-800',
      iconBgClass: 'bg-amber-100/50 dark:bg-amber-950/20',
      requiredRight: 'viewInventory'
    },
    {
      name: 'Recurring Bills',
      href: '#',
      icon: CalendarRange,
      iconColorClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-950/20',
      isComingSoon: true
    },
    {
      name: 'Scheduled Jobs',
      href: '#',
      icon: CalendarClock,
      iconColorClass: 'text-purple-600',
      iconBgClass: 'bg-purple-50 dark:bg-purple-950/20',
      isComingSoon: true
    },
    {
      name: 'System Updates',
      href: '#',
      icon: RefreshCw,
      iconColorClass: 'text-blue-600',
      iconBgClass: 'bg-blue-50 dark:bg-blue-950/20',
      isComingSoon: true
    },
    {
      name: 'System Settings',
      href: '/settings',
      icon: Settings,
      iconColorClass: 'text-rose-600',
      iconBgClass: 'bg-rose-50 dark:bg-rose-950/20',
      requiredRight: 'viewSettings'
    }
  ];

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // Hide coming soon modules
      if (item.isComingSoon) {
        return false;
      }
      // 1. Right check
      if (item.requiredRight && rights && rights[item.requiredRight as any] === 'no') {
        return false;
      }
      // 2. Search check
      if (searchQuery.trim() !== '') {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [rights, searchQuery]);

  const handleCardClick = (item: MenuCard) => {
    if (item.isComingSoon) {
      toast.info(`${item.name} module is coming soon!`);
      return;
    }
    navigate(item.href);
  };

  return (
    <AppLayout title="Main Menu">
      <div className="flex flex-col items-center w-full space-y-8 py-4 px-2 md:px-6">
        {/* Search Bar */}
        <div className="relative w-full max-w-lg shadow-sm">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search modules..."
            className="w-full pl-10 h-11 text-sm bg-background border-slate-200/80 rounded-xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Modules Grid */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.name}
              onClick={() => handleCardClick(item)}
              className={cn(
                "relative group flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-primary/20",
                item.isComingSoon && "opacity-80"
              )}
            >
              {/* Icon Container */}
              <div className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
                item.iconBgClass
              )}>
                <item.icon className={cn("h-6 w-6", item.iconColorClass)} />

                {/* Optional Red Dot */}
                {item.hasRedDot && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>

              {/* Title */}
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 text-center mt-3 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                {item.name}
              </span>

              {/* Coming Soon Indicator */}
              {item.isComingSoon && (
                <span className="absolute bottom-1 right-2 text-[8px] font-bold text-muted-foreground/60 uppercase">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
