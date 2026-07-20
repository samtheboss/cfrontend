import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { StockTakeItem, Location } from '@/types/inventory';
import { ClipboardList, Search, Check, AlertTriangle, Package, ChevronDown, ChevronRight, Barcode, Save, Filter, FolderOpen, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InventoryTransaction } from '@/types/inventory';

export default function StockTake() {
    const { products, locations, transactions, applyStockTake, updateTransaction } = useInventory();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState<string>(
        (user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id || '').toString()
    );
    const [isCountingMode, setIsCountingMode] = useState(false);
    const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
    const [countedItems, setCountedItems] = useState<Set<string>>(new Set());
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
    const [barcodeQuery, setBarcodeQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDraftDialogOpen, setIsDraftDialogOpen] = useState(false);
    const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
    const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedLocationId && locations.length > 0) {
            const locId = user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id;
            if (locId) {
                setSelectedLocationId(locId.toString());
            }
        }
    }, [locations, selectedLocationId, user]);

    useEffect(() => {
        if (stockTakeItems.length > 0 && selectedLocationId) {
            setStockTakeItems(prev => prev.map(item => {
                const product = products.find(p => p.name === item.productName);
                const variant = product?.variants.find(v => v.id.toString() === item.variantId.toString());
                if (variant) {
                    const newSystemStock = variant.locationStock[selectedLocationId] || 0;
                    const variance = countedItems.has(item.variantId) 
                        ? parseFloat((item.countedStock - newSystemStock).toFixed(3))
                        : 0;
                    return {
                        ...item,
                        systemStock: newSystemStock,
                        variance
                    };
                }
                return item;
            }));
        }
    }, [selectedLocationId, products, countedItems]);

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
                            variance: 0,
                            unit: product.unit || 'PCS',
                            attributes: variant.attributes
                        };
                    })
            );
        setStockTakeItems(items);
        setCountedItems(new Set());
        setExpandedProducts(new Set());
        setIdempotencyKey(`st-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        setIsCountingMode(true);
        toast.success('Stock take started');
    };

    const updateCount = (variantId: string, count: number) => {
        setStockTakeItems(prev => prev.map(item => {
            if (item.variantId === variantId) {
                const variance = parseFloat((count - item.systemStock).toFixed(3));
                return { ...item, countedStock: count, variance };
            }
            return item;
        }));
        setCountedItems(prev => new Set([...prev, variantId]));
    };

    const handleBarcodeScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcodeQuery.trim()) return;

        const item = stockTakeItems.find(i => i.variantSku === barcodeQuery.trim());
        if (item) {
            // Find the product name to expand it
            setExpandedProducts(prev => new Set([...prev, item.productName]));
            setSearchQuery(item.productName); // Filter to see it
            setBarcodeQuery('');
            toast.success(`Found ${item.productName}`);

            // Auto-focus the input would be nice, but we need a ref or ID-based focus
            // For now, highlighting is enough via search filter
        } else {
            toast.error('Product not in stock take list');
        }
    };

    // Derive unique category list from stock take items
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        stockTakeItems.forEach(i => {
            const p = products.find(prod => prod.name === i.productName);
            if (p?.category) cats.add(p.category.trim());
        });
        return Array.from(cats).sort();
    }, [stockTakeItems, products]);

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const filteredItems = stockTakeItems.filter(item => {
        const matchesSearch = item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.variantSku.toLowerCase().includes(searchQuery.toLowerCase());

        const product = products.find(p => p.name === item.productName);
        const matchesCategory = selectedCategories.size === 0 || (product && selectedCategories.has(product.category.trim()));

        return matchesSearch && matchesCategory;
    });

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

    const filteredGroupNames = Object.keys(groupedItems).filter(name => {
        const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            groupedItems[name].some(v => v.variantSku.toLowerCase().includes(searchQuery.toLowerCase()));

        const product = products.find(p => p.name === name);
        const matchesCategory = selectedCategories.size === 0 || (product && selectedCategories.has(product.category.trim()));

        return matchesSearch && matchesCategory;
    });

    const totalVariance = itemsWithVariance.reduce((sum, item) => sum + item.variance, 0);

    const loadDraft = (draft: InventoryTransaction) => {
        console.log('Loading draft:', draft);
        setCurrentTransactionId(draft.id || null);

        // Ensure locationId is a string for comparison with Select values
        // Fallback: If locationId is missing, try to recover it from the notes
        let recoveredLocId = draft.locationId;
        if (!recoveredLocId && draft.notes) {
            console.log('LocationId missing, attempting to recover from notes:', draft.notes);
            const locName = draft.notes.includes(' at ') ? draft.notes.split(' at ').pop() : null;
            if (locName) {
                const foundLoc = locations.find(l => l.name === locName);
                if (foundLoc) {
                    recoveredLocId = foundLoc.id;
                    console.log('Recovered locationId from notes:', recoveredLocId, foundLoc.name);
                }
            }
        }

        const locId = String(recoveredLocId || locations[0]?.id || '');
        console.log('Final locId to be used:', locId);
        setSelectedLocationId(locId);

        // Load the transaction date from the draft
        if (draft.timestamp) {
            const draftDate = new Date(draft.timestamp).toISOString().split('T')[0];
            setTransactionDate(draftDate);
        }

        // Map transaction items back to stock take items, refreshing systemStock from products
        const draftItems: StockTakeItem[] = (draft.items || []).map(item => {
            const prod = products.find(p => p.name === item.productName);
            const variant = prod?.variants.find(v => v.id.toString() === item.variantId?.toString());

            const currentSystemStock = variant ? (variant.locationStock[locId] || 0) : (item.quantityBefore || 0);

            return {
                variantId: item.variantId!.toString(),
                variantSku: item.sku!,
                productName: item.productName!,
                systemStock: currentSystemStock,
                countedStock: item.quantityAfter || 0,
                variance: (item.quantityAfter || 0) - currentSystemStock,
                unit: 'pcs',
                attributes: variant?.attributes
            };
        });

        setStockTakeItems(draftItems);
        const countedIds = new Set(draftItems.filter(i => i.countedStock !== 0).map(i => i.variantId));
        setCountedItems(countedIds);
        setIsCountingMode(true);
        setIsDraftDialogOpen(false);
        toast.info(`Loaded draft ${draft.journalNumber}`);
    };

    const submitStockTake = async (status: 'DRAFT' | 'COMPLETED' = 'COMPLETED') => {
        const countedItemsList = status === 'DRAFT' ? stockTakeItems : stockTakeItems.filter(item => countedItems.has(item.variantId));

        if (status === 'COMPLETED' && countedItemsList.length === 0) {
            toast.info('No items counted yet');
            return;
        }

        setIsSubmitting(true);
        try {
            const transactionData = {
                type: 'STOCK_TAKE' as const,
                locationId: selectedLocationId,
                status: status,
                timestamp: new Date(transactionDate + 'T00:00:00').toISOString(),
                notes: status === 'DRAFT' ? `Draft stock take at ${locations.find(l => l.id.toString() === selectedLocationId)?.name}` : `Physical inventory count at ${locations.find(l => l.id.toString() === selectedLocationId)?.name}`,
                idempotencyKey: idempotencyKey,
                items: countedItemsList.map(item => ({
                    variantId: item.variantId,
                    sku: item.variantSku,
                    productName: item.productName,
                    quantityBefore: item.systemStock,
                    quantityAfter: item.countedStock,
                    adjustment: item.variance
                }))
            };

            if (currentTransactionId) {
                await updateTransaction(currentTransactionId, transactionData);
            } else {
                await applyStockTake(transactionData);
            }

            setIsCountingMode(false);
            setStockTakeItems([]);
            setCountedItems(new Set());
            setCurrentTransactionId(null);
        } catch (error) {
            // Error handled by context
        } finally {
            setIsSubmitting(false);
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
                    <div className='flex flex-col sm:flex-row items-end justify-center gap-4 mb-8'>
                        <div className="w-full sm:w-48 text-left">
                            <Label className="mb-2 block">Select location to count:</Label>
                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                <SelectTrigger>
                                    <Package className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-48 text-left">
                            <Label className="mb-2 block">Transaction Date:</Label>
                            <Input
                                type="date"
                                value={transactionDate}
                                onChange={(e) => setTransactionDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button size="lg" onClick={startStockTake} className="w-full sm:w-auto">
                            Start Stock Take
                        </Button>

                        <Dialog open={isDraftDialogOpen} onOpenChange={setIsDraftDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                                    <FolderOpen className="h-4 w-4" />
                                    Resume Draft
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl w-[95vw]">
                                <DialogHeader>
                                    <DialogTitle>Select Draft Stock Take</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto mt-4">
                                    {transactions
                                        .filter(t => t.type === 'STOCK_TAKE' && t.status === 'DRAFT')
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
                                    {transactions.filter(t => t.type === 'STOCK_TAKE' && t.status === 'DRAFT').length === 0 && (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No draft stock takes found
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Stock Take">
            <div className="container mx-auto py-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Stock Take - {locations.find(l => l.id.toString() === selectedLocationId)?.name || 'Select Location'}</h2>
                </div>

                {/* Progress Header */}
                <Card className="mb-4">
                    <CardContent className="p-4">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-3">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div>
                                    <h3 className="font-semibold">Counting Progress</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {countedItems.size} of {stockTakeItems.length} items counted
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
                                    <div className="w-full sm:w-40 text-left">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Location</Label>
                                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                            <SelectTrigger className="h-9">
                                                <Package className="h-3 w-3 mr-1" />
                                                <SelectValue placeholder="Location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locations.map(loc => (
                                                    <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-full sm:w-36 text-left">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Date</Label>
                                        <Input
                                            type="date"
                                            value={transactionDate}
                                            onChange={(e) => setTransactionDate(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                {itemsWithVariance.length > 0 && (
                                    <Badge variant={totalVariance > 0 ? 'default' : 'destructive'} className="h-9 px-3">
                                        {itemsWithVariance.length} variances
                                    </Badge>
                                )}
                                <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9" onClick={() => {
                                    cancelStockTake();
                                    setCurrentTransactionId(null);
                                }} disabled={isSubmitting}>Cancel</Button>
                                <Button variant="secondary" size="sm" className="flex-1 sm:flex-none h-9" onClick={() => submitStockTake('DRAFT')} disabled={isSubmitting}>
                                    <Save className="h-4 w-4 mr-1 sm:mr-2" />
                                    Hold
                                </Button>
                                <Button onClick={() => submitStockTake('COMPLETED')} size="sm" className="w-full sm:w-auto h-9" disabled={countedItems.size === 0 || isSubmitting}>
                                    <Check className="h-4 w-4 mr-2" />
                                    Complete
                                </Button>
                            </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </CardContent>
                </Card>

                {/* Search & Filter */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search products or SKUs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="relative flex-1 min-w-[200px]">
                        <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <form onSubmit={handleBarcodeScan}>
                            <Input
                                placeholder="Scan Barcode..."
                                value={barcodeQuery}
                                onChange={(e) => setBarcodeQuery(e.target.value)}
                                className="pl-9 border-primary/30"
                            />
                        </form>
                    </div>

                    <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-48 justify-start gap-2">
                                <Filter className="h-4 w-4 shrink-0" />
                                {selectedCategories.size === 0 ? (
                                    <span className="text-muted-foreground">All Categories</span>
                                ) : (
                                    <span className="truncate">{selectedCategories.size} selected</span>
                                )}
                                {selectedCategories.size > 0 && (
                                    <span
                                        role="button"
                                        className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-muted"
                                        onClick={(e) => { e.stopPropagation(); setSelectedCategories(new Set()); }}
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search categories..." />
                                <CommandList>
                                    <CommandEmpty>No categories found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableCategories.map(cat => (
                                            <CommandItem
                                                key={cat}
                                                value={cat}
                                                onSelect={() => toggleCategory(cat)}
                                                className="gap-2"
                                            >
                                                <Checkbox
                                                    checked={selectedCategories.has(cat)}
                                                    className="pointer-events-none"
                                                />
                                                <span>{cat}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Items Grid */}
                <div className="space-y-3">
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
                                    className="p-3 cursor-pointer hover:bg-muted/30 flex items-center justify-between"
                                    onClick={toggleExpand}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                            <Package className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{productName}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {productItems.length} variant{productItems.length !== 1 ? 's' : ''} • 
                                                {' '}{productItems.filter(i => countedItems.has(i.variantId)).length} counted • 
                                                {' '}Stock: {productItems.reduce((sum, item) => sum + item.systemStock, 0).toFixed(3)} {productItems[0]?.unit}
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
                                                    <div key={item.variantId} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-semibold">
                                                                {(item as any).attributes && Object.keys((item as any).attributes).length > 0
                                                                    ? Object.values((item as any).attributes).join(' / ')
                                                                    : item.variantSku}
                                                            </p>
                                                            {(item as any).attributes && Object.keys((item as any).attributes).length > 0 && (
                                                                <p className="text-[10px] text-muted-foreground uppercase">{item.variantSku}</p>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-6 sm:gap-10">
                                                            <div className="text-center bg-muted/50 px-2 py-1 rounded min-w-[60px]">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">System</p>
                                                                <p className="font-bold text-sm">{item.systemStock.toFixed(3)} <span className="text-[10px] font-normal">{item.unit}</span></p>
                                                            </div>

                                                            <div className="flex flex-col items-center">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Physical Count</p>
                                                                <Input
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    value={item.countedStock || ''}
                                                                    onChange={(e) => updateCount(item.variantId, parseFloat(e.target.value) || 0)}
                                                                    className="text-center h-9 w-24 font-bold"
                                                                    placeholder="0.000"
                                                                />
                                                            </div>

                                                            <div className="text-right flex flex-col items-end min-w-[70px]">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Variance</p>
                                                                <div className="flex items-center gap-2">
                                                                    <p className={cn(
                                                                        'font-bold text-base',
                                                                        item.variance > 0 && 'text-success',
                                                                        item.variance < 0 && 'text-destructive',
                                                                        item.variance === 0 && isCounted && 'text-muted-foreground'
                                                                    )}>
                                                                        {item.variance > 0 ? '+' : ''}{isCounted ? item.variance.toFixed(3) : '-'} <span className="text-[10px] font-normal">{item.unit}</span>
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
            </div>
        </AppLayout >
    );
}
