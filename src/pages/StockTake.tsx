import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { StockTakeItem, Location } from '@/types/inventory';
import { ClipboardList, Search, Check, AlertTriangle, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function StockTake() {
  const { products, locations, applyStockTake } = useInventory();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id
  );
  const [isCountingMode, setIsCountingMode] = useState(false);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [countedItems, setCountedItems] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Initialize stock take (Active only)
  const startStockTake = () => {
    const items: StockTakeItem[] = products
      .filter(p => p.isActive !== false)
      .flatMap(product =>
        product.variants
          .filter(v => v.isActive !== false)
          .map(variant => {
            const stock = variant.locationStock[selectedLocationId] || 0;
            return {
              variantId: variant.id,
              productName: product.name,
              variantSku: variant.sku,
              systemStock: stock,
              countedStock: 0,
              variance: 0
            };
          })
      );
    setStockTakeItems(items);
    setCountedItems(new Set());
    setExpandedProducts(new Set());
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

  // Group items by product for display
  const groupedItems = stockTakeItems.reduce((acc, item) => {
    if (!acc[item.productName]) acc[item.productName] = [];
    acc[item.productName].push(item);
    return acc;
  }, {} as Record<string, StockTakeItem[]>);

  const filteredGroupNames = Object.keys(groupedItems).filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    groupedItems[name].some(v => v.variantSku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalVariance = itemsWithVariance.reduce((sum, item) => sum + item.variance, 0);

  const submitStockTake = async () => {
    const countedItemsList = stockTakeItems.filter(item => countedItems.has(item.variantId));

    if (countedItemsList.length === 0) {
      toast.info('No items counted yet');
      return;
    }

    try {
      await applyStockTake({
        locationId: selectedLocationId,
        notes: `Physical inventory count at ${locations.find(l => l.id === selectedLocationId)?.name}`,
        items: countedItemsList.map(item => ({
          variantId: item.variantId,
          sku: item.variantSku,
          productName: item.productName,
          quantityBefore: item.systemStock,
          quantityAfter: item.countedStock,
          adjustment: item.variance
        }))
      });

      setIsCountingMode(false);
      setStockTakeItems([]);
      setCountedItems(new Set());
    } catch (error) {
      // Error handled by context
    }
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
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start a stock take to compare your physical inventory with system records.
            Any variances can be applied as stock adjustments.
          </p>

          <div className="max-w-xs mx-auto mb-8">
            <Label className="mb-2 block text-left">Select location to count:</Label>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger>
                <Package className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              <Button onClick={submitStockTake} disabled={countedItems.size === 0}>
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
      <div className="space-y-6">
        {filteredGroupNames.map((productName) => {
          const productItems = groupedItems[productName];
          const allCounted = productItems.every(i => countedItems.has(i.variantId));
          const someCounted = productItems.some(i => countedItems.has(i.variantId));
          const hasAnyVariance = productItems.some(i => countedItems.has(i.variantId) && i.variance !== 0);
          const isExpanded = expandedProducts.has(productName);

          const toggleExpand = () => {
            const next = new Set(expandedProducts);
            if (next.has(productName)) next.delete(productName);
            else next.add(productName);
            setExpandedProducts(next);
          };

          return (
            <Card key={productName} className={cn(
              'overflow-hidden transition-all border-l-4',
              allCounted ? 'border-l-success' : someCounted ? 'border-l-warning' : 'border-l-muted'
            )}>
              <div
                className="p-4 cursor-pointer hover:bg-muted/30 flex items-center justify-between"
                onClick={toggleExpand}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{productName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {productItems.length} variant{productItems.length !== 1 ? 's' : ''} •
                      {productItems.filter(i => countedItems.has(i.variantId)).length} counted
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasAnyVariance && (
                    <Badge variant="secondary" className="bg-warning/10 text-warning-foreground border-warning/20">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Variance
                    </Badge>
                  )}
                  {allCounted && !hasAnyVariance && (
                    <Badge variant="secondary" className="bg-success/10 text-success-foreground border-success/20">
                      <Check className="h-3 w-3 mr-1" /> All Counted
                    </Badge>
                  )}
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </div>

              {isExpanded && (
                <CardContent className="p-0 border-t bg-muted/10">
                  <div className="divide-y">
                    {productItems.map(item => {
                      const isCounted = countedItems.has(item.variantId);
                      return (
                        <div key={item.variantId} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                          <div>
                            <p className="text-sm font-medium">{item.variantSku}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">SKU</p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">System</p>
                            <p className="font-semibold text-sm">{item.systemStock}</p>
                          </div>

                          <div className="flex flex-col items-center">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Physical Count</p>
                            <Input
                              type="number"
                              min="0"
                              value={item.countedStock || ''}
                              onChange={(e) => updateCount(item.variantId, parseInt(e.target.value) || 0)}
                              className="text-center h-8 w-24"
                              placeholder="0"
                            />
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Variance</p>
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                'font-bold text-sm',
                                item.variance > 0 && 'text-success',
                                item.variance < 0 && 'text-destructive',
                                item.variance === 0 && isCounted && 'text-muted-foreground'
                              )}>
                                {item.variance > 0 ? '+' : ''}{isCounted ? item.variance : '-'}
                              </p>
                              {isCounted && (
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  item.variance === 0 ? "bg-success" : "bg-warning"
                                )} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
}
