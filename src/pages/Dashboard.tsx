import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { StockBadge } from '@/components/inventory/StockBadge';
import { mockProducts, mockSales } from '@/data/mockData';
import { getStockStatus } from '@/types/inventory';
import { DollarSign, Package, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  // Calculate stats
  const totalProducts = mockProducts.length;
  const totalVariants = mockProducts.reduce((sum, p) => sum + p.variants.length, 0);
  const lowStockItems = mockProducts.flatMap(p => p.variants).filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold).length;
  const outOfStockItems = mockProducts.flatMap(p => p.variants).filter(v => v.stock === 0).length;
  const todaySales = mockSales.reduce((sum, s) => sum + s.total, 0);
  const totalInventoryValue = mockProducts.flatMap(p => p.variants).reduce((sum, v) => sum + (v.stock * v.cost), 0);

  // Recent sales
  const recentSales = mockSales.slice(0, 5);

  // Low stock alerts
  const lowStockAlerts = mockProducts.flatMap(p => 
    p.variants
      .filter(v => v.stock <= v.lowStockThreshold)
      .map(v => ({ ...v, productName: p.name }))
  ).slice(0, 5);

  return (
    <AppLayout title="Dashboard">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Today's Sales"
          value={`$${todaySales.toFixed(2)}`}
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
          value={`$${totalInventoryValue.toLocaleString()}`}
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
                  <div>
                    <p className="font-medium text-sm">{sale.items.map(i => i.productName).join(', ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.timestamp.toLocaleDateString()} at {sale.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${sale.total.toFixed(2)}</span>
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  </div>
                </div>
              ))}
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
                  <div>
                    <p className="font-medium text-sm">{variant.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {variant.sku} • {Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </p>
                  </div>
                  <StockBadge status={getStockStatus(variant.stock, variant.lowStockThreshold)} stock={variant.stock} />
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
