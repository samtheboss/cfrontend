import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, DollarSign, AlertTriangle, Filter, Eye, RefreshCw, Loader2, Upload, Trash, Calendar, Users, MapPin, Tag, Edit, Download, Search, CreditCard, Wallet, Clock, Hourglass, CheckCircle2, Printer, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { format, isAfter, isBefore, isEqual, compareAsc } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

export default function Reports() {
  const { products, transactions, locations, refreshData, customers, categories, tables } = useInventory();
  const { allUsers } = useAuth();
  const { sym } = useCurrency();

  // Format date as local ISO string (no Z suffix) to match backend LocalDateTime
  const formatLocalISO = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Report State (Global Filters)
  const todayStr = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  })();
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');
  const [reportLocationId, setReportLocationId] = useState<string>('all');
  const [reportUserId, setReportUserId] = useState<string>('all');

  // Helper to build Date with time from state (uses local time constructor to avoid UTC parsing issues)
  const buildStartDate = () => {
    const [h, m] = (startTime || '00:00').split(':').map(Number);
    const [year, month, day] = startDate.split('-').map(Number);
    return new Date(year, month - 1, day, h || 0, m || 0, 0, 0);
  };
  const buildEndDate = () => {
    const [h, m] = (endTime || '23:59').split(':').map(Number);
    const [year, month, day] = endDate.split('-').map(Number);
    return new Date(year, month - 1, day, h ?? 23, m ?? 59, 59, 999);
  };

  // ── Print & Export Utilities ───────────────────────────────────────────
  const printTable = (tableId: string, title: string) => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Clone table to avoid modifying original
    const tableClone = table.cloneNode(true) as HTMLTableElement;

    // Styles for printable window
    const style = printWindow.document.createElement('style');
    style.innerHTML = `
      body { font-family: 'Arial', sans-serif; color: #333; padding: 20px; }
      h1 { font-family: 'Georgia', serif; font-size: 20px; color: #78350f; margin-bottom: 20px; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
      th { background-color: #fef3c7; color: #78350f; font-weight: bold; border: 1px solid #f59e0b; padding: 8px 10px; text-align: left; }
      td { border: 1px solid #f3f4f6; padding: 8px 10px; }
      tr:nth-child(even) { background-color: #fffbeb; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-bold { font-weight: bold; }
    `;

    printWindow.document.head.appendChild(style);
    
    const h1 = printWindow.document.createElement('h1');
    h1.innerText = title;
    printWindow.document.body.appendChild(h1);
    printWindow.document.body.appendChild(tableClone);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const exportToCSV = (data: any[], headers: string[], filename: string) => {
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    for (const row of data) {
      const values = row.map((val: any) => {
        const escaped = (val === null || val === undefined ? '' : String(val)).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // All Sales (Primary Data Source)
  const sales = useMemo(() => transactions.filter(t => t.type === 'SALE'), [transactions]);

  // Active Inventory Data
  const activeProducts = useMemo(() => products.filter(p => p.isActive !== false), [products]);
  const activeVariants = useMemo(() => activeProducts.flatMap(p => p.variants.filter(v => v.isActive !== false)), [activeProducts]);

  // Filtered Sales (Based on Date Range)
  const filteredSales = useMemo(() => {
    const start = buildStartDate();
    const end = buildEndDate();

    // ── Sales Report Query Log ──────────────────────────────────────────
    console.group('%c[Sales Report Query]', 'color: #d97706; font-weight: bold; font-size: 13px;');
    console.log('%cBackend API Endpoint:', 'font-weight: bold;', 'GET /api/transactions');
    console.log('%cBackend JPA Query:', 'font-weight: bold;', 'SELECT t FROM InventoryTransaction t  (findAll — no server-side date filter applied)');
    console.log('%cFrontend Type Filter:', 'font-weight: bold;', "transactions.filter(t => t.type === 'SALE')");
    console.log('%cFrontend Date Range:', 'font-weight: bold;', {
      startDate: `${startDate} ${startTime}`,
      endDate: `${endDate} ${endTime}`,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    });
    console.log('%cFrontend Location Filter:', 'font-weight: bold;', reportLocationId === 'all' ? 'All Locations' : `Location ID: ${reportLocationId}`);
    console.log('%cFrontend User Filter:', 'font-weight: bold;', reportUserId === 'all' ? 'All Users' : `User ID: ${reportUserId}`);
    console.log('%cTotal transactions (all types):', 'font-weight: bold;', transactions.length);
    console.log('%cSales before date filter:', 'font-weight: bold;', sales.length);
    console.groupEnd();
    // ─────────────────────────────────────────────────────────────────────

    console.log('[filteredSales] start:', start.toString(), '| ISO:', start.toISOString());
    console.log('[filteredSales] end:', end.toString(), '| ISO:', end.toISOString());
    console.log('[filteredSales] Total sales before filter:', sales.length);
    if (sales.length > 0) {
      console.log('[filteredSales] Sample sale timestamp:', sales[0].timestamp, '| parsed:', new Date(sales[0].timestamp).toString());
    }

    const result = sales.filter(s => {
      const d = new Date(s.timestamp);
      const inDateRange = (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
      const matchLocation = reportLocationId === 'all' || !s.locationId || String(s.locationId) === reportLocationId;
      const matchUser = reportUserId === 'all' || !s.userId || String(s.userId) === reportUserId || String((s as any).cashierId) === reportUserId || String((s as any).createdBy) === reportUserId;
      return inDateRange && matchLocation && matchUser;
    });
    console.log('[filteredSales] After filter:', result.length);
    return result;
  }, [sales, startDate, endDate, startTime, endTime, reportLocationId, reportUserId]);

  // Returns Data
  const returns = useMemo(() => transactions.filter(t => t.type === 'RETURN'), [transactions]);
  const filteredReturns = useMemo(() => {
    const start = buildStartDate();
    const end = buildEndDate();

    return returns.filter(s => {
      const d = new Date(s.timestamp);
      const inDateRange = (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
      const matchLocation = reportLocationId === 'all' || !s.locationId || String(s.locationId) === reportLocationId;
      const matchUser = reportUserId === 'all' || !s.userId || String(s.userId) === reportUserId || String((s as any).cashierId) === reportUserId || String((s as any).createdBy) === reportUserId;
      return inDateRange && matchLocation && matchUser;
    });
  }, [returns, startDate, endDate, startTime, endTime, reportLocationId, reportUserId]);

  const getVariantStock = (variant: any, locId: string = reportLocationId) => {
    if (!locId || locId === 'all') return variant.stock || 0;
    if (!variant.locationStock) return 0;
    return variant.locationStock[locId] ?? variant.locationStock[String(locId)] ?? variant.locationStock[Number(locId)] ?? 0;
  };

  // Key Metrics (Based on Filtered Sales)
  const totalSales = filteredSales.reduce((sum, s) => sum + (s.total || s.totalAmount || 0), 0);
  const totalItems = filteredSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.adjustment, 0), 0);

  // Inventory Metrics (Current State - Filtered by Location)
  const totalInventoryValue = activeVariants.reduce((sum, v) => sum + (getVariantStock(v) * v.cost), 0);
  const totalRetailValue = activeVariants.reduce((sum, v) => sum + (getVariantStock(v) * v.price), 0);

  // Stock Status (Current State - Filtered by Location)
  const inStock = activeVariants.filter(v => getVariantStock(v) > v.lowStockThreshold).length;
  const lowStock = activeVariants.filter(v => getVariantStock(v) > 0 && getVariantStock(v) <= v.lowStockThreshold).length;
  const outOfStock = activeVariants.filter(v => getVariantStock(v) === 0).length;

  const stockStatusData = [
    { name: 'In Stock', value: inStock, color: 'hsl(var(--success))' },
    { name: 'Low Stock', value: lowStock, color: 'hsl(var(--warning))' },
    { name: 'Out of Stock', value: outOfStock, color: 'hsl(var(--destructive))' },
  ];

  // Best Sellers (Filtered)
  const bestSellers = useMemo(() => {
    const productSales: Record<string, number> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        productSales[item.productName] = (productSales[item.productName] || 0) + item.adjustment;
      });
    });
    return Object.entries(productSales)
      .map(([name, count]) => ({ name, sales: count }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [filteredSales]);

  // Sales by Category (Filtered)
  const salesByCategory = useMemo(() => {
    const catSales: Record<string, number> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const product = products.find(p => p.name === item.productName);
        const category = product?.category || 'Uncategorized';
        catSales[category] = (catSales[category] || 0) + (item.adjustment * (item.price || 0));
      });
    });
    return Object.entries(catSales).map(([category, sales]) => ({ category, sales }));
  }, [filteredSales, products]);

  // Sales Trend (Filtered)
  const dailySales = useMemo(() => {
    const trend: Record<string, number> = {};
    filteredSales.forEach(s => {
      const day = format(new Date(s.timestamp), 'MMM d');
      trend[day] = (trend[day] || 0) + (s.total || s.totalAmount || 0);
    });
    return Object.entries(trend).map(([day, sales]) => ({ day, sales }));
  }, [filteredSales]);

  // Payments Data (Fetched from combined API)
  const [combinedPayments, setCombinedPayments] = useState<any[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<'all' | 'POS' | 'ACCOMMODATION'>('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  // "payment" = key the report on when money was received; "sale" = on the order date.
  const [paymentDateBasis, setPaymentDateBasis] = useState<'payment' | 'sale'>('payment');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [salesGroupBy, setSalesGroupBy] = useState<'date' | 'user' | 'category' | 'location' | 'item' | 'table' | 'customer' | 'payment'>('date');
  const [returnsSearchQuery, setReturnsSearchQuery] = useState('');
  const [fastMovingSearchQuery, setFastMovingSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [purchasesSearchQuery, setPurchasesSearchQuery] = useState('');
  const [purchasesStatusFilter, setPurchasesStatusFilter] = useState<'all' | 'RECEIVED' | 'PENDING' | 'ORDERED'>('all');
  const [profitabilitySearchQuery, setProfitabilitySearchQuery] = useState('');

  const getCardStyle = (method: string, index: number) => {
    const m = (method || '').toUpperCase();
    if (m.includes('CASH')) {
      return {
        bg: 'bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100',
        badgeBg: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700',
        dot: 'bg-emerald-500',
        iconBg: 'bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200',
        barBg: 'bg-emerald-200 dark:bg-emerald-800',
        barFill: 'bg-emerald-600 dark:bg-emerald-400',
        icon: <Wallet className="w-4 h-4" />,
        desc: 'Drawer counted'
      };
    } else if (m.includes('CARD') || m.includes('VISA') || m.includes('MASTERCARD')) {
      return {
        bg: 'bg-gradient-to-br from-indigo-50/90 to-purple-100/70 border-indigo-200/80 dark:from-indigo-950/40 dark:to-purple-900/30 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-100',
        badgeBg: 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
        dot: 'bg-indigo-500',
        iconBg: 'bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/50 dark:text-indigo-200',
        barBg: 'bg-indigo-200 dark:bg-indigo-800',
        barFill: 'bg-indigo-600 dark:bg-indigo-400',
        icon: <CreditCard className="w-4 h-4" />,
        desc: 'Settled to bank'
      };
    } else if (m.includes('MPESA') || m.includes('M-PESA') || m.includes('MOBILE')) {
      return {
        bg: 'bg-gradient-to-br from-green-50/90 to-emerald-100/70 border-green-200/80 dark:from-green-950/40 dark:to-emerald-900/30 dark:border-green-800/50 text-green-950 dark:text-green-100',
        badgeBg: 'bg-green-100/80 text-green-800 dark:bg-green-900/60 dark:text-green-200 border-green-200 dark:border-green-700',
        dot: 'bg-green-600',
        iconBg: 'bg-green-200/60 text-green-800 dark:bg-green-800/50 dark:text-green-200',
        barBg: 'bg-green-200 dark:bg-green-800',
        barFill: 'bg-green-600 dark:bg-green-400',
        icon: <DollarSign className="w-4 h-4" />,
        desc: 'Mobile money verified'
      };
    } else if (m.includes('LATER') || m.includes('CREDIT') || m.includes('TAB') || m.includes('PENDING')) {
      return {
        bg: 'bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100',
        badgeBg: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200 dark:border-amber-700',
        dot: 'bg-amber-500',
        iconBg: 'bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200',
        barBg: 'bg-amber-200 dark:bg-amber-800',
        barFill: 'bg-amber-600 dark:bg-amber-400',
        icon: <Clock className="w-4 h-4" />,
        desc: 'Awaiting collection'
      };
    } else {
      const lightPalettes = [
        {
          bg: 'bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100',
          badgeBg: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200 dark:border-blue-700',
          dot: 'bg-blue-500',
          iconBg: 'bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200',
          barBg: 'bg-blue-200 dark:bg-blue-800',
          barFill: 'bg-blue-600 dark:bg-blue-400',
          icon: <CheckCircle2 className="w-4 h-4" />,
          desc: 'Processed payment'
        },
        {
          bg: 'bg-gradient-to-br from-rose-50/90 to-pink-100/70 border-rose-200/80 dark:from-rose-950/40 dark:to-pink-900/30 dark:border-rose-800/50 text-rose-950 dark:text-rose-100',
          badgeBg: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-200 dark:border-rose-700',
          dot: 'bg-rose-500',
          iconBg: 'bg-rose-200/60 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200',
          barBg: 'bg-rose-200 dark:bg-rose-800',
          barFill: 'bg-rose-600 dark:bg-rose-400',
          icon: <Hourglass className="w-4 h-4" />,
          desc: 'Recorded transaction'
        },
        {
          bg: 'bg-gradient-to-br from-violet-50/90 to-fuchsia-100/70 border-violet-200/80 dark:from-violet-950/40 dark:to-fuchsia-900/30 dark:border-violet-800/50 text-violet-950 dark:text-violet-100',
          badgeBg: 'bg-violet-100/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border-violet-200 dark:border-violet-700',
          dot: 'bg-violet-500',
          iconBg: 'bg-violet-200/60 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200',
          barBg: 'bg-violet-200 dark:bg-violet-800',
          barFill: 'bg-violet-600 dark:bg-violet-400',
          icon: <Wallet className="w-4 h-4" />,
          desc: 'Standard clearance'
        }
      ];
      return lightPalettes[index % lightPalettes.length];
    }
  };

  useEffect(() => {
    const fetchPayments = async () => {
      setIsPaymentsLoading(true);
      try {
        const start = buildStartDate();
        const end = buildEndDate();
        let url = `/api/reports/payments?startDate=${formatLocalISO(start)}&endDate=${formatLocalISO(end)}&dateBasis=${paymentDateBasis}`;
        if (reportLocationId && reportLocationId !== 'all') url += `&locationId=${reportLocationId}`;
        if (reportUserId && reportUserId !== 'all') url += `&userId=${reportUserId}`;
        const res = await apiFetch<any>(url);
        setCombinedPayments(res.data || []);
      } catch (err: any) {
        toast.error('Failed to load payments: ' + err.message);
      } finally {
        setIsPaymentsLoading(false);
      }
    };
    fetchPayments();
  }, [startDate, endDate, startTime, endTime, reportLocationId, reportUserId, paymentDateBasis]);

  const filteredCombinedPayments = useMemo(() => {
    return combinedPayments.filter(p => {
      const matchLocation = reportLocationId === 'all' || !p.locationId || String(p.locationId) === reportLocationId;
      const matchUser = reportUserId === 'all' || !p.userId || String(p.userId) === reportUserId || String(p.cashierId) === reportUserId || String(p.createdBy) === reportUserId;
      const matchSource = paymentSourceFilter === 'all' || (p.source || 'POS') === paymentSourceFilter;
      const matchSearch = !paymentSearchQuery ||
        (p.reference && p.reference.toLowerCase().includes(paymentSearchQuery.toLowerCase())) ||
        (p.customerName && p.customerName.toLowerCase().includes(paymentSearchQuery.toLowerCase())) ||
        (p.method && p.method.toLowerCase().includes(paymentSearchQuery.toLowerCase()));
      return matchLocation && matchUser && matchSource && matchSearch;
    });
  }, [combinedPayments, reportLocationId, reportUserId, paymentSourceFilter, paymentSearchQuery]);

  const paymentStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredCombinedPayments.forEach(p => {
      stats[p.method] = (stats[p.method] || 0) + p.amount;
    });
    return stats;
  }, [filteredCombinedPayments]);

  // Purchases Data
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isPurchasesLoading, setIsPurchasesLoading] = useState(false);

  useEffect(() => {
    const fetchPurchases = async () => {
      setIsPurchasesLoading(true);
      try {
        const start = buildStartDate();
        const end = buildEndDate();
        let url = `/api/purchase-orders?startDate=${formatLocalISO(start)}&endDate=${formatLocalISO(end)}`;
        if (reportLocationId && reportLocationId !== 'all') url += `&locationId=${reportLocationId}`;
        if (reportUserId && reportUserId !== 'all') url += `&userId=${reportUserId}`;
        const res = await apiFetch<{ data: any[] }>(url);
        setPurchaseOrders(res.data || []);
      } catch (err: any) {
        toast.error('Failed to load purchases: ' + err.message);
      } finally {
        setIsPurchasesLoading(false);
      }
    };
    fetchPurchases();
  }, [startDate, endDate, startTime, endTime, reportLocationId, reportUserId]);

  const filteredPurchases = useMemo(() => {
    const start = buildStartDate();
    const end = buildEndDate();

    return purchaseOrders.filter(po => {
      const d = new Date(po.dateReceived || po.createdAt || po.timestamp);
      const inDateRange = (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
      const matchLocation = reportLocationId === 'all' || !po.locationId || String(po.locationId) === reportLocationId;
      const matchUser = reportUserId === 'all' || !po.userId || String(po.userId) === reportUserId || String(po.createdBy) === reportUserId;
      return inDateRange && matchLocation && matchUser;
    });
  }, [purchaseOrders, startDate, endDate, startTime, endTime, reportLocationId, reportUserId]);

  const totalPurchasesAmount = filteredPurchases.reduce((sum, po) => sum + (po.total || po.totalAmount || 0), 0);

  const dailyPurchases = useMemo(() => {
    const trend: Record<string, number> = {};
    filteredPurchases.forEach(po => {
      const day = format(new Date(po.dateReceived || po.createdAt || po.timestamp), 'MMM d');
      trend[day] = (trend[day] || 0) + (po.total || po.totalAmount || 0);
    });
    return Object.entries(trend).map(([day, purchases]) => ({ day, purchases }));
  }, [filteredPurchases]);

  // Expenses Data for Profitability Report
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isExpensesLoading, setIsExpensesLoading] = useState(false);

  useEffect(() => {
    const fetchExpenses = async () => {
      setIsExpensesLoading(true);
      try {
        const start = buildStartDate();
        const end = buildEndDate();
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const url = `/api/expenses?start=${startStr}&end=${endStr}`;
        const res = await apiFetch<any>(url);
        setExpenses(res.data || []);
      } catch (err: any) {
        toast.error('Failed to load expenses: ' + err.message);
      } finally {
        setIsExpensesLoading(false);
      }
    };
    fetchExpenses();
  }, [startDate, endDate, startTime, endTime]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchLocation = reportLocationId === 'all' || !e.locationId || String(e.locationId) === reportLocationId;
      const matchUser = reportUserId === 'all' || !e.createdBy || String(e.createdBy) === reportUserId;
      return matchLocation && matchUser;
    });
  }, [expenses, reportLocationId, reportUserId]);

  const profitabilityMetrics = useMemo(() => {
    const totalPosRevenue = filteredCombinedPayments
      .filter(p => (p.source || 'POS') === 'POS')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalBookingRevenue = filteredCombinedPayments
      .filter(p => p.source === 'ACCOMMODATION')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalRevenue = totalPosRevenue + totalBookingRevenue;

    const roomExpenses = filteredExpenses
      .filter(e => e.roomId != null)
      .reduce((sum, e) => sum + e.amount, 0);

    const generalExpenses = filteredExpenses
      .filter(e => e.roomId == null)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = roomExpenses + generalExpenses;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalPosRevenue,
      totalBookingRevenue,
      totalRevenue,
      roomExpenses,
      generalExpenses,
      totalExpenses,
      netProfit,
      profitMargin
    };
  }, [filteredCombinedPayments, filteredExpenses]);

  const expenseCategoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { amount: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      const cat = e.categoryName || 'General';
      if (!breakdown[cat]) {
        breakdown[cat] = { amount: 0, count: 0 };
      }
      breakdown[cat].amount += e.amount;
      breakdown[cat].count += 1;
    });
    return Object.entries(breakdown).map(([category, info]) => ({
      category,
      amount: info.amount,
      count: info.count
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    }
    return new Date(dateStr);
  };

  const profitabilityLedger = useMemo(() => {
    const rows: any[] = [];
    
    filteredCombinedPayments.forEach(p => {
      rows.push({
        id: `rev-${p.id || Math.random()}`,
        date: new Date(p.date),
        type: 'REVENUE',
        source: p.source === 'ACCOMMODATION' ? 'Room Booking' : 'POS Sale',
        category: p.method || 'CASH',
        description: `Received from ${p.customerName || 'Customer'} (Ref: ${p.reference || '-'})`,
        amount: p.amount
      });
    });

    filteredExpenses.forEach(e => {
      rows.push({
        id: `exp-${e.id}`,
        date: parseLocalDate(e.date),
        type: 'EXPENSE',
        source: e.roomId ? `Room ${e.roomNumber || e.roomId}` : 'General',
        category: e.categoryName || 'Expense',
        description: e.description || `Payment via ${e.paymentMethod || 'CASH'}`,
        amount: -e.amount
      });
    });

    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredCombinedPayments, filteredExpenses]);

  const filteredProfitabilityLedger = useMemo(() => {
    return profitabilityLedger.filter(item => {
      if (!profitabilitySearchQuery) return true;
      const q = profitabilitySearchQuery.toLowerCase();
      return (
        item.type.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [profitabilityLedger, profitabilitySearchQuery]);

  const handleExportProfitability = () => {
    const rows = filteredProfitabilityLedger.map(item => [
      format(item.date, 'yyyy-MM-dd HH:mm'),
      item.type,
      item.source,
      item.category,
      item.description,
      item.amount.toFixed(2)
    ]);
    exportToCSV(rows, ["Date", "Type", "Source/Category", "Method/Class", "Description", "Amount (KES)"], `Profitability_Report_${startDate}_to_${endDate}.csv`);
  };

  // Stock Movement Report State
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // Product ID
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]); // Variant IDs
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshData(startDate, endDate, reportLocationId, reportUserId);
  }, [startDate, endDate, startTime, endTime, reportLocationId, reportUserId]);

  useEffect(() => {
    setSelectedLocationId(reportLocationId);
  }, [reportLocationId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const start = buildStartDate();
    const end = buildEndDate();

    let urlPay = `/api/reports/payments?startDate=${formatLocalISO(start)}&endDate=${formatLocalISO(end)}&dateBasis=${paymentDateBasis}`;
    if (reportLocationId && reportLocationId !== 'all') urlPay += `&locationId=${reportLocationId}`;
    if (reportUserId && reportUserId !== 'all') urlPay += `&userId=${reportUserId}`;

    let urlPo = `/api/purchase-orders?startDate=${formatLocalISO(start)}&endDate=${formatLocalISO(end)}`;
    if (reportLocationId && reportLocationId !== 'all') urlPo += `&locationId=${reportLocationId}`;
    if (reportUserId && reportUserId !== 'all') urlPo += `&userId=${reportUserId}`;

    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const urlExp = `/api/expenses?start=${startStr}&end=${endStr}`;

    try {
      await Promise.all([
        refreshData(startDate, endDate, reportLocationId, reportUserId),
        apiFetch<any>(urlPay).then(res => setCombinedPayments(res.data || [])),
        apiFetch<{ data: any[] }>(urlPo).then(res => setPurchaseOrders(res.data || [])),
        apiFetch<any>(urlExp).then(res => setExpenses(res.data || []))
      ]);
    } catch (err: any) {
      toast.error('Failed to refresh report data: ' + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };



  // Helper options (Active only)
  const productOptions = activeProducts.map(p => ({
    id: p.id,
    label: p.name
  }));

  const variantOptions: Option[] = useMemo(() => {
    if (!selectedProductId) return [];

    const product = activeProducts.find(p => p.id === selectedProductId);
    if (!product) return [];

    return product.variants
      .filter(v => v.isActive !== false)
      .map(v => ({
        value: v.id,
        label: Object.values(v.attributes).join(' / ')
      }));
  }, [selectedProductId, activeProducts]);


  // Calculate stock movements for selected variant or product
  const getStockMovements = () => {
    if (!selectedProductId) return { movements: [], openingBalance: 0 };

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return { movements: [], openingBalance: 0 };

    let targetVariants = [];
    let initialTotalStock = 0;

    if (selectedVariantIds.length === 0) {
      // Default to ALL variants if none selected
      targetVariants = product.variants;
      initialTotalStock = product.variants.reduce((sum, v) => {
        return sum + getVariantStock(v, selectedLocationId);
      }, 0);
    } else {
      // Specific variants
      targetVariants = product.variants.filter(v => selectedVariantIds.includes(v.id));
      initialTotalStock = targetVariants.reduce((sum, v) => {
        return sum + getVariantStock(v, selectedLocationId);
      }, 0);
    }

    if (targetVariants.length === 0) return { movements: [], openingBalance: 0 };
    const targetVariantIds = targetVariants.map(v => v.id);

    // Filter relevant transactions (Active and within location if selected)
    const movements: {
      date: Date;
      type: 'sale' | 'adjustment' | 'transfer' | 'audit';
      quantity: number; // Positive = In, Negative = Out
      reference: string;
      runningBalance: number;
      variantInfo?: string; // To distinguish in full product view
      locationName: string;
    }[] = [];

    // 1. Sales (Out)
    sales.forEach(sale => {
      // @ts-ignore - Assuming sale has locationId or we filter generically if 'all'
      const isRelevantLocation = selectedLocationId === 'all' || String((sale as any).locationId) === String(selectedLocationId);
      if (!isRelevantLocation) return;

      sale.items.forEach(item => {
        if (targetVariantIds.includes(item.variantId)) {
          movements.push({
            date: new Date(sale.timestamp),
            type: 'sale',
            quantity: -Math.abs(item.adjustment),
            reference: `Sale #${sale.journalNumber}`,
            runningBalance: 0,
            variantInfo: Object.values(item.attributes || {}).join('/'),
            locationName: locations.find(l => String(l.id) === String((sale as any).locationId))?.name || 'Unknown'
          });
        }
      });
    });

    // 2. Adjustments & Transfers & Audits
    transactions.forEach(t => {
      if (t.type === 'SALE') return; // Handled above

      t.items.forEach(item => {
        if (!targetVariantIds.includes(item.variantId)) return;

        if (t.type === 'ADJUSTMENT') {
          const isRelevant = selectedLocationId === 'all' || String((t as any).locationId) === String(selectedLocationId);
          if (isRelevant) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'adjustment',
              quantity: item.adjustment,
              reference: `Adj: ${t.notes || 'No reason'}`,
              runningBalance: 0,
              variantInfo: item.sku,
              locationName: locations.find(l => String(l.id) === String((t as any).locationId))?.name || 'Unknown'
            });
          }
        }
        else if (t.type === 'TRANSFER') {
          const transfer = t as any;
          // Outflow from source
          if (selectedLocationId === 'all' || String(transfer.fromLocationId) === String(selectedLocationId)) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'transfer',
              quantity: -Math.abs(item.adjustment),
              reference: `Trf Out: ${locations.find(l => String(l.id) === String(transfer.toLocationId))?.name || 'Other'}`,
              runningBalance: 0,
              variantInfo: item.sku,
              locationName: locations.find(l => String(l.id) === String(transfer.fromLocationId))?.name || 'Unknown'
            });
          }
          // Inflow to destination
          if (selectedLocationId === 'all' || String(transfer.toLocationId) === String(selectedLocationId)) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'transfer',
              quantity: Math.abs(item.adjustment),
              reference: `Trf In: ${locations.find(l => String(l.id) === String(transfer.fromLocationId))?.name || 'Other'}`,
              runningBalance: 0,
              variantInfo: item.sku,
              locationName: locations.find(l => String(l.id) === String(transfer.toLocationId))?.name || 'Unknown'
            });
          }
        }
        else if (t.type === 'STOCK_TAKE') {
          const isRelevant = selectedLocationId === 'all' || String((t as any).locationId) === String(selectedLocationId);
          if (isRelevant) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'audit',
              quantity: item.adjustment,
              reference: `Audit: ${t.notes || 'Stock Take'}`,
              runningBalance: 0,
              variantInfo: item.sku,
              locationName: locations.find(l => String(l.id) === String((t as any).locationId))?.name || 'Unknown'
            });
          }
        }
        else if (t.type === 'RECEIVED') {
          const isRelevant = selectedLocationId === 'all' || String((t as any).locationId) === String(selectedLocationId);
          if (isRelevant) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'adjustment', // You can use adjustment or create a new 'purchase' type if the UI supports it
              quantity: Math.abs(item.adjustment),
              reference: `Purchase #${t.journalNumber}`,
              runningBalance: 0,
              variantInfo: item.sku,
              locationName: locations.find(l => String(l.id) === String((t as any).locationId))?.name || 'Unknown'
            });
          }
        }
      });
    });

    // Sort by date ascending
    movements.sort((a, b) => compareAsc(a.date, b.date));

    // Calculate balances
    const totalChange = movements.reduce((sum, m) => sum + m.quantity, 0);
    let openingBalance = initialTotalStock - totalChange;

    // Now calculate running balance forward
    let running = openingBalance;
    movements.forEach(m => {
      running += m.quantity;
      m.runningBalance = running;
    });

    // Filter by date range
    const start = buildStartDate();
    const end = buildEndDate();

    // Opening balance at start date
    const firstInRangeIndex = movements.findIndex(m => isAfter(m.date, start) || isEqual(m.date, start));

    if (firstInRangeIndex > 0) {
      openingBalance = movements[firstInRangeIndex - 1].runningBalance;
    } else if (firstInRangeIndex === 0) {
      // openingBalance is initial
    } else {
      if (movements.length > 0) {
        const lastMov = movements[movements.length - 1];
        if (isBefore(lastMov.date, start)) {
          openingBalance = lastMov.runningBalance;
        }
      }
    }

    const filteredMovements = movements.filter(m =>
      (isAfter(m.date, start) || isEqual(m.date, start)) &&
      (isBefore(m.date, end) || isEqual(m.date, end))
    );

    return { movements: filteredMovements, openingBalance };
  };

  const { movements, openingBalance } = getStockMovements();

  // Memoized items for tables and exports
  const stockItems = useMemo(() => {
    return activeProducts.flatMap(product =>
      product.variants.filter(v => v.isActive !== false).map(variant => {
        const currentStock = getVariantStock(variant);
        const totalCost = currentStock * variant.cost;
        const totalRetail = currentStock * variant.price;
        let statusColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
        let statusText = "In Stock";
        let statusCode = "in";
        if (currentStock === 0) {
          statusColor = "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200";
          statusText = "Out of Stock";
          statusCode = "out";
        } else if (currentStock <= variant.lowStockThreshold) {
          statusColor = "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200";
          statusText = "Low Stock";
          statusCode = "low";
        }
        return { product, variant, currentStock, totalCost, totalRetail, statusColor, statusText, statusCode };
      })
    ).filter(item => {
      const matchStatus = stockStatusFilter === 'all' || item.statusCode === stockStatusFilter;
      const matchSearch = !stockSearchQuery ||
        item.product.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        item.product.category.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        Object.values(item.variant.attributes).join(' ').toLowerCase().includes(stockSearchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [activeProducts, stockStatusFilter, stockSearchQuery, reportLocationId]);

  const salesItems = useMemo(() => {
    return filteredSales.filter(sale => {
      const isPaid = sale.status === 'COMPLETED' || sale.status === 'PAID';
      const matchStatus = salesStatusFilter === 'all' || (salesStatusFilter === 'paid' && isPaid) || (salesStatusFilter === 'pending' && !isPaid);
      const matchSearch = !salesSearchQuery ||
        sale.items.map(i => i.productName).join(' ').toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
        (sale.journalNumber && sale.journalNumber.toLowerCase().includes(salesSearchQuery.toLowerCase())) ||
        (sale.status && sale.status.toLowerCase().includes(salesSearchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [filteredSales, salesStatusFilter, salesSearchQuery]);

  const returnsItems = useMemo(() => {
    return filteredReturns.filter(r => !returnsSearchQuery || r.journalNumber.toLowerCase().includes(returnsSearchQuery.toLowerCase()) || r.items.map(i => i.productName).join(' ').toLowerCase().includes(returnsSearchQuery.toLowerCase()) || (r.notes && r.notes.toLowerCase().includes(returnsSearchQuery.toLowerCase())));
  }, [filteredReturns, returnsSearchQuery]);

  const purchasesItems = useMemo(() => {
    return filteredPurchases.filter(po => {
      const matchStatus = purchasesStatusFilter === 'all' ||
        (purchasesStatusFilter === 'RECEIVED' && (po.status === 'RECEIVED' || po.status === 'COMPLETED')) ||
        (purchasesStatusFilter === 'PENDING' && po.status !== 'RECEIVED' && po.status !== 'COMPLETED');
      const matchSearch = !purchasesSearchQuery ||
        (po.supplier?.name && po.supplier.name.toLowerCase().includes(purchasesSearchQuery.toLowerCase())) ||
        (po.journalNumber && po.journalNumber.toLowerCase().includes(purchasesSearchQuery.toLowerCase())) ||
        ((po.items || []).map((i: any) => i.productName || i.sku).join(' ').toLowerCase().includes(purchasesSearchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [filteredPurchases, purchasesStatusFilter, purchasesSearchQuery]);

  // Export & Print handlers for each tab
  const handleExportStock = () => {
    const rows = stockItems.map(item => [
      item.product.name,
      Object.values(item.variant.attributes).join(' / ') || 'Default',
      item.product.category,
      item.variant.cost.toFixed(2),
      item.variant.price.toFixed(2),
      item.currentStock,
      item.totalCost.toFixed(2),
      item.totalRetail.toFixed(2),
      item.statusText
    ]);
    exportToCSV(rows, ["Product", "Variant", "Category", "Cost (KES)", "Price (KES)", "Stock", "Total Cost (KES)", "Total Retail (KES)", "Status"], `Stock_Valuation_${startDate}.csv`);
  };

  const handleExportSales = () => {
    const rows = salesItems.map(sale => [
      format(new Date(sale.timestamp), 'yyyy-MM-dd HH:mm'),
      sale.journalNumber || String(sale.id),
      sale.items.map(i => `${i.productName} (${i.adjustment})`).join(', '),
      sale.status,
      (sale.subtotal || 0).toFixed(2),
      (sale.tax || sale.taxAmount || 0).toFixed(2),
      (sale.total || sale.totalAmount || 0).toFixed(2)
    ]);
    exportToCSV(rows, ["Date", "Receipt #", "Items", "Payment Status", "Subtotal (KES)", "Tax (KES)", "Total (KES)"], `Sales_Summary_${startDate}_to_${endDate}.csv`);
  };

  // ── Grouped Sales Report ───────────────────────────────────────────────
  // Aggregates the currently filtered sales by a user-selected dimension.
  const salesGroupByLabels: Record<typeof salesGroupBy, string> = {
    date: 'Date',
    user: 'User',
    category: 'Category',
    location: 'Location',
    item: 'Item',
    table: 'Table',
    customer: 'Customer',
    payment: 'Payment Method',
  };

  const resolveUserName = (id?: string | number | null) => {
    if (id === undefined || id === null || id === '') return 'Unassigned';
    const u = allUsers.find(x => String(x.id) === String(id));
    return u ? (u.name || u.username) : `User ${id}`;
  };
  const resolveLocationName = (id?: string | number | null) => {
    if (id === undefined || id === null || id === '') return 'No Location';
    const loc = locations.find(l => String(l.id) === String(id));
    return loc ? loc.name : `Location ${id}`;
  };
  const resolveCustomerName = (id?: string | number | null) => {
    if (id === undefined || id === null || id === '') return 'Walk-in';
    const c = customers.find(x => String(x.id) === String(id));
    return c ? c.name : `Customer ${id}`;
  };
  const resolveTableName = (id?: string | number | null, fallbackName?: string) => {
    const t = (id !== undefined && id !== null && id !== '')
      ? tables.find(x => String(x.id) === String(id))
      : undefined;
    if (t) return t.name ? `${t.name} (${t.code})` : t.code;
    if (fallbackName) return fallbackName;
    if (id !== undefined && id !== null && id !== '') return `Table ${id}`;
    return 'No Table';
  };

  type GroupChild = { key: string; label: string; sublabel?: string; units: number; subtotal: number; tax: number; total: number; children?: GroupChild[] };
  type GroupRow = { key: string; label: string; transactions: number; units: number; subtotal: number; tax: number; total: number; children: GroupChild[] };

  const groupedSales = useMemo<GroupRow[]>(() => {
    // Payment-method grouping is built from individual payment records — a split-tender
    // sale (e.g. part CASH, part CARD) contributes one line to each method, exactly like
    // the Payments Report. Each group just lists its receipt references and amounts.
    if (salesGroupBy === 'payment') {
      const pmap = new Map<string, GroupRow>();
      combinedPayments
        .filter(p => {
          if ((p.source || 'POS') !== 'POS') return false;
          const matchLocation = reportLocationId === 'all' || !p.locationId || String(p.locationId) === reportLocationId;
          const matchUser = reportUserId === 'all' || !p.userId || String(p.userId) === reportUserId || String(p.cashierId) === reportUserId || String(p.createdBy) === reportUserId;
          return matchLocation && matchUser;
        })
        .forEach(p => {
          let label = (p.method || '').toString().trim().replace(/_/g, ' ').toUpperCase() || 'UNSPECIFIED';
          if (label === 'PENDING' || label === 'PAY LATER') label = 'PAY LATER';
          let row = pmap.get(label);
          if (!row) {
            row = { key: label, label, transactions: 0, units: 0, subtotal: 0, tax: 0, total: 0, children: [] };
            pmap.set(label, row);
          }
          row.transactions += 1;
          row.total += p.amount || 0;
          row.children.push({
            key: `pay:${p.id ?? `${p.reference || 'ref'}-${row.children.length}`}`,
            label: p.reference || '(no reference)',
            sublabel: p.customerName || undefined,
            units: 0,
            subtotal: 0,
            tax: 0,
            total: p.amount || 0,
          });
        });
      const prows = Array.from(pmap.values());
      prows.forEach(r => r.children.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)));
      prows.sort((a, b) => b.total - a.total);
      return prows;
    }

    type Acc = GroupRow & { _childMap: Map<string, GroupChild>; _sales: Set<string> };
    const map = new Map<string, Acc>();

    const getRow = (key: string, label: string): Acc => {
      let row = map.get(key);
      if (!row) {
        row = { key, label, transactions: 0, units: 0, subtotal: 0, tax: 0, total: 0, children: [], _childMap: new Map(), _sales: new Set() };
        map.set(key, row);
      }
      return row;
    };

    const groupByItem = salesGroupBy === 'item';
    const groupByCategory = salesGroupBy === 'category';
    const itemLevel = groupByItem || groupByCategory;

    salesItems.forEach(sale => {
      const saleId = String(sale.id || sale.journalNumber || Math.random());
      // Sale-level authoritative figures (include discounts / rounding / charges)
      const saleSub = sale.subtotal || 0;
      const saleTax = sale.tax || sale.taxAmount || 0;
      const saleTotal = sale.total || sale.totalAmount || 0;
      const qtySum = sale.items.reduce((s, i) => s + Math.abs(i.adjustment || 0), 0);

      if (!itemLevel) {
        let key = 'other';
        let label = 'Other';
        if (salesGroupBy === 'date') {
          key = format(new Date(sale.timestamp), 'yyyy-MM-dd');
          label = format(new Date(sale.timestamp), 'MMM d, yyyy');
        } else if (salesGroupBy === 'user') {
          const uid = sale.userId || sale.createdBy || (sale as any).cashierId;
          key = String(uid ?? 'unassigned');
          label = resolveUserName(uid);
        } else if (salesGroupBy === 'location') {
          key = String(sale.locationId ?? 'none');
          label = resolveLocationName(sale.locationId);
        } else if (salesGroupBy === 'table') {
          const tId = (sale as any).tableId;
          const tName = (sale as any).tableName;
          key = tId != null ? `id:${tId}` : (tName ? `n:${tName}` : 'none');
          label = resolveTableName(tId, tName);
        } else if (salesGroupBy === 'customer') {
          const cid = (sale as any).customerId;
          key = String(cid ?? 'walkin');
          label = resolveCustomerName(cid);
        }
        const row = getRow(key, label);
        row.transactions += 1;
        row.units += qtySum;
        row.subtotal += saleSub;
        row.tax += saleTax;
        row.total += saleTotal;

        // Third level: the receipt's own line items (amounts allocated from the
        // sale totals so a receipt's lines add back up to its total).
        const rLineVals = sale.items.map(i => Math.abs(i.adjustment || 0) * (i.price || 0));
        const rLineSum = rLineVals.reduce((a, b) => a + b, 0);
        const receiptItems: GroupChild[] = sale.items.map((item, idx) => {
          const qty = Math.abs(item.adjustment || 0);
          const share = rLineSum > 0
            ? rLineVals[idx] / rLineSum
            : (qtySum > 0 ? qty / qtySum : 1 / (sale.items.length || 1));
          return {
            key: `${saleId}:${item.variantId || item.sku || idx}`,
            label: item.productName || item.sku || 'Item',
            units: qty,
            subtotal: saleSub * share,
            tax: saleTax * share,
            total: saleTotal * share,
          };
        });

        row.children.push({
          key: saleId,
          label: sale.journalNumber || saleId,
          sublabel: format(new Date(sale.timestamp), 'MMM d, HH:mm'),
          units: qtySum,
          subtotal: saleSub,
          tax: saleTax,
          total: saleTotal,
          children: receiptItems.length ? receiptItems : undefined,
        });
        return;
      }

      // Item-level grouping (category / item): allocate the sale's authoritative
      // subtotal / tax / total across its lines so the numbers reconcile with the
      // date / user / location views instead of drifting on discounts & rounding.
      const lineVals = sale.items.map(i => Math.abs(i.adjustment || 0) * (i.price || 0));
      const lineSum = lineVals.reduce((a, b) => a + b, 0);

      sale.items.forEach((item, idx) => {
        const qty = Math.abs(item.adjustment || 0);
        const share = lineSum > 0
          ? lineVals[idx] / lineSum
          : (qtySum > 0 ? qty / qtySum : 1 / (sale.items.length || 1));
        const sub = saleSub * share;
        const tax = saleTax * share;
        const total = saleTotal * share;

        let key: string;
        let label: string;
        if (groupByItem) {
          key = item.productName || item.sku || 'Unknown';
          label = key;
        } else {
          const product = products.find(p => p.name === item.productName);
          label = product?.category || 'Uncategorized';
          key = label;
        }

        const row = getRow(key, label);
        row.units += qty;
        row.subtotal += sub;
        row.tax += tax;
        row.total += total;
        row._sales.add(saleId);

        if (groupByCategory) {
          const ck = item.productName || item.sku || 'Unknown';
          let child = row._childMap.get(ck);
          if (!child) {
            child = { key: ck, label: ck, units: 0, subtotal: 0, tax: 0, total: 0 };
            row._childMap.set(ck, child);
          }
          child.units += qty;
          child.subtotal += sub;
          child.tax += tax;
          child.total += total;
        }
      });
    });

    const rows: GroupRow[] = Array.from(map.values()).map(r => ({
      key: r.key,
      label: r.label,
      transactions: itemLevel ? r._sales.size : r.transactions,
      units: r.units,
      subtotal: r.subtotal,
      tax: r.tax,
      total: r.total,
      children: groupByItem
        ? []
        : (groupByCategory ? Array.from(r._childMap.values()) : r.children).sort((a, b) => b.total - a.total),
    }));

    if (salesGroupBy === 'date') {
      rows.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      rows.sort((a, b) => b.total - a.total);
    }
    return rows;
  }, [salesItems, salesGroupBy, allUsers, locations, products, customers, tables, combinedPayments, reportLocationId, reportUserId]);

  const groupedSalesTotals = useMemo(() => ({
    transactions: groupedSales.reduce((s, r) => s + r.transactions, 0),
    units: groupedSales.reduce((s, r) => s + r.units, 0),
    subtotal: groupedSales.reduce((s, r) => s + r.subtotal, 0),
    tax: groupedSales.reduce((s, r) => s + r.tax, 0),
    total: groupedSales.reduce((s, r) => s + r.total, 0),
  }), [groupedSales]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  useEffect(() => { setExpandedGroups({}); }, [salesGroupBy]);

  const handleExportGroupedSales = () => {
    const rows: string[][] = [];
    if (salesGroupBy === 'payment') {
      groupedSales.forEach(r => {
        rows.push([r.label, String(r.transactions), r.total.toFixed(2)]);
        r.children.forEach(c => rows.push([`    ${c.label}${c.sublabel ? ` (${c.sublabel})` : ''}`, '', c.total.toFixed(2)]));
      });
      exportToCSV(
        rows,
        ['Payment Method', 'Payments', 'Amount (KES)'],
        `Sales_By_Payment_Method_${startDate}_to_${endDate}.csv`
      );
      return;
    }
    groupedSales.forEach(r => {
      rows.push([r.label, String(r.transactions), String(r.units), r.subtotal.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2)]);
      r.children.forEach(c => rows.push([`    ${c.label}`, '', String(c.units), c.subtotal.toFixed(2), c.tax.toFixed(2), c.total.toFixed(2)]));
    });
    exportToCSV(
      rows,
      [salesGroupByLabels[salesGroupBy], "Transactions", "Units", "Subtotal (KES)", "Tax (KES)", "Total (KES)"],
      `Sales_By_${salesGroupByLabels[salesGroupBy]}_${startDate}_to_${endDate}.csv`
    );
  };

  const handleExportReturns = () => {
    const rows = returnsItems.map(r => [
      format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'),
      r.journalNumber,
      r.items.map(i => `${i.productName} (${Math.abs(i.adjustment)})`).join(', '),
      r.notes || '-',
      (r.totalAmount || (r as any).amountPaid || 0).toFixed(2)
    ]);
    exportToCSV(rows, ["Date", "Return Ref", "Items Returned", "Reason / Notes", "Refund Amount (KES)"], `Sales_Returns_${startDate}_to_${endDate}.csv`);
  };

  const handleExportPayments = () => {
    const rows = filteredCombinedPayments.map(p => [
      p.paymentDate ? format(new Date(p.paymentDate), 'yyyy-MM-dd HH:mm') : '',
      p.saleDate ? format(new Date(p.saleDate), 'yyyy-MM-dd HH:mm') : '',
      p.source || 'POS',
      p.customerName || 'Unknown',
      p.reference || '',
      p.receivedBy || p.createdBy || '',
      p.method || 'CASH',
      p.amount.toFixed(2)
    ]);
    exportToCSV(rows, ["Payment Date", "Sale Date", "Source", "Customer", "Reference", "Received By", "Method", "Amount (KES)"],
      `Payments_by_${paymentDateBasis}_date_${startDate}_to_${endDate}.csv`);
  };

  const handleExportFastMoving = () => {
    const dataToExport = bestSellers.filter(item => !fastMovingSearchQuery || item.name.toLowerCase().includes(fastMovingSearchQuery.toLowerCase()));
    const rows = dataToExport.map((item, idx) => [
      idx + 1,
      item.name,
      item.sales
    ]);
    exportToCSV(rows, ["Rank", "Product", "Qty Sold"], `Fast_Moving_Items_${startDate}_to_${endDate}.csv`);
  };

  const handleExportHistory = () => {
    const rows = movements.map(move => [
      format(move.date, 'yyyy-MM-dd HH:mm'),
      move.type,
      move.variantInfo || '-',
      move.reference,
      move.quantity > 0 ? `+${move.quantity}` : move.quantity,
      move.runningBalance
    ]);
    exportToCSV(rows, ["Date", "Type", "Variant (Info)", "Reference", "In/Out", "Running Balance"], `Stock_Movement_${startDate}_to_${endDate}.csv`);
  };

  const handleExportPurchases = () => {
    const rows = purchasesItems.map(po => [
      format(new Date(po.dateReceived || po.createdAt || po.timestamp), 'yyyy-MM-dd HH:mm'),
      po.supplier?.name || '-',
      po.journalNumber || po.id,
      (po.items || []).map((i: any) => `${i.productName || i.sku} (${i.quantity})`).join(', '),
      po.status,
      po.paymentStatus,
      (po.total || po.totalAmount || 0).toFixed(2)
    ]);
    exportToCSV(rows, ["Date", "Supplier", "PO #", "Items", "Status", "Payment Status", "Total (KES)"], `Purchase_Orders_${startDate}_to_${endDate}.csv`);
  };

  // Get current displayed stock
  const currentDisplayedStock = () => {
    if (!selectedProductId) return 0;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return 0;

    const activeVars = product.variants.filter(v =>
      selectedVariantIds.length === 0 || selectedVariantIds.includes(v.id)
    );

    return activeVars.reduce((sum, v) => {
      return sum + getVariantStock(v, selectedLocationId);
    }, 0);
  };


  return (
    <AppLayout title="Reports & Analytics">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{sym}{totalSales.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Items Sold</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
                <Package className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-2xl font-bold">{sym}{totalInventoryValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold">{lowStock + outOfStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-muted/50 p-4 rounded-lg border mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Report Period:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Label className="text-xs">From</Label>
            <Input type="date" className="w-full sm:w-auto bg-background" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input type="time" className="w-[110px] bg-background" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">To</Label>
            <Input type="date" className="w-full sm:w-auto bg-background" value={endDate} onChange={e => setEndDate(e.target.value)} />
            <Input type="time" className="w-[110px] bg-background" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Location</Label>
            <Select value={reportLocationId} onValueChange={setReportLocationId}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">User</Label>
            <Select value={reportUserId} onValueChange={setReportUserId}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name || u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="sm:ml-auto w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="w-full sm:w-auto">
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap scrollbar-none h-auto p-1 bg-muted/50">
          <TabsTrigger value="stock" className="whitespace-nowrap min-w-fit">Stock Report</TabsTrigger>
          <TabsTrigger value="sales" className="whitespace-nowrap min-w-fit">Sales Report</TabsTrigger>
          <TabsTrigger value="grouped-sales" className="whitespace-nowrap min-w-fit">Sales Grouping</TabsTrigger>
          <TabsTrigger value="purchases" className="whitespace-nowrap min-w-fit">Purchases Report</TabsTrigger>
          <TabsTrigger value="returns" className="whitespace-nowrap min-w-fit">Returns</TabsTrigger>
          <TabsTrigger value="payments" className="whitespace-nowrap min-w-fit">Payments Report</TabsTrigger>
          <TabsTrigger value="profitability" className="whitespace-nowrap min-w-fit">Profitability Report</TabsTrigger>
          <TabsTrigger value="fast-moving" className="whitespace-nowrap min-w-fit">Fast Moving Items</TabsTrigger>
          <TabsTrigger value="history" className="whitespace-nowrap min-w-fit">Inventory History</TabsTrigger>
        </TabsList>

        {/* Stock Report Tab */}
        <TabsContent value="stock" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Stock <span className="text-amber-600 font-serif italic font-normal">Valuation</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A comprehensive ledger of on-hand inventory, cost valuation, retail potential, and stock health alerts across your locations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportStock}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('stock-ledger-table', 'Stock Valuation Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Refresh
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="flex items-center bg-background p-1 rounded-full border shadow-inner">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${stockStatusFilter === 'all' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Status
              </button>
              <button
                onClick={() => setStockStatusFilter('in')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${stockStatusFilter === 'in' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                In Stock
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${stockStatusFilter === 'low' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Low Stock
              </button>
              <button
                onClick={() => setStockStatusFilter('out')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${stockStatusFilter === 'out' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Out of Stock
              </button>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search product, variant, category..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>TOTAL COST</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalInventoryValue.toLocaleString()}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Invested stock cost</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Cost Share</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-indigo-50/90 to-purple-100/70 border-indigo-200/80 dark:from-indigo-950/40 dark:to-purple-900/30 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>RETAIL VALUE</span>
                </div>
                <div className="p-1.5 rounded-full bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/50 dark:text-indigo-200 shrink-0"><TrendingUp className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalRetailValue.toLocaleString()}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Potential gross sales</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-indigo-200 dark:bg-indigo-800"><div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Potential</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>IN STOCK</span>
                </div>
                <div className="p-1.5 rounded-full bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{inStock} items</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Healthy stock levels</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800"><div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.round((inStock / (activeVariants.length || 1)) * 100)}%` }} /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Share</span><span>{Math.round((inStock / (activeVariants.length || 1)) * 100)}%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>LOW STOCK</span>
                </div>
                <div className="p-1.5 rounded-full bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200 shrink-0"><AlertTriangle className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{lowStock} items</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Needs replenishment</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-amber-200 dark:bg-amber-800"><div className="h-full rounded-full bg-amber-600 dark:bg-amber-400" style={{ width: `${Math.round((lowStock / (activeVariants.length || 1)) * 100)}%` }} /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Share</span><span>{Math.round((lowStock / (activeVariants.length || 1)) * 100)}%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-rose-50/90 to-pink-100/70 border-rose-200/80 dark:from-rose-950/40 dark:to-pink-900/30 dark:border-rose-800/50 text-rose-950 dark:text-rose-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-100/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>OUT OF STOCK</span>
                </div>
                <div className="p-1.5 rounded-full bg-rose-200/60 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200 shrink-0"><Trash className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{outOfStock} items</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Zero units on hand</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-rose-200 dark:bg-rose-800"><div className="h-full rounded-full bg-rose-600 dark:bg-rose-400" style={{ width: `${Math.round((outOfStock / (activeVariants.length || 1)) * 100)}%` }} /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Share</span><span>{Math.round((outOfStock / (activeVariants.length || 1)) * 100)}%</span></div>
              </div>
            </div>
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Inventory Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {activeProducts.flatMap(p => p.variants.filter(v => v.isActive !== false)).length} SKUs
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by product name • KES
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="stock-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Product</th>
                      <th className="py-3.5 px-4">Variant</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4 text-right">Cost</th>
                      <th className="py-3.5 px-4 text-right">Price</th>
                      <th className="py-3.5 px-4 text-right">Stock</th>
                      <th className="py-3.5 px-4 text-right">Total Cost</th>
                      <th className="py-3.5 px-4 text-right">Total Retail</th>
                      <th className="py-3.5 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {stockItems.map((item, idx) => (
                      <tr key={item.variant.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 font-semibold text-foreground">{item.product.name}</td>
                        <td className="py-4 px-4 text-xs text-muted-foreground">{Object.values(item.variant.attributes).join(' / ') || 'Default'}</td>
                        <td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-muted/60 text-muted-foreground">{item.product.category}</span></td>
                        <td className="py-4 px-4 text-right font-serif">{sym}{item.variant.cost.toFixed(2)}</td>
                        <td className="py-4 px-4 text-right font-serif">{sym}{item.variant.price.toFixed(2)}</td>
                        <td className="py-4 px-4 text-right font-bold text-base">{item.currentStock}</td>
                        <td className="py-4 px-4 text-right font-serif font-medium text-muted-foreground">{sym}{item.totalCost.toFixed(2)}</td>
                        <td className="py-4 px-4 text-right font-serif font-medium text-emerald-600 dark:text-emerald-400">{sym}{item.totalRetail.toFixed(2)}</td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.statusColor}`}>
                            {item.statusText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={3}>TOTALS</td>
                      <td className="py-3.5 px-4 text-right">-</td>
                      <td className="py-3.5 px-4 text-right">-</td>
                      <td className="py-3.5 px-4 text-right text-base">{stockItems.reduce((sum, item) => sum + item.currentStock, 0)}</td>
                      <td className="py-3.5 px-4 text-right font-serif text-base">{sym}{stockItems.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-right font-serif text-base text-emerald-600 dark:text-emerald-400">{sym}{stockItems.reduce((sum, item) => sum + item.totalRetail, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-6">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Sales <span className="text-amber-600 font-serif italic font-normal">Summary</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A quiet view of every sale moving through the house — revenue earned, tax collected, and transaction velocity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportSales}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('sales-ledger-table', 'Sales Summary Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="flex items-center bg-background p-1 rounded-full border shadow-inner">
              <button
                onClick={() => setSalesStatusFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${salesStatusFilter === 'all' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Sales
              </button>
              <button
                onClick={() => setSalesStatusFilter('paid')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${salesStatusFilter === 'paid' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Paid
              </button>
              <button
                onClick={() => setSalesStatusFilter('pending')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${salesStatusFilter === 'pending' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Other / Pending
              </button>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items, payment status, reference..."
                value={salesSearchQuery}
                onChange={(e) => setSalesSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>TOTAL REVENUE</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalSales.toLocaleString()}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Gross revenue earned</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Revenue</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>TOTAL TAX</span>
                </div>
                <div className="p-1.5 rounded-full bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{filteredSales.reduce((sum, s) => sum + (s.tax || s.taxAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Tax collected</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800"><div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.round((filteredSales.reduce((sum, s) => sum + (s.tax || s.taxAmount || 0), 0) / (totalSales || 1)) * 100)}%` }} /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Tax Share</span><span>{Math.round((filteredSales.reduce((sum, s) => sum + (s.tax || s.taxAmount || 0), 0) / (totalSales || 1)) * 100)}%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-violet-50/90 to-fuchsia-100/70 border-violet-200/80 dark:from-violet-950/40 dark:to-fuchsia-900/30 dark:border-violet-800/50 text-violet-950 dark:text-violet-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-violet-100/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border-violet-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <span>TRANSACTIONS</span>
                </div>
                <div className="p-1.5 rounded-full bg-violet-200/60 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200 shrink-0"><Wallet className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{filteredSales.length} sales</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total sales count</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-violet-200 dark:bg-violet-800"><div className="h-full rounded-full bg-violet-600 dark:bg-violet-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Volume</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>ITEMS SOLD</span>
                </div>
                <div className="p-1.5 rounded-full bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalItems} units</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total merchandise volume</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-amber-200 dark:bg-amber-800"><div className="h-full rounded-full bg-amber-600 dark:bg-amber-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Units</span><span>100%</span></div>
              </div>
            </div>
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Sales Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {filteredSales.length} entries
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by most recent • KES
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="sales-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-4">Receipt #</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4">Payment Status</th>
                      <th className="py-3.5 px-4 text-right">Subtotal</th>
                      <th className="py-3.5 px-4 text-right">Tax</th>
                      <th className="py-3.5 px-6 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {salesItems.map((sale) => (
                      <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-semibold text-foreground">{format(new Date(sale.timestamp), 'MMM d')}</span>
                          <span className="text-xs text-muted-foreground ml-2">{format(new Date(sale.timestamp), 'HH:mm')}</span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{sale.journalNumber || sale.id}</td>
                        <td className="py-4 px-4 text-xs font-medium text-foreground max-w-[250px] truncate">
                          {sale.items.map(i => `${i.productName} (${i.adjustment})`).join(', ')}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sale.status === 'COMPLETED' || sale.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'}`}>
                            {sale.status === 'COMPLETED' ? 'Paid' : sale.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-serif text-muted-foreground">{sym}{(sale.subtotal || 0).toFixed(2)}</td>
                        <td className="py-4 px-4 text-right font-serif text-muted-foreground">{sym}{(sale.tax || sale.taxAmount || 0).toFixed(2)}</td>
                        <td className="py-4 px-6 text-right font-serif font-semibold text-base text-emerald-600 dark:text-emerald-400">{sym}{(sale.total || sale.totalAmount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={4}>TOTALS</td>
                      <td className="py-3.5 px-4 text-right font-serif text-base">{sym}{salesItems.reduce((sum, s) => sum + (s.subtotal || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-right font-serif text-base">{sym}{salesItems.reduce((sum, s) => sum + (s.tax || s.taxAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-6 text-right font-serif text-base text-emerald-600 dark:text-emerald-400">{sym}{salesItems.reduce((sum, s) => sum + (s.total || s.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Sales Trend Chart */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <h3 className="font-serif text-2xl font-normal text-foreground">Sales Trend</h3>
              <div className="text-xs text-muted-foreground font-medium">Daily Revenue • KES</div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="sales" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grouped-sales" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Sales <span className="text-amber-600 font-serif italic font-normal">Grouping</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Roll every sale in the selected period up by a dimension of your choosing — then open a row to see what sits inside it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportGroupedSales}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('grouped-sales-table', `Sales by ${salesGroupByLabels[salesGroupBy]}`)}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium whitespace-nowrap">Group sales by</Label>
            </div>
            <Select value={salesGroupBy} onValueChange={(v) => setSalesGroupBy(v as typeof salesGroupBy)}>
              <SelectTrigger className="w-full sm:w-[200px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="item">Item</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="payment">Payment Method</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground sm:ml-auto">
              Uses the report period, location &amp; user filters above • {groupedSales.length} groups
            </div>
          </div>

          {/* Grouped Table */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Sales by {salesGroupByLabels[salesGroupBy]}</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {groupedSales.length} groups
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                {salesGroupBy === 'item' ? 'Line items' : salesGroupBy === 'payment' ? 'Receipts per method' : 'Click a row to expand'} • {sym}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {(() => {
                const paymentMode = salesGroupBy === 'payment';
                const colCount = paymentMode ? 3 : 6;
                return (
                <table id="grouped-sales-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">{salesGroupByLabels[salesGroupBy]}</th>
                      <th className="py-3.5 px-4 text-right">{paymentMode ? 'Payments' : 'Transactions'}</th>
                      {!paymentMode && <th className="py-3.5 px-4 text-right">Units</th>}
                      {!paymentMode && <th className="py-3.5 px-4 text-right">Subtotal</th>}
                      {!paymentMode && <th className="py-3.5 px-4 text-right">Tax</th>}
                      <th className="py-3.5 px-6 text-right">{paymentMode ? 'Amount' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {groupedSales.length === 0 ? (
                      <tr><td colSpan={colCount} className="py-8 text-center text-muted-foreground">No sales in the selected period.</td></tr>
                    ) : groupedSales.map((row) => {
                      const expandable = row.children.length > 0;
                      const open = !!expandedGroups[row.key];
                      return (
                        <React.Fragment key={row.key}>
                          <tr
                            className={`transition-colors ${expandable ? 'cursor-pointer hover:bg-muted/30' : ''} ${open ? 'bg-muted/20' : ''}`}
                            onClick={() => expandable && toggleGroup(row.key)}
                          >
                            <td className="py-4 px-6 font-semibold text-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                {expandable
                                  ? (open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />)
                                  : <span className="w-4 h-4 inline-block" />}
                                {row.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right text-muted-foreground">{row.transactions}</td>
                            {!paymentMode && <td className="py-4 px-4 text-right text-muted-foreground">{row.units}</td>}
                            {!paymentMode && <td className="py-4 px-4 text-right font-serif text-muted-foreground">{sym}{row.subtotal.toFixed(2)}</td>}
                            {!paymentMode && <td className="py-4 px-4 text-right font-serif text-muted-foreground">{sym}{row.tax.toFixed(2)}</td>}
                            <td className="py-4 px-6 text-right font-serif font-semibold text-base text-emerald-600 dark:text-emerald-400">{sym}{row.total.toFixed(2)}</td>
                          </tr>
                          {open && row.children.map((child) => {
                            const childExpandable = !!child.children && child.children.length > 0;
                            const childOpen = !!expandedGroups[child.key];
                            return (
                              <React.Fragment key={child.key}>
                                <tr
                                  className={`bg-muted/5 text-xs transition-colors ${childExpandable ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                                  onClick={() => childExpandable && toggleGroup(child.key)}
                                >
                                  <td className="py-2.5 pl-12 pr-6">
                                    <span className="inline-flex items-center gap-1.5">
                                      {childExpandable
                                        ? (childOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />)
                                        : <span className="w-3.5 h-3.5 inline-block" />}
                                      <span>
                                        <span className="font-mono font-medium text-foreground">{child.label}</span>
                                        {child.sublabel && <span className="block text-[11px] text-muted-foreground truncate max-w-[420px]">{child.sublabel}</span>}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-muted-foreground">—</td>
                                  {!paymentMode && <td className="py-2.5 px-4 text-right text-muted-foreground">{child.units}</td>}
                                  {!paymentMode && <td className="py-2.5 px-4 text-right font-serif text-muted-foreground">{sym}{child.subtotal.toFixed(2)}</td>}
                                  {!paymentMode && <td className="py-2.5 px-4 text-right font-serif text-muted-foreground">{sym}{child.tax.toFixed(2)}</td>}
                                  <td className="py-2.5 px-6 text-right font-serif text-muted-foreground">{sym}{child.total.toFixed(2)}</td>
                                </tr>
                                {childOpen && child.children!.map((leaf) => (
                                  <tr key={leaf.key} className="bg-muted/10 text-[11px]">
                                    <td className="py-2 pl-[4.75rem] pr-6 text-muted-foreground">{leaf.label}</td>
                                    <td className="py-2 px-4 text-right text-muted-foreground">—</td>
                                    {!paymentMode && <td className="py-2 px-4 text-right text-muted-foreground">{leaf.units}</td>}
                                    {!paymentMode && <td className="py-2 px-4 text-right font-serif text-muted-foreground">{sym}{leaf.subtotal.toFixed(2)}</td>}
                                    {!paymentMode && <td className="py-2 px-4 text-right font-serif text-muted-foreground">{sym}{leaf.tax.toFixed(2)}</td>}
                                    <td className="py-2 px-6 text-right font-serif text-muted-foreground">{sym}{leaf.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6">TOTALS</td>
                      <td className="py-3.5 px-4 text-right">{groupedSalesTotals.transactions}</td>
                      {!paymentMode && <td className="py-3.5 px-4 text-right">{groupedSalesTotals.units}</td>}
                      {!paymentMode && <td className="py-3.5 px-4 text-right font-serif text-base">{sym}{groupedSalesTotals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                      {!paymentMode && <td className="py-3.5 px-4 text-right font-serif text-base">{sym}{groupedSalesTotals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                      <td className="py-3.5 px-6 text-right font-serif text-base text-emerald-600 dark:text-emerald-400">{sym}{groupedSalesTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
                );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Grouped Chart */}
          {groupedSales.length > 0 && (
            <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
                <h3 className="font-serif text-2xl font-normal text-foreground">Total by {salesGroupByLabels[salesGroupBy]}</h3>
                <div className="text-xs text-muted-foreground font-medium">Top 15 • KES</div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedSales.slice(0, 15).map(r => ({ name: r.label, total: r.total }))} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="total" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="returns" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Sales <span className="text-amber-600 font-serif italic font-normal">Returns</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A transparent log of customer returns, refunded amounts, and stock inventory adjustments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportReturns}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('returns-ledger-table', 'Sales Returns Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search return ref, items returned, notes..."
                value={returnsSearchQuery}
                onChange={(e) => setReturnsSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-rose-50/90 to-pink-100/70 border-rose-200/80 dark:from-rose-950/40 dark:to-pink-900/30 dark:border-rose-800/50 text-rose-950 dark:text-rose-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-100/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>TOTAL REFUNDED</span>
                </div>
                <div className="p-1.5 rounded-full bg-rose-200/60 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {filteredReturns.reduce((sum, r) => sum + (r.totalAmount || (r as any).amountPaid || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Capital returned to clients</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-rose-200 dark:bg-rose-800"><div className="h-full rounded-full bg-rose-600 dark:bg-rose-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Refunds</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>RETURN COUNT</span>
                </div>
                <div className="p-1.5 rounded-full bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200 shrink-0"><Hourglass className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{filteredReturns.length} returns</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total refund transactions</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-amber-200 dark:bg-amber-800"><div className="h-full rounded-full bg-amber-600 dark:bg-amber-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Count</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-indigo-50/90 to-purple-100/70 border-indigo-200/80 dark:from-indigo-950/40 dark:to-purple-900/30 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>ITEMS RESTORED</span>
                </div>
                <div className="p-1.5 rounded-full bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/50 dark:text-indigo-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {filteredReturns.reduce((sum, r) => sum + r.items.reduce((iSum, i) => iSum + Math.abs(i.adjustment), 0), 0)} units
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Physical units restored</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-indigo-200 dark:bg-indigo-800"><div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Volume</span><span>100%</span></div>
              </div>
            </div>
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Returns Log</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {filteredReturns.length} entries
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by most recent • KES
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="returns-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-4">Return Ref</th>
                      <th className="py-3.5 px-4">Items Returned</th>
                      <th className="py-3.5 px-4">Reason / Notes</th>
                      <th className="py-3.5 px-6 text-right">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {returnsItems.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-semibold text-foreground">{format(new Date(r.timestamp), 'MMM d')}</span>
                          <span className="text-xs text-muted-foreground ml-2">{format(new Date(r.timestamp), 'HH:mm')}</span>
                        </td>
                        <td className="py-4 px-4 font-mono text-xs font-bold text-foreground">{r.journalNumber}</td>
                        <td className="py-4 px-4 text-xs font-medium text-foreground max-w-[250px] truncate">{r.items.map(i => `${i.productName} (${Math.abs(i.adjustment)})`).join(', ')}</td>
                        <td className="py-4 px-4 text-xs text-muted-foreground italic truncate max-w-[200px]">{r.notes || '-'}</td>
                        <td className="py-4 px-6 text-right font-serif font-semibold text-base text-rose-600 dark:text-rose-400">-KES {(r.totalAmount || (r as any).amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={4}>TOTALS</td>
                      <td className="py-3.5 px-6 text-right font-serif text-base text-rose-600 dark:text-rose-400">-KES {returnsItems.reduce((sum, r) => sum + (r.totalAmount || (r as any).amountPaid || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Payment <span className="text-amber-600 font-serif italic font-normal">Summary</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A quiet view of every transaction moving through the house — cash on the counter, cards on the wire, and what's still on tab.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportPayments}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('payments-ledger-table', 'Payment Summary Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="flex items-center bg-background p-1 rounded-full border shadow-inner">
              <button
                onClick={() => setPaymentSourceFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${paymentSourceFilter === 'all' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Both
              </button>
              <button
                onClick={() => setPaymentSourceFilter('POS')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${paymentSourceFilter === 'POS' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                POS
              </button>
              <button
                onClick={() => setPaymentSourceFilter('ACCOMMODATION')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${paymentSourceFilter === 'ACCOMMODATION' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Accommodation
              </button>
            </div>
            {/* Date basis: payment date vs sale date */}
            <div className="flex items-center bg-background p-1 rounded-full border shadow-inner shrink-0" title="A payment collected days after the sale shows on whichever date you pick">
              <button
                onClick={() => setPaymentDateBasis('payment')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${paymentDateBasis === 'payment' ? 'bg-emerald-700 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                By payment date
              </button>
              <button
                onClick={() => setPaymentDateBasis('sale')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${paymentDateBasis === 'sale' ? 'bg-emerald-700 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                By sale date
              </button>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reference, customer, method..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (All Light Colors, Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            {Object.entries(paymentStats).map(([method, amount], idx) => {
              const totalPaymentsSum = Object.values(paymentStats).reduce((sum, val) => sum + val, 0);
              const percentage = totalPaymentsSum > 0 ? Math.round((amount / totalPaymentsSum) * 100) : 0;
              const style = getCardStyle(method, idx);
              return (
                <div key={method} className={`flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${style.bg} flex flex-col justify-between space-y-3`}>
                  <div className="flex items-center justify-between gap-1">
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.badgeBg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className="truncate max-w-[80px]">{method}</span>
                    </div>
                    <div className={`p-1.5 rounded-full ${style.iconBg} shrink-0`}>
                      {style.icon}
                    </div>
                  </div>

                  <div className="my-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                      <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                        {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">{style.desc}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className={`h-1 w-full rounded-full overflow-hidden ${style.barBg}`}>
                      <div className={`h-full rounded-full ${style.barFill}`} style={{ width: `${percentage}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold opacity-75">
                      <span>Share</span>
                      <span>{percentage}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {filteredCombinedPayments.length} entries
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by most recent • KES
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="payments-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-4">Source</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Reference</th>
                      <th className="py-3.5 px-4">Received by</th>
                      <th className="py-3.5 px-4">Method</th>
                      <th className="py-3.5 px-6 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {isPaymentsLoading ? (
                      <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></td></tr>
                    ) : filteredCombinedPayments.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No transactions found in the ledger.</td></tr>
                    ) : filteredCombinedPayments.map((p, idx) => {
                      const methodStyle = getCardStyle(p.method || 'Cash', idx);
                      const isNegative = p.amount < 0 || (p.reference && p.reference.includes('RETURN'));
                      return (
                        <tr key={p.id || idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className="font-semibold text-foreground">{format(new Date(p.date), 'MMM d')}</span>
                            <span className="text-xs text-muted-foreground ml-2">{format(new Date(p.date), 'HH:mm')}</span>
                            {p.saleDate && new Date(p.saleDate).toDateString() !== new Date(p.date).toDateString() && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {paymentDateBasis === 'payment' ? 'Sale: ' : 'Paid: '}
                                {format(new Date(paymentDateBasis === 'payment' ? p.saleDate : (p.paymentDate || p.saleDate)), 'MMM d')}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${p.source === 'POS' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200' : 'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200'}`}>
                              {p.source || 'POS'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-medium text-foreground">{p.customerName || '-'}</td>
                          <td className="py-4 px-4 font-mono text-xs text-muted-foreground max-w-[200px] truncate">{p.reference || '-'}</td>
                          <td className="py-4 px-4 text-xs text-foreground whitespace-nowrap">{p.receivedBy || p.createdBy || '-'}</td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${methodStyle.badgeBg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${methodStyle.dot}`} />
                              {p.method || 'CASH'}
                            </div>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap text-right font-serif font-medium text-base">
                            {isNegative ? (
                              <span className="text-rose-600 dark:text-rose-400">-KES {Math.abs(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            ) : (
                              <span className="text-foreground">KES {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={6}>TOTALS</td>
                      <td className="py-3.5 px-6 text-right font-serif text-base">
                        {(() => {
                          const total = filteredCombinedPayments.reduce((sum, p) => sum + p.amount, 0);
                          return total < 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">-KES {Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <span>KES {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fast-moving" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Fast Moving <span className="text-amber-600 font-serif italic font-normal">Items</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Top performing inventory items ranked by sales volume, turnover velocity, and customer demand.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportFastMoving}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('fast-moving-ledger-table', 'Fast Moving Items Velocity Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search product name in velocity rankings..."
                value={fastMovingSearchQuery}
                onChange={(e) => setFastMovingSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>RANK #1 SELLER</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><TrendingUp className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{bestSellers[0]?.sales || 0} units</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">{bestSellers[0]?.name || 'None'}</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Top Rank</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>TOP 5 VOLUME</span>
                </div>
                <div className="p-1.5 rounded-full bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {bestSellers.slice(0, 5).reduce((sum, item) => sum + item.sales, 0)} units
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Combined top 5 volume</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800"><div className="h-full rounded-full bg-blue-600 dark:bg-blue-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Volume</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-violet-50/90 to-fuchsia-100/70 border-violet-200/80 dark:from-violet-950/40 dark:to-fuchsia-900/30 dark:border-violet-800/50 text-violet-950 dark:text-violet-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-violet-100/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border-violet-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <span>RANKED PRODUCTS</span>
                </div>
                <div className="p-1.5 rounded-full bg-violet-200/60 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200 shrink-0"><Tag className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{bestSellers.length} SKUs</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Products with active velocity</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-violet-200 dark:bg-violet-800"><div className="h-full rounded-full bg-violet-600 dark:bg-violet-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Catalog</span><span>100%</span></div>
              </div>
            </div>
          </div>

          {/* Chart Card */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <h3 className="font-serif text-2xl font-normal text-foreground">Velocity Rankings Chart</h3>
              <div className="text-xs text-muted-foreground font-medium">Top 10 Products by Qty Sold</div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bestSellers}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Velocity Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {bestSellers.length} products
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by quantity sold
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="fast-moving-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Rank</th>
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-6 text-right">Qty Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {bestSellers.filter(item => !fastMovingSearchQuery || item.name.toLowerCase().includes(fastMovingSearchQuery.toLowerCase())).map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-xs text-amber-600 dark:text-amber-400">#{idx + 1}</td>
                        <td className="py-4 px-4 font-semibold text-foreground">{item.name}</td>
                        <td className="py-4 px-6 text-right font-serif font-bold text-base text-foreground">{item.sales}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={2}>TOTALS</td>
                      <td className="py-3.5 px-6 text-right font-serif text-base text-foreground">
                        {bestSellers.filter(item => !fastMovingSearchQuery || item.name.toLowerCase().includes(fastMovingSearchQuery.toLowerCase())).reduce((sum, item) => sum + item.sales, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Stock <span className="text-amber-600 font-serif italic font-normal">Movement</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                An audit trail of every stock adjustment, transfer, receipt, and sale across your locations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportHistory}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('history-ledger-table', 'Stock Movement Audit Log')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Refresh
              </Button>
            </div>
          </div>

          {/* Filter Dropdown Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-amber-50/40 dark:bg-card/50 p-4 rounded-2xl border border-amber-200/50 dark:border-border items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Location</Label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="rounded-full bg-background h-9 text-xs">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (<SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Product</Label>
              <Select value={selectedProductId} onValueChange={(val) => { setSelectedProductId(val); setSelectedVariantIds([]); }}>
                <SelectTrigger className="rounded-full bg-background h-9 text-xs">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map(opt => (<SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Variant(s)</Label>
              <MultiSelect options={variantOptions} selected={selectedVariantIds} onChange={setSelectedVariantIds} placeholder="Select variants..." className={!selectedProductId ? "opacity-50 pointer-events-none" : ""} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Start Date & Time</Label>
              <div className="flex gap-1">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 rounded-full bg-background h-9 text-xs" />
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-[100px] rounded-full bg-background h-9 text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">End Date & Time</Label>
              <div className="flex gap-1">
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 rounded-full bg-background h-9 text-xs" />
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-[100px] rounded-full bg-background h-9 text-xs" />
              </div>
            </div>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>TOTAL SKUS</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{activeVariants.length} SKUs</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total catalog variants</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Catalog</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-indigo-50/90 to-purple-100/70 border-indigo-200/80 dark:from-indigo-950/40 dark:to-purple-900/30 dark:border-indigo-800/50 text-indigo-950 dark:text-indigo-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span>ON HAND UNITS</span>
                </div>
                <div className="p-1.5 rounded-full bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800/50 dark:text-indigo-200 shrink-0"><TrendingUp className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {activeVariants.reduce((sum, v) => sum + getVariantStock(v), 0).toLocaleString()} units
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total physical stock</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-indigo-200 dark:bg-indigo-800"><div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Volume</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>COST VALUATION</span>
                </div>
                <div className="p-1.5 rounded-full bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalInventoryValue.toLocaleString()}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total cost balance</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800"><div className="h-full rounded-full bg-blue-600 dark:bg-blue-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Value</span><span>100%</span></div>
              </div>
            </div>
          </div>

          {selectedProductId ? (
            <div className="space-y-8">
              <div className="p-4 bg-amber-50/60 dark:bg-card border border-amber-200/60 dark:border-border rounded-2xl flex gap-8">
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold block">Opening Balance</span>
                  <span className="font-serif font-bold text-2xl text-foreground">{openingBalance}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold block">Current Stock</span>
                  <span className="font-serif font-bold text-2xl text-emerald-600 dark:text-emerald-400">{currentDisplayedStock()}</span>
                </div>
              </div>

              <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-2xl font-normal text-foreground">Movement Audit Log</h3>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                      {movements.length} entries
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Sorted chronologically</div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table id="history-ledger-table" className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                          <th className="py-3.5 px-6">Date</th>
                          <th className="py-3.5 px-4">Type</th>
                          <th className="py-3.5 px-4">Variant (Info)</th>
                          <th className="py-3.5 px-4">Location</th>
                          <th className="py-3.5 px-4">Reference</th>
                          <th className="py-3.5 px-4 text-right">In/Out</th>
                          <th className="py-3.5 px-6 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {movements.length > 0 ? (
                          movements.map((move, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="py-4 px-6 whitespace-nowrap font-semibold">{format(move.date, 'MMM d, yyyy HH:mm')}</td>
                              <td className="py-4 px-4 capitalize"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-foreground">{move.type}</span></td>
                              <td className="py-4 px-4 text-xs text-muted-foreground">{move.variantInfo || '-'}</td>
                              <td className="py-4 px-4 text-xs font-semibold text-foreground">{move.locationName}</td>
                              <td className="py-4 px-4 text-xs font-mono font-medium text-foreground">{move.reference}</td>
                              <td className={`py-4 px-4 text-right font-serif font-bold text-base ${move.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {move.quantity > 0 ? '+' : ''}{move.quantity}
                              </td>
                              <td className="py-4 px-6 text-right font-serif font-bold text-base text-foreground">{move.runningBalance}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No movements found in this period.</td></tr>
                        )}
                      </tbody>
                      {movements.length > 0 && (
                        <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                          <tr>
                            <td className="py-3.5 px-6" colSpan={5}>NET CHANGE</td>
                            <td className={`py-3.5 px-4 text-right font-serif font-bold text-base ${movements.reduce((sum, m) => sum + m.quantity, 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {movements.reduce((sum, m) => sum + m.quantity, 0) > 0 ? '+' : ''}{movements.reduce((sum, m) => sum + m.quantity, 0)}
                            </td>
                            <td className="py-3.5 px-6 text-right font-serif font-bold text-base text-foreground">
                              {movements[movements.length - 1].runningBalance} (Final)
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-3xl border-dashed bg-card/40">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-serif text-lg">Please select a product above to view movement history.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Purchase <span className="text-amber-600 font-serif italic font-normal">Orders</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A complete record of supplier deliveries, purchase costs, tax expenditures, and order statuses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportPurchases}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('procurement-ledger-table', 'Purchase Orders Procurement Report')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={refreshData}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-amber-50/40 dark:bg-card/50 p-3 rounded-2xl border border-amber-200/50 dark:border-border">
            <div className="flex items-center bg-background p-1 rounded-full border shadow-inner">
              <button
                onClick={() => setPurchasesStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${purchasesStatusFilter === 'all' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All POs
              </button>
              <button
                onClick={() => setPurchasesStatusFilter('RECEIVED')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${purchasesStatusFilter === 'RECEIVED' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Received
              </button>
              <button
                onClick={() => setPurchasesStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${purchasesStatusFilter === 'PENDING' ? 'bg-amber-950 text-white dark:bg-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Pending / Ordered
              </button>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search supplier, PO number, items..."
                value={purchasesSearchQuery}
                onChange={(e) => setPurchasesSearchQuery(e.target.value)}
                className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-10 text-sm shadow-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-full px-4 h-10 bg-background/90 border-amber-300/60 shadow-sm">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /> Filters
            </Button>
          </div>

          {/* Summary Cards Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>TOTAL PURCHASES</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{totalPurchasesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total procurement spend</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Spend</span><span>100%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-blue-50/90 to-sky-100/70 border-blue-200/80 dark:from-blue-950/40 dark:to-sky-900/30 dark:border-blue-800/50 text-blue-950 dark:text-blue-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>TOTAL TAX</span>
                </div>
                <div className="p-1.5 rounded-full bg-blue-200/60 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {filteredPurchases.reduce((sum, po) => sum + (po.tax || po.taxAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Tax expenditures</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800"><div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.round((filteredPurchases.reduce((sum, po) => sum + (po.tax || po.taxAmount || 0), 0) / (totalPurchasesAmount || 1)) * 100)}%` }} /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Tax Share</span><span>{Math.round((filteredPurchases.reduce((sum, po) => sum + (po.tax || po.taxAmount || 0), 0) / (totalPurchasesAmount || 1)) * 100)}%</span></div>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>PO COUNT</span>
                </div>
                <div className="p-1.5 rounded-full bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200 shrink-0"><Package className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">{filteredPurchases.length} orders</span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">Total procurement orders</p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-amber-200 dark:bg-amber-800"><div className="h-full rounded-full bg-amber-600 dark:bg-amber-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Orders</span><span>100%</span></div>
              </div>
            </div>
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Procurement Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {filteredPurchases.length} POs
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Sorted by most recent • KES
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="procurement-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-4">Supplier</th>
                      <th className="py-3.5 px-4">PO #</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-6 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {isPurchasesLoading ? (
                      <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : purchasesItems.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No purchases found for this period.</td></tr>
                    ) : purchasesItems.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-semibold text-foreground">{format(new Date(po.dateReceived || po.createdAt || po.timestamp), 'MMM d, yyyy')}</span>
                          <span className="text-xs text-muted-foreground ml-2">{format(new Date(po.dateReceived || po.createdAt || po.timestamp), 'HH:mm')}</span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-foreground">{po.supplier?.name || '-'}</td>
                        <td className="py-4 px-4 font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{po.journalNumber || po.id}</td>
                        <td className="py-4 px-4 text-xs font-medium text-foreground max-w-[250px] truncate">
                          {(po.items || []).map((i: any) => `${i.productName || i.sku} (${i.quantity})`).join(', ')}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${po.status === 'RECEIVED' || po.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'}`}>{po.status}</span></td>
                        <td className="py-4 px-4 whitespace-nowrap"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-foreground">{po.paymentStatus}</span></td>
                        <td className="py-4 px-6 text-right font-serif font-semibold text-base text-foreground">{sym}{(po.total || po.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={6}>TOTALS</td>
                      <td className="py-3.5 px-6 text-right font-serif text-base text-foreground">{sym}{purchasesItems.reduce((sum, po) => sum + (po.total || po.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Purchases Trend Chart */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b px-6 py-4">
              <h3 className="font-serif text-2xl font-normal text-foreground">Purchases Trend</h3>
              <div className="text-xs text-muted-foreground font-medium">Daily Procurement • KES</div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPurchases}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="purchases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability Report Tab */}
        <TabsContent value="profitability" className="space-y-8">
          {/* Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <h2 className="text-3xl font-normal tracking-tight font-serif text-foreground">
                Profitability <span className="text-amber-600 font-serif italic font-normal">Report</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                A high-level view of your business health — comparing POS and Accommodation booking revenues against room-specific and general operating expenses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={handleExportProfitability}>
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" /> Export
              </Button>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm" onClick={() => printTable('profitability-ledger-table', 'Profitability Ledger')}>
                <Printer className="w-4 h-4 mr-1.5 text-muted-foreground" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-1.5 text-amber-400" /> Reconcile
              </Button>
            </div>
          </div>

          {/* Key Metrics Grid (Compact Single Row) */}
          <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto w-full pb-1">
            {/* Total Revenue */}
            <div className="flex-1 min-w-[200px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/90 to-teal-100/70 border-emerald-200/80 dark:from-emerald-950/40 dark:to-teal-900/30 dark:border-emerald-800/50 text-emerald-950 dark:text-emerald-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>TOTAL REVENUE</span>
                </div>
                <div className="p-1.5 rounded-full bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200 shrink-0"><DollarSign className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {profitabilityMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">
                  POS: {sym}{profitabilityMetrics.totalPosRevenue.toLocaleString()} | Bookings: {sym}{profitabilityMetrics.totalBookingRevenue.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-emerald-200 dark:bg-emerald-800"><div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Gross Revenue Flow</span><span>100%</span></div>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="flex-1 min-w-[200px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md bg-gradient-to-br from-rose-50/90 to-pink-100/70 border-rose-200/80 dark:from-rose-950/40 dark:to-pink-900/30 dark:border-rose-800/50 text-rose-950 dark:text-rose-100 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-rose-100/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>TOTAL EXPENSES</span>
                </div>
                <div className="p-1.5 rounded-full bg-rose-200/60 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200 shrink-0"><Tag className="w-3.5 h-3.5" /></div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {profitabilityMetrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">
                  Room: {sym}{profitabilityMetrics.roomExpenses.toLocaleString()} | General: {sym}{profitabilityMetrics.generalExpenses.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1 w-full rounded-full overflow-hidden bg-rose-200 dark:bg-rose-800"><div className="h-full rounded-full bg-rose-600 dark:bg-rose-400 w-full" /></div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75"><span>Operating Spend</span><span>100%</span></div>
              </div>
            </div>

            {/* Net Profit / Loss */}
            <div className={`flex-1 min-w-[200px] p-3.5 rounded-2xl border shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-3 ${
              profitabilityMetrics.netProfit >= 0
                ? 'bg-gradient-to-br from-violet-50/90 to-fuchsia-100/70 border-violet-200/80 dark:from-violet-950/40 dark:to-fuchsia-900/30 dark:border-violet-800/50 text-violet-950 dark:text-violet-100'
                : 'bg-gradient-to-br from-amber-50/90 to-orange-100/70 border-amber-200/80 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-800/50 text-amber-950 dark:text-amber-100'
            }`}>
              <div className="flex items-center justify-between gap-1">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  profitabilityMetrics.netProfit >= 0
                    ? 'bg-violet-100/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border-violet-200'
                    : 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profitabilityMetrics.netProfit >= 0 ? 'bg-violet-500' : 'bg-amber-500'}`} />
                  <span>{profitabilityMetrics.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</span>
                </div>
                <div className={`p-1.5 rounded-full shrink-0 ${
                  profitabilityMetrics.netProfit >= 0
                    ? 'bg-violet-200/60 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200'
                    : 'bg-amber-200/60 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200'
                }`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold uppercase opacity-70">KES</span>
                  <span className="text-xl lg:text-2xl font-normal font-serif tracking-tight truncate">
                    {profitabilityMetrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] font-medium opacity-75 mt-0.5 truncate">
                  Margin: {profitabilityMetrics.profitMargin.toFixed(1)}%
                </p>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className={`h-1 w-full rounded-full overflow-hidden ${profitabilityMetrics.netProfit >= 0 ? 'bg-violet-200 dark:bg-violet-800' : 'bg-amber-200 dark:bg-amber-800'}`}>
                  <div className={`h-full rounded-full ${profitabilityMetrics.netProfit >= 0 ? 'bg-violet-600 dark:bg-violet-400' : 'bg-amber-600 dark:bg-amber-400'} w-full`} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-semibold opacity-75">
                  <span>Net Bottomline</span>
                  <span>{profitabilityMetrics.netProfit >= 0 ? 'Healthy' : 'Deficit'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Detailed Lists */}
            <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card lg:col-span-2">
              <CardHeader className="bg-muted/20 border-b px-6 py-4">
                <CardTitle className="font-serif text-xl font-normal text-foreground">Operational Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Revenues</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30">
                      <span className="text-xs text-muted-foreground font-medium block">POS Sales Revenue</span>
                      <span className="font-serif text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {sym}{profitabilityMetrics.totalPosRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-900/30">
                      <span className="text-xs text-muted-foreground font-medium block">Accommodation Booking Revenue</span>
                      <span className="font-serif text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {sym}{profitabilityMetrics.totalBookingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Expenses</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/40 dark:border-rose-900/30">
                      <span className="text-xs text-muted-foreground font-medium block">Room Accommodation Expenses</span>
                      <span className="font-serif text-lg font-semibold text-rose-600 dark:text-rose-400">
                        {sym}{profitabilityMetrics.roomExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/40 dark:border-rose-900/30">
                      <span className="text-xs text-muted-foreground font-medium block">General House Expenses</span>
                      <span className="font-serif text-lg font-semibold text-rose-600 dark:text-rose-400">
                        {sym}{profitabilityMetrics.generalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {expenseCategoryBreakdown.length > 0 ? (
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Category Spending Breakdown</span>
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {expenseCategoryBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm border-b pb-1.5">
                            <span className="font-medium text-foreground">{item.category} ({item.count} bills)</span>
                            <span className="font-serif font-semibold text-rose-600 dark:text-rose-400">{sym}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No categorized expenses recorded in this period.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recharts Bar Chart */}
            <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
              <CardHeader className="bg-muted/20 border-b px-6 py-4">
                <CardTitle className="font-serif text-xl font-normal text-foreground">Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-64 flex flex-col justify-between">
                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={[
                      { name: 'Revenue', amount: profitabilityMetrics.totalRevenue },
                      { name: 'Expenses', amount: profitabilityMetrics.totalExpenses }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs font-semibold" />
                      <YAxis className="text-xs font-serif" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        <Cell key="cell-0" fill="hsl(var(--success))" />
                        <Cell key="cell-1" fill="hsl(var(--destructive))" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="text-center text-xs font-medium text-muted-foreground border-t pt-2 mt-2">
                    Net cash flow margin: <span className={profitabilityMetrics.netProfit >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                      {profitabilityMetrics.netProfit >= 0 ? '+' : ''}{sym}{profitabilityMetrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger Table Section */}
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between bg-muted/20 border-b px-6 py-4 gap-4">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-2xl font-normal text-foreground">Profitability Ledger</h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-normal bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-0">
                  {filteredProfitabilityLedger.length} cashflows
                </Badge>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search cash flows..."
                  value={profitabilitySearchQuery}
                  onChange={(e) => setProfitabilitySearchQuery(e.target.value)}
                  className="pl-10 rounded-full border-amber-300/60 focus-visible:ring-amber-500 bg-background/90 h-9 text-xs shadow-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table id="profitability-ledger-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Source / Entity</th>
                      <th className="py-3.5 px-4">Category / Method</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-6 text-right">Cash Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {isExpensesLoading || isPaymentsLoading ? (
                      <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></td></tr>
                    ) : filteredProfitabilityLedger.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No cash flows found in the ledger.</td></tr>
                    ) : filteredProfitabilityLedger.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-semibold text-foreground">{format(item.date, 'MMM d')}</span>
                          <span className="text-xs text-muted-foreground ml-2">{format(item.date, 'HH:mm')}</span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.type === 'REVENUE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-200'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-200'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-foreground">{item.source}</td>
                        <td className="py-4 px-4 font-mono text-xs text-muted-foreground">{item.category}</td>
                        <td className="py-4 px-4 text-xs font-medium text-foreground max-w-[300px] truncate">{item.description}</td>
                        <td className={`py-4 px-6 text-right font-serif font-bold text-base whitespace-nowrap ${
                          item.type === 'REVENUE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {item.type === 'REVENUE' ? '+' : ''}{sym}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-double bg-amber-50/50 dark:bg-card text-xs font-bold text-foreground">
                    <tr>
                      <td className="py-3.5 px-6" colSpan={5}>NET INCOME BALANCE</td>
                      <td className={`py-3.5 px-6 text-right font-serif font-bold text-base whitespace-nowrap ${
                        profitabilityMetrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {profitabilityMetrics.netProfit >= 0 ? '+' : ''}{sym}{profitabilityMetrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>




    </AppLayout>
  );
}
