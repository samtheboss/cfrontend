import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts, mockAdjustments } from '@/data/mockData';
import { StockAdjustment as StockAdjustmentType } from '@/types/inventory';
import { Search, Plus, Minus, Check, History, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PendingAdjustment {
  variantId: string;
  productName: string;
  sku: string;
  currentStock: number;
  adjustment: number;
}

export default function StockAdjustment() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [reason, setReason] = useState('');
  const [adjustmentHistory] = useState<StockAdjustmentType[]>(mockAdjustments);

  // Get all variants with product info
  const allVariants = mockProducts.flatMap(product =>
    product.variants.map(variant => ({
      ...variant,
      productName: product.name,
      category: product.category,
    }))
  );

  // Filter variants for search
  const filteredVariants = allVariants.filter(variant =>
    variant.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    variant.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    variant.barcode.includes(searchQuery)
  );

  const addToAdjustment = (variant: typeof allVariants[0]) => {
    if (pendingAdjustments.find(p => p.variantId === variant.id)) {
      toast.error('Item already in adjustment list');
      return;
    }
    setPendingAdjustments(prev => [...prev, {
      variantId: variant.id,
      productName: variant.productName,
      sku: variant.sku,
      currentStock: variant.stock,
      adjustment: 0
    }]);
    setSearchQuery('');
  };

  const updateAdjustment = (variantId: string, delta: number) => {
    setPendingAdjustments(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const newAdjustment = item.adjustment + delta;
        // Prevent going below negative of current stock
        if (item.currentStock + newAdjustment < 0) {
          toast.error('Cannot reduce stock below zero');
          return item;
        }
        return { ...item, adjustment: newAdjustment };
      }
      return item;
    }));
  };

  const setAdjustmentValue = (variantId: string, value: number) => {
    setPendingAdjustments(prev => prev.map(item => {
      if (item.variantId === variantId) {
        if (item.currentStock + value < 0) {
          toast.error('Cannot reduce stock below zero');
          return item;
        }
        return { ...item, adjustment: value };
      }
      return item;
    }));
  };

  const removeFromAdjustment = (variantId: string) => {
    setPendingAdjustments(prev => prev.filter(item => item.variantId !== variantId));
  };

  const submitAdjustments = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the adjustment');
      return;
    }
    if (pendingAdjustments.every(p => p.adjustment === 0)) {
      toast.error('No adjustments to submit');
      return;
    }
    
    // In a real app, this would save to the database
    toast.success(`Submitted ${pendingAdjustments.filter(p => p.adjustment !== 0).length} stock adjustments`);
    setPendingAdjustments([]);
    setReason('');
  };

  return (
    <AppLayout title="Stock Adjustment">
      <Tabs defaultValue="adjust" className="space-y-6">
        <TabsList>
          <TabsTrigger value="adjust">New Adjustment</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adjust" className="space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by product name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Search Results */}
              {searchQuery && (
                <div className="mt-4 border rounded-lg max-h-64 overflow-y-auto">
                  {filteredVariants.slice(0, 10).map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                      onClick={() => addToAdjustment(variant)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{variant.productName}</p>
                          <p className="text-sm text-muted-foreground">{variant.sku}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm">Current Stock</p>
                          <p className="font-semibold">{variant.stock}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredVariants.length === 0 && (
                    <p className="p-4 text-center text-muted-foreground">No products found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Adjustments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingAdjustments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Search and add products to adjust their stock levels
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg divide-y">
                    {pendingAdjustments.map((item) => (
                      <div key={item.variantId} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">{item.sku}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Current</p>
                            <p className="font-semibold">{item.currentStock}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateAdjustment(item.variantId, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.adjustment}
                              onChange={(e) => setAdjustmentValue(item.variantId, parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateAdjustment(item.variantId, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs text-muted-foreground">New</p>
                            <p className={`font-semibold ${item.adjustment !== 0 ? (item.adjustment > 0 ? 'text-success' : 'text-destructive') : ''}`}>
                              {item.currentStock + item.adjustment}
                            </p>
                          </div>
                          <Badge variant={item.adjustment > 0 ? 'default' : item.adjustment < 0 ? 'destructive' : 'secondary'}>
                            {item.adjustment > 0 ? '+' : ''}{item.adjustment}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromAdjustment(item.variantId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Adjustment *</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Damaged goods, New shipment received, Inventory count correction..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => setPendingAdjustments([])}>
                      Clear All
                    </Button>
                    <Button onClick={submitAdjustments}>
                      <Check className="h-4 w-4 mr-2" />
                      Submit Adjustments
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adjustment History</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Previous</th>
                    <th>Adjustment</th>
                    <th>New Stock</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustmentHistory.map((adj) => (
                    <tr key={adj.id}>
                      <td className="text-sm">
                        {format(adj.timestamp, 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="font-medium">{adj.productName}</td>
                      <td className="font-mono text-sm">{adj.variantSku}</td>
                      <td>{adj.previousStock}</td>
                      <td>
                        <Badge variant={adj.adjustment > 0 ? 'default' : 'destructive'}>
                          {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}
                        </Badge>
                      </td>
                      <td className="font-semibold">{adj.newStock}</td>
                      <td className="text-sm text-muted-foreground max-w-xs truncate">
                        {adj.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
