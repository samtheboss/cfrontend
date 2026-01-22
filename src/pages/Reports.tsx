import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts, mockSales, mockAdjustments } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Package, DollarSign, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function Reports() {
  // Sales data
  const totalSales = mockSales.reduce((sum, s) => sum + s.total, 0);
  const totalItems = mockSales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);

  // Inventory data
  const allVariants = mockProducts.flatMap(p => p.variants);
  const totalInventoryValue = allVariants.reduce((sum, v) => sum + (v.stock * v.cost), 0);
  const totalRetailValue = allVariants.reduce((sum, v) => sum + (v.stock * v.price), 0);
  
  // Stock status
  const inStock = allVariants.filter(v => v.stock > v.lowStockThreshold).length;
  const lowStock = allVariants.filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold).length;
  const outOfStock = allVariants.filter(v => v.stock === 0).length;

  const stockStatusData = [
    { name: 'In Stock', value: inStock, color: 'hsl(var(--success))' },
    { name: 'Low Stock', value: lowStock, color: 'hsl(var(--warning))' },
    { name: 'Out of Stock', value: outOfStock, color: 'hsl(var(--destructive))' },
  ];

  // Best selling products (mock data)
  const bestSellers = [
    { name: 'Classic T-Shirt', sales: 156 },
    { name: 'Denim Jeans', sales: 89 },
    { name: 'Running Sneakers', sales: 67 },
    { name: 'Hoodie', sales: 45 },
    { name: 'Cap', sales: 34 },
  ];

  // Sales by category
  const salesByCategory = [
    { category: 'Apparel', sales: 4520 },
    { category: 'Footwear', sales: 2890 },
    { category: 'Accessories', sales: 1230 },
  ];

  // Daily sales trend (mock)
  const dailySales = [
    { day: 'Mon', sales: 1200 },
    { day: 'Tue', sales: 980 },
    { day: 'Wed', sales: 1450 },
    { day: 'Thu', sales: 1100 },
    { day: 'Fri', sales: 1780 },
    { day: 'Sat', sales: 2100 },
    { day: 'Sun', sales: 890 },
  ];

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

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySales}>
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
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sales by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="category" type="category" className="text-xs" width={80} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value) => [`$${value}`, 'Sales']}
                      />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {mockSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{format(sale.timestamp, 'MMM d, yyyy HH:mm')}</td>
                      <td>
                        {sale.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="capitalize">{sale.paymentMethod}</td>
                      <td>${sale.subtotal.toFixed(2)}</td>
                      <td>${sale.tax.toFixed(2)}</td>
                      <td className="font-semibold">${sale.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stock Status */}
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

            {/* Inventory Value */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total SKUs</span>
                    <span className="text-2xl font-bold">{allVariants.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Units</span>
                    <span className="text-2xl font-bold">
                      {allVariants.reduce((sum, v) => sum + v.stock, 0).toLocaleString()}
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

          {/* Stock Movements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Adjustment</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAdjustments.map((adj) => (
                    <tr key={adj.id}>
                      <td>{format(adj.timestamp, 'MMM d, yyyy HH:mm')}</td>
                      <td>{adj.productName}</td>
                      <td className="font-mono text-sm">{adj.variantSku}</td>
                      <td>
                        <span className={adj.adjustment > 0 ? 'text-success' : 'text-destructive'}>
                          {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}
                        </span>
                        <span className="text-muted-foreground"> ({adj.previousStock} → {adj.newStock})</span>
                      </td>
                      <td className="text-sm text-muted-foreground">{adj.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          {/* Best Sellers */}
          <Card>
            <CardHeader>
              <CardTitle>Best Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bestSellers}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Variants</th>
                    <th>Total Stock</th>
                    <th>Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {mockProducts.map((product) => {
                    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                    const avgPrice = product.variants.reduce((sum, v) => sum + v.price, 0) / product.variants.length;
                    return (
                      <tr key={product.id}>
                        <td className="font-medium">{product.name}</td>
                        <td>{product.category}</td>
                        <td>{product.variants.length}</td>
                        <td>{totalStock}</td>
                        <td>${avgPrice.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
