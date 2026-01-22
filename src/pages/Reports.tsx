import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts, mockSales, mockAdjustments } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, DollarSign, AlertTriangle, Filter, Eye } from 'lucide-react';
import { format, isAfter, isBefore, isEqual, compareAsc } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect, Option } from '@/components/ui/multi-select';

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

  // Stock Movement Report State
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // Product ID
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]); // Variant IDs

  const [startDate, setStartDate] = useState<string>(
    '2024-01-01'
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Helper options
  const productOptions = mockProducts.map(p => ({
    id: p.id,
    label: p.name
  }));

  const variantOptions: Option[] = useMemo(() => {
    if (!selectedProductId) return [];

    const product = mockProducts.find(p => p.id === selectedProductId);
    if (!product) return [];

    return product.variants.map(v => ({
      value: v.id,
      label: Object.values(v.attributes).join(' / ')
    }));
  }, [selectedProductId]);


  // Calculate stock movements for selected variant or product
  const getStockMovements = () => {
    if (!selectedProductId) return { movements: [], openingBalance: 0 };

    const product = mockProducts.find(p => p.id === selectedProductId);
    if (!product) return { movements: [], openingBalance: 0 };

    let targetVariants = [];
    let initialStock = 0;

    if (selectedVariantIds.length === 0) {
      // Default to ALL variants if none selected
      targetVariants = product.variants;
      initialStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      // Specific variants
      targetVariants = product.variants.filter(v => selectedVariantIds.includes(v.id));
      initialStock = targetVariants.reduce((sum, v) => sum + v.stock, 0);
    }

    if (targetVariants.length === 0) return { movements: [], openingBalance: 0 };
    const targetVariantIds = targetVariants.map(v => v.id);

    // Gather all impact events (sales and adjustments)
    const movements: {
      date: Date;
      type: 'sale' | 'adjustment';
      quantity: number; // Positive = In, Negative = Out
      reference: string;
      runningBalance: number;
      variantInfo?: string; // To distinguish in full product view
    }[] = [];

    // 1. Sales (Out)
    mockSales.forEach(sale => {
      sale.items.forEach(item => {
        if (targetVariantIds.includes(item.variantId)) {
          movements.push({
            date: sale.timestamp,
            type: 'sale',
            quantity: -item.quantity,
            reference: `Sale #${sale.id.substring(0, 6)}`,
            runningBalance: 0,
            variantInfo: Object.values(item.attributes).join('/')
          });
        }
      });
    });

    // 2. Adjustments (In/Out)
    mockAdjustments.forEach(adj => {
      if (targetVariantIds.includes(adj.variantId)) {
        movements.push({
          date: adj.timestamp,
          type: 'adjustment',
          quantity: adj.adjustment,
          reference: `Adj: ${adj.reason}`,
          runningBalance: 0,
          variantInfo: adj.variantSku // Or lookup attributes if needed
        });
      }
    });

    // Sort by date ascending
    movements.sort((a, b) => compareAsc(a.date, b.date));

    // Calculate balances
    // Strategy: reverse-engineer from current stock

    const totalChange = movements.reduce((sum, m) => sum + m.quantity, 0);
    let openingBalance = initialStock - totalChange;

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
    const product = mockProducts.find(p => p.id === selectedProductId);
    if (!product) return 0;

    if (selectedVariantIds.length === 0) {
      return product.variants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      return product.variants
        .filter(v => selectedVariantIds.includes(v.id))
        .reduce((sum, v) => sum + v.stock, 0);
    }
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

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
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

          {/* Detailed Stock Movement - Moved to top of Inventory tab as requested */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Detailed Stock Movement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">

                {/* Product Select */}
                <div className="w-full md:w-1/4 space-y-2">
                  <Label>Product</Label>
                  <Select value={selectedProductId} onValueChange={(val) => {
                    setSelectedProductId(val);
                    setSelectedVariantIds([]); // Reset variants when product changes
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

                {/* Variant Select (Multi-Select) */}
                <div className="w-full md:w-1/4 space-y-2">
                  <Label>Variant(s) Leave empty to view all variants.</Label>
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
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
              ) : (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Please select a product to view movement history.</p>
                </div>
              )}
            </CardContent>
          </Card>

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
