import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, DollarSign, AlertTriangle, Filter, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { format, isAfter, isBefore, isEqual, compareAsc } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect, Option } from '@/components/ui/multi-select';

export default function Reports() {
  const { products, transactions, locations, refreshData } = useInventory();
  // Wait, locations IS used in getStockMovements (line 123+). I must keep it.

  // Report State (Global Filters)
  const [startDate, setStartDate] = useState<string>('2024-01-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // All Sales (Primary Data Source)
  const sales = useMemo(() => transactions.filter(t => t.type === 'SALE'), [transactions]);

  // Active Inventory Data
  const activeProducts = useMemo(() => products.filter(p => p.isActive !== false), [products]);
  const activeVariants = useMemo(() => activeProducts.flatMap(p => p.variants.filter(v => v.isActive !== false)), [activeProducts]);

  // Filtered Sales (Based on Date Range)
  const filteredSales = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return sales.filter(s => {
      const d = new Date(s.timestamp);
      return (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
    });
  }, [sales, startDate, endDate]);

  // Returns Data
  const returns = useMemo(() => transactions.filter(t => t.type === 'RETURN'), [transactions]);
  const filteredReturns = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return returns.filter(s => {
      const d = new Date(s.timestamp);
      return (isAfter(d, start) || isEqual(d, start)) && (isBefore(d, end) || isEqual(d, end));
    });
  }, [returns, startDate, endDate]);

  // Key Metrics (Based on Filtered Sales)
  const totalSales = filteredSales.reduce((sum, s) => sum + (s.total || s.totalAmount || 0), 0);
  const totalItems = filteredSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.adjustment, 0), 0);

  // Inventory Metrics (Current State - Unfiltered by Date)
  const totalInventoryValue = activeVariants.reduce((sum, v) => sum + (v.stock * v.cost), 0);
  const totalRetailValue = activeVariants.reduce((sum, v) => sum + (v.stock * v.price), 0);

  // Stock Status (Current State)
  const inStock = activeVariants.filter(v => v.stock > v.lowStockThreshold).length;
  const lowStock = activeVariants.filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold).length;
  const outOfStock = activeVariants.filter(v => v.stock === 0).length;

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

  // Payments Data (Filtered)
  const payments = useMemo(() => {
    const all: { id: string, date: Date, ref: string, method: string, amount: number }[] = [];
    filteredSales.forEach(s => {
      const saleRef = s.journalNumber;
      if ((s as any).payments && (s as any).payments.length > 0) {
        (s as any).payments.forEach((p: any, idx: number) => {
          all.push({
            id: `${s.id}-p-${idx}`,
            date: new Date(s.timestamp),
            ref: saleRef,
            method: p.method,
            amount: p.amount
          });
        });
      } else {
        all.push({
          id: `${s.id}-p-default`,
          date: new Date(s.timestamp),
          ref: saleRef,
          method: (s as any).paymentMethod || 'CASH',
          amount: s.total || s.totalAmount || 0
        });
      }
    });
    return all.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredSales]);

  const paymentStats = useMemo(() => {
    const stats: Record<string, number> = {};
    payments.forEach(p => {
      stats[p.method] = (stats[p.method] || 0) + p.amount;
    });
    return stats;
  }, [payments]);

  // Stock Movement Report State
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // Product ID
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]); // Variant IDs
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData(startDate, endDate);
    setIsRefreshing(false);
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
        if (selectedLocationId === 'all') return sum + v.stock;
        return sum + (v.locationStock[selectedLocationId] || 0);
      }, 0);
    } else {
      // Specific variants
      targetVariants = product.variants.filter(v => selectedVariantIds.includes(v.id));
      initialTotalStock = targetVariants.reduce((sum, v) => {
        if (selectedLocationId === 'all') return sum + v.stock;
        return sum + (v.locationStock[selectedLocationId] || 0);
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
    }[] = [];

    // 1. Sales (Out)
    sales.forEach(sale => {
      // @ts-ignore - Assuming sale has locationId or we filter generically if 'all'
      const isRelevantLocation = selectedLocationId === 'all' || (sale as any).locationId === selectedLocationId;
      if (!isRelevantLocation) return;

      sale.items.forEach(item => {
        if (targetVariantIds.includes(item.variantId)) {
          movements.push({
            date: new Date(sale.timestamp),
            type: 'sale',
            quantity: -item.adjustment,
            reference: `Sale #${sale.journalNumber}`,
            runningBalance: 0,
            variantInfo: Object.values(item.attributes || {}).join('/')
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
          const isRelevant = selectedLocationId === 'all' || (t as any).locationId === selectedLocationId;
          if (isRelevant) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'adjustment',
              quantity: item.adjustment,
              reference: `Adj: ${t.notes || 'No reason'}`,
              runningBalance: 0,
              variantInfo: item.sku
            });
          }
        }
        else if (t.type === 'TRANSFER') {
          const transfer = t as any;
          // Outflow from source
          if (selectedLocationId === 'all' || transfer.fromLocationId === selectedLocationId) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'transfer',
              quantity: -item.adjustment,
              reference: `Trf Out: ${locations.find(l => l.id === transfer.toLocationId)?.name || 'Other'}`,
              runningBalance: 0,
              variantInfo: item.sku
            });
          }
          // Inflow to destination
          if (selectedLocationId === 'all' || transfer.toLocationId === selectedLocationId) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'transfer',
              quantity: item.adjustment,
              reference: `Trf In: ${locations.find(l => l.id === transfer.fromLocationId)?.name || 'Other'}`,
              runningBalance: 0,
              variantInfo: item.sku
            });
          }
        }
        else if (t.type === 'STOCK_TAKE') {
          const isRelevant = selectedLocationId === 'all' || (t as any).locationId === selectedLocationId;
          if (isRelevant) {
            movements.push({
              date: new Date(t.timestamp),
              type: 'audit',
              quantity: item.adjustment,
              reference: `Audit: ${t.notes || 'Stock Take'}`,
              runningBalance: 0,
              variantInfo: item.sku
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of day

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

  // Get current displayed stock
  const currentDisplayedStock = () => {
    if (!selectedProductId) return 0;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return 0;

    const activeVars = product.variants.filter(v =>
      selectedVariantIds.length === 0 || selectedVariantIds.includes(v.id)
    );

    return activeVars.reduce((sum, v) => {
      if (selectedLocationId === 'all') return sum + v.stock;
      return sum + (v.locationStock[selectedLocationId] || 0);
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
                <p className="text-2xl font-bold">${totalSales.toFixed(2)}</p>
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
                <p className="text-2xl font-bold">${totalInventoryValue.toLocaleString()}</p>
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
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">To</Label>
            <Input type="date" className="w-full sm:w-auto bg-background" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
          <TabsTrigger value="returns" className="whitespace-nowrap min-w-fit">Returns</TabsTrigger>
          <TabsTrigger value="payments" className="whitespace-nowrap min-w-fit">Payments Report</TabsTrigger>
          <TabsTrigger value="fast-moving" className="whitespace-nowrap min-w-fit">Fast Moving Items</TabsTrigger>
          <TabsTrigger value="history" className="whitespace-nowrap min-w-fit">Inventory History</TabsTrigger>
        </TabsList>

        {/* Stock Report Tab */}
        <TabsContent value="stock" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Valuation & Stock Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  {/* Add filters here if needed */}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Inventory Value (Cost)</p>
                  <p className="text-2xl font-bold">${totalInventoryValue.toLocaleString()}</p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[800px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Variant</th>
                        <th>Category</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Stock</th>
                        <th className="text-right">Total Cost</th>
                        <th className="text-right">Total Retail</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeProducts.flatMap(product =>
                        product.variants.filter(v => v.isActive !== false).map(variant => {
                          const totalCost = variant.stock * variant.cost;
                          const totalRetail = variant.stock * variant.price;
                          let statusColor = "bg-success";
                          let statusText = "In Stock";
                          if (variant.stock === 0) {
                            statusColor = "bg-destructive";
                            statusText = "Out of Stock";
                          } else if (variant.stock <= variant.lowStockThreshold) {
                            statusColor = "bg-warning";
                            statusText = "Low Stock";
                          }

                          return (
                            <tr key={variant.id}>
                              <td className="font-medium">{product.name}</td>
                              <td className="text-muted-foreground text-sm">{Object.values(variant.attributes).join(' / ') || 'Default'}</td>
                              <td>{product.category}</td>
                              <td className="text-right">${variant.cost.toFixed(2)}</td>
                              <td className="text-right">${variant.price.toFixed(2)}</td>
                              <td className="text-right font-bold">{variant.stock}</td>
                              <td className="text-right">${totalCost.toFixed(2)}</td>
                              <td className="text-right">${totalRetail.toFixed(2)}</td>
                              <td>
                                <span className={`px-2 py-1 rounded-full text-xs text-white ${statusColor}`}>
                                  {statusText}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">${totalSales.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Tax</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${filteredSales.reduce((sum, s) => sum + (s.tax || s.taxAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{filteredSales.length}</div></CardContent>
            </Card>
          </div>

          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Sales List */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[700px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Payment</th>
                        <th>Subtotal</th>
                        <th>Tax</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id}>
                          <td>{format(new Date(sale.timestamp), 'MMM d, yyyy HH:mm')}</td>
                          <td>
                            {sale.items.map(i => `${i.productName} (${i.adjustment})`).join(', ')}
                          </td>
                          <td className="capitalize">{sale.status === 'COMPLETED' ? 'Paid' : sale.status.toLowerCase()}</td>
                          <td>${(sale.subtotal || 0).toFixed(2)}</td>
                          <td>${(sale.tax || sale.taxAmount || 0).toFixed(2)}</td>
                          <td className="font-semibold">${(sale.total || sale.totalAmount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Refunded</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${filteredReturns.reduce((sum, r) => sum + (r.totalAmount || (r as any).amountPaid || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Return Count</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{filteredReturns.length}</div></CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[700px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Return Ref</th>
                        <th>Items Returned</th>
                        <th>Reason / Notes</th>
                        <th className="text-right">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReturns.map((r) => (
                        <tr key={r.id}>
                          <td>{format(new Date(r.timestamp), 'MMM d, yyyy HH:mm')}</td>
                          <td>{r.journalNumber}</td>
                          <td>{r.items.map(i => `${i.productName} (${Math.abs(i.adjustment)})`).join(', ')}</td>
                          <td>{r.notes || '-'}</td>
                          <td className="text-right font-medium text-destructive">-${(r.totalAmount || (r as any).amountPaid || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                {Object.entries(paymentStats).map(([method, amount]) => (
                  <Card key={method}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium uppercase text-muted-foreground">{method}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[600px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Ref</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id}>
                          <td>{format(p.date, 'MMM d, yyyy HH:mm')}</td>
                          <td>{p.ref}</td>
                          <td>{p.method}</td>
                          <td className="text-right font-medium">${p.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fast-moving" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Fast Moving Items</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80 mb-6">
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
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[500px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Product</th>
                        <th className="text-right">Qty Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestSellers.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-mono text-sm">#{idx + 1}</td>
                          <td className="font-medium">{item.name}</td>
                          <td className="text-right font-bold">{item.sales}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Detailed Stock Movement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 items-end">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={(val) => {
                    setSelectedProductId(val);
                    setSelectedVariantIds([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Variant(s)</Label>
                  <MultiSelect
                    options={variantOptions}
                    selected={selectedVariantIds}
                    onChange={setSelectedVariantIds}
                    placeholder="Select variants..."
                    className={!selectedProductId ? "opacity-50 pointer-events-none" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full" />
                </div>
              </div>

              {selectedProductId ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg flex gap-8">
                    <div>
                      <span className="text-sm text-muted-foreground block">Opening Balance</span>
                      <span className="font-semibold text-lg">{openingBalance}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block">Current Stock</span>
                      <span className="font-semibold text-lg">
                        {currentDisplayedStock()}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="min-w-[800px] inline-block align-middle p-4 sm:p-0">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Variant (Info)</th>
                            <th>Reference</th>
                            <th className="text-right">In/Out</th>
                            <th className="text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.length > 0 ? (
                            movements.map((move, i) => (
                              <tr key={i}>
                                <td>{format(move.date, 'MMM d, yyyy HH:mm')}</td>
                                <td className="capitalize">{move.type}</td>
                                <td className="text-sm text-muted-foreground">{move.variantInfo || '-'}</td>
                                <td className="text-sm text-muted-foreground">{move.reference}</td>
                                <td className={`text-right font-mono ${move.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {move.quantity > 0 ? '+' : ''}{move.quantity}
                                </td>
                                <td className="text-right font-mono font-medium">
                                  {move.runningBalance}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                No movements found in this period.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Please select a product to view movement history.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stock Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {stockStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total SKUs</span>
                    <span className="text-2xl font-bold">{activeVariants.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Units</span>
                    <span className="text-2xl font-bold">
                      {activeVariants.reduce((sum, v) => sum + v.stock, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Cost Value</span>
                    <span className="text-2xl font-bold">${totalInventoryValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Retail Value</span>
                    <span className="text-2xl font-bold">${totalRetailValue.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[500px] inline-block align-middle p-4 sm:p-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Ref #</th>
                        <th>Items</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.filter(t => t.type === 'ADJUSTMENT').slice(0, 10).map((adj) => (
                        <tr key={adj.id}>
                          <td>{format(new Date(adj.timestamp), 'MMM d, HH:mm')}</td>
                          <td className="font-mono text-xs font-bold text-primary">{adj.journalNumber}</td>
                          <td>
                            <div className="space-y-1">
                              {adj.items.map((item, i) => (
                                <div key={i} className="text-[11px] flex justify-between gap-4">
                                  <span>{item.productName} ({item.sku})</span>
                                  <span className={item.adjustment > 0 ? 'text-success font-bold' : 'text-destructive font-bold'}>
                                    {item.adjustment > 0 ? '+' : ''}{item.adjustment}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="text-xs text-muted-foreground italic truncate max-w-[150px]">
                            {adj.notes || '---'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
