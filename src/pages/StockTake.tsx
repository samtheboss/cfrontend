import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts } from '@/data/mockData';
import { StockTakeItem } from '@/types/inventory';
import { ClipboardList, Search, Check, AlertTriangle, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StockTake() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCountingMode, setIsCountingMode] = useState(false);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [countedItems, setCountedItems] = useState<Set<string>>(new Set());

  // Initialize stock take
  const startStockTake = () => {
    const items: StockTakeItem[] = mockProducts.flatMap(product =>
      product.variants.map(variant => ({
        variantId: variant.id,
        productName: product.name,
        variantSku: variant.sku,
        systemStock: variant.stock,
        countedStock: 0,
        variance: 0
      }))
    );
    setStockTakeItems(items);
    setCountedItems(new Set());
    setIsCountingMode(true);
    toast.success('Stock take started');
  };

  const updateCount = (variantId: string, count: number) => {
    setStockTakeItems(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const variance = count - item.systemStock;
        return { ...item, countedStock: count, variance };
      }
      return item;
    }));
    setCountedItems(prev => new Set([...prev, variantId]));
  };

  const filteredItems = stockTakeItems.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.variantSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const progress = stockTakeItems.length > 0
    ? (countedItems.size / stockTakeItems.length) * 100
    : 0;

  const itemsWithVariance = stockTakeItems.filter(item => 
    countedItems.has(item.variantId) && item.variance !== 0
  );

  const totalVariance = itemsWithVariance.reduce((sum, item) => sum + item.variance, 0);

  const applyAdjustments = () => {
    if (itemsWithVariance.length === 0) {
      toast.info('No variances to apply');
      return;
    }
    toast.success(`Applied ${itemsWithVariance.length} stock adjustments`);
    setIsCountingMode(false);
    setStockTakeItems([]);
    setCountedItems(new Set());
  };

  const cancelStockTake = () => {
    setIsCountingMode(false);
    setStockTakeItems([]);
    setCountedItems(new Set());
    toast.info('Stock take cancelled');
  };

  if (!isCountingMode) {
    return (
      <AppLayout title="Stock Take">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mx-auto mb-6">
            <ClipboardList className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-4">Physical Inventory Count</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Start a stock take to compare your physical inventory with system records.
            Any variances can be applied as stock adjustments.
          </p>
          <Button size="lg" onClick={startStockTake}>
            Start Stock Take
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Stock Take">
      {/* Progress Header */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Counting Progress</h3>
              <p className="text-sm text-muted-foreground">
                {countedItems.size} of {stockTakeItems.length} items counted
              </p>
            </div>
            <div className="flex items-center gap-4">
              {itemsWithVariance.length > 0 && (
                <Badge variant={totalVariance > 0 ? 'default' : 'destructive'}>
                  {itemsWithVariance.length} variances ({totalVariance > 0 ? '+' : ''}{totalVariance} units)
                </Badge>
              )}
              <Button variant="outline" onClick={cancelStockTake}>Cancel</Button>
              <Button onClick={applyAdjustments} disabled={countedItems.size === 0}>
                <Check className="h-4 w-4 mr-2" />
                Complete & Apply
              </Button>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products or SKUs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      {/* Items Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => {
          const isCounted = countedItems.has(item.variantId);
          const hasVariance = isCounted && item.variance !== 0;

          return (
            <Card
              key={item.variantId}
              className={cn(
                'transition-all',
                isCounted && 'border-success/50',
                hasVariance && 'border-warning/50'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">{item.variantSku}</p>
                    </div>
                  </div>
                  {isCounted && (
                    <Badge variant={hasVariance ? 'secondary' : 'default'} className="shrink-0">
                      {hasVariance ? (
                        <><AlertTriangle className="h-3 w-3 mr-1" /> Variance</>
                      ) : (
                        <><Check className="h-3 w-3 mr-1" /> Counted</>
                      )}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">System</p>
                    <p className="font-semibold">{item.systemStock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Counted</p>
                    <Input
                      type="number"
                      min="0"
                      value={item.countedStock || ''}
                      onChange={(e) => updateCount(item.variantId, parseInt(e.target.value) || 0)}
                      className="text-center h-8"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={cn(
                      'font-semibold',
                      item.variance > 0 && 'text-success',
                      item.variance < 0 && 'text-destructive'
                    )}>
                      {item.variance > 0 ? '+' : ''}{isCounted ? item.variance : '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
