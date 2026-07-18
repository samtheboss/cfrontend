import { useState, Fragment } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Product, ProductVariant, StockAdjustment as StockAdjustmentType, Location, InventoryTransaction } from '@/types/inventory';
import { Search, Plus, Minus, Check, History, Package, ChevronRight, ChevronDown, Barcode, Save, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getBaseUrl } from '@/lib/api';

interface PendingAdjustment {
  variantId: string;
  productName: string;
  sku: string;
  currentStock: number;
  adjustment: number;
  attributes?: Record<string, string>;
}

export default function StockAdjustment() {
  const { products, locations, createAdjustment, updateTransaction, transactions } = useInventory();
  const { user } = useAuth();

  const adjustmentHistory = transactions.filter(t => t.type === 'ADJUSTMENT');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id
  );
  const [pendingAdjustments, setPendingAdjustments] = useState<PendingAdjustment[]>([]);
  const [reason, setReason] = useState('');
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftDialogOpen, setIsDraftDialogOpen] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(`adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const toggleJournal = (id: string) => {
    const next = new Set(expandedJournals);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedJournals(next);
  };

  const toggleProduct = (journalId: string, productName: string) => {
    const key = `${journalId}-${productName}`;
    const next = new Set(expandedProducts);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedProducts(next);
  };

  // UI State for variant selection
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filter products for search (Active only)
  const filteredProductsBySearch = products
    .filter(product => product.isActive !== false)
    .filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.variants
        .filter(v => v.isActive !== false)
        .some(v => v.sku.toLowerCase().includes(searchQuery.toLowerCase()) || v.barcode.includes(searchQuery))
    );

  const handleProductSelect = (product: Product) => {
    const activeVariants = product.variants.filter(v => v.isActive !== false);
    if (activeVariants.length === 1) {
      addToAdjustment(activeVariants[0], product.name);
    } else if (activeVariants.length === 0) {
      toast.error(`${product.name} has no available variants. Please add a variant first.`);
    } else {
      setSelectedProduct(product);
      setVariantDialogOpen(true);
    }
  };

  const addToAdjustment = (variant: ProductVariant, productName: string) => {
    if (pendingAdjustments.find(p => p.variantId === variant.id)) {
      toast.error('Item already in adjustment list');
      return;
    }

    const stock = variant.locationStock[selectedLocationId] || 0;

    setPendingAdjustments(prev => [...prev, {
      variantId: variant.id,
      productName: productName,
      sku: variant.sku,
      currentStock: stock,
      adjustment: 0,
      attributes: variant.attributes
    }]);

    setVariantDialogOpen(false);
    setSelectedProduct(null);
    setSearchQuery('');
  };

  const handleBulkAdjustment = (product: Product, variant: ProductVariant, value: number) => {
    setPendingAdjustments(prev => {
      const exists = prev.find(p => p.variantId === variant.id);
      if (exists) {
        if (value === 0) return prev.filter(p => p.variantId !== variant.id);
        return prev.map(item => item.variantId === variant.id ? { ...item, adjustment: value } : item);
      }
      if (value === 0) return prev;
      return [...prev, {
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        currentStock: variant.locationStock[selectedLocationId] || 0,
        adjustment: value,
        attributes: variant.attributes
      }];
    });
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

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    // Search for variant by barcode
    let found = false;
    for (const product of products) {
      if (product.isActive === false) continue;
      const variant = product.variants.find(v => v.isActive !== false && v.barcode === barcodeQuery.trim());
      if (variant) {
        addToAdjustment(variant, product.name);
        setBarcodeQuery('');
        found = true;
        toast.success(`Added ${product.name} to list`);
        break;
      }
    }

    if (!found) {
      toast.error('No product found with this barcode');
    }
  };

  const loadDraft = (draft: InventoryTransaction) => {
    setCurrentTransactionId(draft.id || null);
    const locId = draft.locationId?.toString() || locations[0]?.id?.toString() || 'all';
    setSelectedLocationId(locId);
    setReason(draft.notes || '');

    if (draft.timestamp) {
      const draftDate = new Date(draft.timestamp).toISOString().split('T')[0];
      setTransactionDate(draftDate);
    }

    const draftItems = (draft.items || []).map(item => {
      // Find current stock for this variant
      let systemStock = 0;
      let attributes: Record<string, string> | undefined = undefined;
      const product = products.find(p => p.name === item.productName);
      const variant = product?.variants.find(v => v.id.toString() === item.variantId?.toString());
      if (variant) {
        systemStock = variant.locationStock[locId] || 0;
        attributes = variant.attributes;
      }

      return {
        variantId: item.variantId!.toString(),
        sku: item.sku!,
        productName: item.productName!,
        adjustment: item.adjustment || 0,
        currentStock: systemStock,
        attributes: attributes
      };
    });

    setPendingAdjustments(draftItems);
    setIsDraftDialogOpen(false);
    toast.info(`Loaded draft ${draft.journalNumber}`);
  };

  const submitAdjustments = async (status: 'DRAFT' | 'COMPLETED' = 'COMPLETED') => {
    if (status === 'COMPLETED' && !reason.trim()) {
      toast.error('Please provide a reason for the adjustment');
      return;
    }
    const itemsToSubmit = pendingAdjustments.filter(p => status === 'DRAFT' || p.adjustment !== 0);
    if (itemsToSubmit.length === 0) {
      toast.error('No adjustments to submit');
      return;
    }

    setIsSubmitting(true);
    try {
      const transactionData = {
        type: 'ADJUSTMENT' as const,
        locationId: selectedLocationId,
        notes: reason || (status === 'DRAFT' ? 'Held Adjustment' : ''),
        status: status,
        timestamp: new Date(transactionDate + 'T00:00:00').toISOString(),
        idempotencyKey: idempotencyKey,
        items: itemsToSubmit.map(p => ({
          variantId: p.variantId,
          sku: p.sku,
          productName: p.productName,
          adjustment: p.adjustment
        }))
      };

      if (currentTransactionId) {
        // Update existing transaction
        await updateTransaction(currentTransactionId, transactionData);
      } else {
        // Create new
        await createAdjustment(transactionData);
      }

      setPendingAdjustments([]);
      setReason('');
      setCurrentTransactionId(null);
      setIdempotencyKey(`adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    } catch (error) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Stock Adjustment">

      {/* Variant Selection Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Select Variant</DialogTitle>
            <DialogDescription>
              Choose a specific variant of {selectedProduct?.name} to adjust.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedProduct?.variants
              .filter(v => v.isActive !== false)
              .map(variant => {
                const stock = variant.locationStock[selectedLocationId] || 0;
                return (
                  <Button
                    key={variant.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3 px-4"
                    onClick={() => addToAdjustment(variant, selectedProduct.name)}
                  >
                    <div className="text-left">
                      <p className="font-medium">
                        {Object.values(variant.attributes).join(' / ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{variant.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-muted-foreground">Stock</p>
                      <p className="font-semibold">{stock}</p>
                    </div>
                  </Button>
                )
              })}
          </div>
        </DialogContent>
      </Dialog>
      <Tabs defaultValue="adjust" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger value="adjust" className="flex-1 lg:flex-none">New Adjustment</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 lg:flex-none">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-sm font-medium whitespace-nowrap">Date:</Label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="flex-1 sm:w-40"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-sm font-medium whitespace-nowrap">Location:</Label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="flex-1 sm:w-56">
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
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setPendingAdjustments([]);
              setCurrentTransactionId(null);
              setReason('');
            }} disabled={isSubmitting}>
              Clear
            </Button>
            <Button variant="secondary" size="sm" onClick={() => submitAdjustments('DRAFT')} disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-1" />
              {currentTransactionId ? 'Update' : 'Hold'}
            </Button>
            <Button size="sm" onClick={() => submitAdjustments('COMPLETED')} disabled={isSubmitting}>
              <Check className="h-4 w-4 mr-1" />
              Submit
            </Button>
          </div>
        </div>

        <TabsContent value="adjust" className="space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search Products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <form onSubmit={handleBarcodeScan}>
                    <Input
                      placeholder="Quick Scan Barcode..."
                      value={barcodeQuery}
                      onChange={(e) => setBarcodeQuery(e.target.value)}
                      className="pl-9 border-primary/30 focus-visible:ring-primary"
                      autoFocus
                    />
                  </form>
                </div>

                <Dialog open={isDraftDialogOpen} onOpenChange={setIsDraftDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Open Draft
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Draft Adjustment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto mt-4">
                      {transactions
                        .filter(t => t.type === 'ADJUSTMENT' && t.status === 'DRAFT')
                        .map(draft => (
                          <div
                            key={draft.id}
                            className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors flex justify-between items-center"
                            onClick={() => loadDraft(draft)}
                          >
                            <div>
                              <p className="font-medium">{draft.journalNumber}</p>
                              <p className="text-sm text-muted-foreground">{draft.notes}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(draft.timestamp || '').toLocaleString()} • {draft.items?.length || 0} items
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">Select</Button>
                          </div>
                        ))
                      }
                      {transactions.filter(t => t.type === 'ADJUSTMENT' && t.status === 'DRAFT').length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                          No draft adjustments found
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search Results (List View) - only show if NOT showing all products */}
              {searchQuery && !showAllProducts && (
                <div className="mt-4 border rounded-lg max-h-64 overflow-y-auto">
                  {filteredProductsBySearch.slice(0, 10).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                          {product.images[0] ? (
                            <img src={`${getBaseUrl()}${product.images[0]}`} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-muted-foreground">Variants</p>
                          <p className="font-semibold text-sm">{product.variants.length}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {filteredProductsBySearch.length === 0 && (
                    <p className="p-4 text-center text-muted-foreground">No products found</p>
                  )}
                </div>
              )}

              {/* Show All Products Toggle */}
              <div className="mt-4 flex items-center justify-between">
                <Label className="text-sm font-medium">Show All Products</Label>
                <Button
                  variant={showAllProducts ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAllProducts(!showAllProducts)}
                >
                  {showAllProducts ? 'Hide Catalog' : 'Browse Catalog'}
                </Button>
              </div>

              {/* All Products Grid */}
              {showAllProducts && (
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1 max-h-[500px] overflow-y-auto">
                  {filteredProductsBySearch.flatMap(product =>
                    product.variants
                      .filter(v => v.isActive !== false)
                      .map(variant => ({ product, variant }))
                  ).map(({ product, variant }) => {
                    const currentStock = variant.locationStock[selectedLocationId] || 0;
                    const pending = pendingAdjustments.find(p => p.variantId === variant.id);
                    const adjustment = pending ? pending.adjustment : 0;
                    const newStock = currentStock + adjustment;

                    return (
                      <div key={variant.id} className="bg-card border rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
                        <div className="p-3 border-b bg-muted/30 group-hover:bg-muted/50 transition-colors">
                          <h4 className="font-medium text-sm line-clamp-1 mb-1" title={product.name}>{product.name}</h4>
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] bg-background px-1.5 py-0.5 rounded text-muted-foreground border shadow-sm">
                              {Object.values(variant.attributes).join(' / ') || 'Default'}
                            </span>
                            <span className="text-[10px] text-muted-foreground opacity-70">{variant.sku}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-card flex-1 flex flex-col justify-center">
                          <div className="grid grid-cols-3 gap-2 text-center mb-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                            <div>Current</div>
                            <div>Adj</div>
                            <div>New</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 items-center">
                            <div className="font-semibold text-sm">{currentStock}</div>
                            <div>
                              <Input
                                type="number"
                                className="h-8 w-full text-center px-1 text-sm font-medium"
                                placeholder="0"
                                value={adjustment === 0 ? '' : adjustment}
                                onChange={(e) => handleBulkAdjustment(product, variant, parseInt(e.target.value) || 0)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className={`font-bold text-sm ${adjustment !== 0 ? (newStock < 0 ? 'text-destructive' : 'text-primary') : ''}`}>
                              {newStock}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProductsBySearch.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg border-dashed">
                      <p>No products found matching your search</p>
                    </div>
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
                <div className="text-center py-12 flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">No items selected</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Search and select products to adjust their stock levels for {locations.find(l => l.id === selectedLocationId)?.name}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-lg divide-y">
                    {pendingAdjustments.map((item) => (
                      <div key={item.variantId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.productName}</p>
                          <p className="text-sm text-muted-foreground font-medium truncate">
                            {item.attributes && Object.keys(item.attributes).length > 0
                              ? Object.values(item.attributes).join(' / ')
                              : item.sku}
                          </p>
                          {item.attributes && Object.keys(item.attributes).length > 0 && (
                            <p className="text-[10px] text-muted-foreground uppercase">{item.sku}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between sm:justify-end">
                          <div className="text-center bg-muted/50 px-2 py-1 rounded">
                            <p className="text-[10px] uppercase text-muted-foreground">System</p>
                            <p className="text-sm font-semibold">{item.currentStock}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateAdjustment(item.variantId, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.adjustment}
                              onChange={(e) => setAdjustmentValue(item.variantId, parseInt(e.target.value) || 0)}
                              className="w-16 h-8 text-center px-1"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateAdjustment(item.variantId, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-center min-w-[50px]">
                            <p className="text-[10px] uppercase text-muted-foreground">Final</p>
                            <p className={`font-bold text-sm ${item.adjustment !== 0 ? (item.adjustment > 0 ? 'text-success' : 'text-destructive') : ''}`}>
                              {item.currentStock + item.adjustment}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromAdjustment(item.variantId)}
                            className="text-destructive h-8 px-2 hover:bg-destructive/10"
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
              <div className="overflow-x-auto border rounded-md">
                <table className="data-table min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="w-10"></th>
                      <th>Ref #</th>
                      <th>Date & Time</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentHistory.map((adj) => {
                      const isExpanded = expandedJournals.has(adj.id!);
                      const groupedItems = adj.items.reduce((acc, item) => {
                        if (!acc[item.productName]) acc[item.productName] = [];
                        acc[item.productName].push(item);
                        return acc;
                      }, {} as Record<string, any[]>);

                      return (
                        <Fragment key={adj.id}>
                          <tr
                            className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isExpanded && "bg-muted/30")}
                            onClick={() => toggleJournal(adj.id!)}
                          >
                            <td className="text-center">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </td>
                            <td className="font-mono text-sm font-semibold text-primary">{adj.journalNumber}</td>
                            <td className="text-sm">
                              {format(new Date(adj.timestamp), 'MMM d, yyyy HH:mm')}
                            </td>
                            <td className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                              {adj.notes}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-muted/5">
                              <td colSpan={4} className="p-0">
                                <div className="px-4 py-3 sm:px-14 sm:py-4 space-y-3">
                                  {Object.entries(groupedItems).map(([productName, variants]) => {
                                    const productKey = `${adj.id}-${productName}`;
                                    const isProductExpanded = expandedProducts.has(productKey);
                                    return (
                                      <div key={productName} className="border rounded-md overflow-hidden bg-white shadow-sm">
                                        <div
                                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleProduct(adj.id!, productName);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Package className="h-4 w-4 text-primary" />
                                            {productName}
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-2">
                                              {variants.length} items
                                            </Badge>
                                          </div>
                                          {isProductExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </div>
                                        {isProductExpanded && (
                                          <div className="border-t bg-muted/5 divide-y divide-dashed">
                                            {variants.map((v, idx) => (
                                              <div key={idx} className="flex justify-between px-4 sm:px-8 py-2 text-sm">
                                                <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                                                <Badge variant={v.adjustment > 0 ? 'default' : 'destructive'} className="h-4 text-[9px] px-1 font-bold">
                                                  {v.adjustment > 0 ? '+' : ''}{v.adjustment}
                                                </Badge>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
