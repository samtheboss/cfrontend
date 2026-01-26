import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { StockBadge } from '@/components/inventory/StockBadge';
import { useInventory } from '@/contexts/InventoryContext';
import { getStockStatus } from '@/types/inventory';
import { DollarSign, Package, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { products, salesHistory, isLoading } = useInventory();

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Calculate stats
  const totalProducts = products.length;
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
  const lowStockItems = products.flatMap(p => p.variants || []).filter(v => (v.stock || 0) > 0 && (v.stock || 0) <= (v.lowStockThreshold || 0)).length;
  const outOfStockItems = products.flatMap(p => p.variants || []).filter(v => (v.stock || 0) === 0).length;

  // Calculate today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySalesValue = salesHistory
    .filter(s => new Date(s.timestamp) >= today)
    .reduce((sum, s) => {
      const val = s.total || (s as any).totalAmount || 0;
      return sum + val;
    }, 0);

  const totalInventoryValue = products.flatMap(p => p.variants || []).reduce((sum, v) => sum + ((v.stock || 0) * (v.cost || 0)), 0);

  // Recent sales
  const recentSales = [...salesHistory]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // Low stock alerts
  const lowStockAlerts = products.flatMap(p =>
    (p.variants || [])
      .filter(v => (v.stock || 0) <= (v.lowStockThreshold || 0))
      .map(v => ({ ...v, productName: p.name }))
  ).slice(0, 5);

  return (
    <AppLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Today's Sales"
          value={`${todaySalesValue.toFixed(2)}`}
          change="+12.5% from yesterday"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="Total Products"
          value={totalProducts}
          change={`${totalVariants} variants`}
          changeType="neutral"
          icon={Package}
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockItems}
          change={`${outOfStockItems} out of stock`}
          changeType={lowStockItems > 0 ? 'negative' : 'neutral'}
          icon={AlertTriangle}
        />
        <StatCard
          title="Inventory Value"
          value={`${totalInventoryValue.toLocaleString()}`}
          change="+2.3% this month"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Recent Sales</CardTitle>
            <a href="/reports" className="text-sm text-primary hover:underline">View all</a>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm truncate">
                      {sale.items?.map(i => i.productName).join(', ') || 'No items'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.timestamp).toLocaleDateString()} at {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{(sale.total || (sale as any).totalAmount || 0).toFixed(2)}</span>
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  </div>
                </div>
              ))}
              {recentSales.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent sales</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Stock Alerts</CardTitle>
            <a href="/inventory" className="text-sm text-primary hover:underline">View inventory</a>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockAlerts.map((variant) => (
                <div key={variant.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-medium text-sm truncate">{variant.productName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      SKU: {variant.sku} • {variant.attributes ? Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : 'No attributes'}
                    </p>
                  </div>
                  <StockBadge status={getStockStatus(variant.stock || 0, variant.lowStockThreshold || 0)} stock={variant.stock || 0} />
                </div>
              ))}
              {lowStockAlerts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No stock alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
