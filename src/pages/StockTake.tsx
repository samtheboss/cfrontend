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
        ((user?.locationId === 'all' ? null : user?.locationId) || locations.find(l => l.isMain)?.id || locations[0]?.id || '').toString()
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
            const userLoc = user?.locationId === 'all' ? null : user?.locationId;
            const locId = userLoc || locations.find(l => l.isMain)?.id || locations[0]?.id;
            if (locId) {
                setSelectedLocationId(locId.toString());
            }
        }
    }, [locations, selectedLocationId, user]);

    useEffect(() => {
        if (stockTakeItems.length > 0 && selectedLocationId) {
            setStockTakeItems(prev => prev.map(item => {
                const product = products.find(p => p.variants.some(v => v.id.toString() === item.variantId.toString()));
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
                            cost: variant.cost,
                            price: variant.price,
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

        // Map transaction items back to stock take items, refreshing details from current products
        const draftItems: StockTakeItem[] = (draft.items || []).map(item => {
            const prod = products.find(p => p.variants.some(v => v.id.toString() === item.variantId?.toString()))
                || products.find(p => p.name === item.productName);
            const variant = prod?.variants.find(v => v.id.toString() === item.variantId?.toString());

            const currentSystemStock = variant ? (variant.locationStock[locId] || 0) : (item.quantityBefore || 0);

            return {
                variantId: item.variantId!.toString(),
                variantSku: variant?.sku ?? item.sku!,
                productName: prod?.name ?? item.productName!,
                systemStock: currentSystemStock,
                countedStock: item.quantityAfter || 0,
                variance: (item.quantityAfter || 0) - currentSystemStock,
                cost: variant?.cost,
                price: variant?.price,
                unit: prod?.unit || 'PCS',
                attributes: variant?.attributes
            };
        });

        // Add active products/variants created since the draft was held
        const existingIds = new Set(draftItems.map(i => i.variantId.toString()));
        products
            .filter(p => p.isActive !== false)
            .forEach(product => {
                product.variants
                    .filter(v => v.isActive !== false && !existingIds.has(v.id.toString()))
                    .forEach(variant => {
                        draftItems.push({
                            variantId: variant.id,
                            productName: product.name,
                            variantSku: variant.sku,
                            systemStock: variant.locationStock[locId] || 0,
                            countedStock: 0,
                            variance: 0,
                            cost: variant.cost,
                            price: variant.price,
                            unit: product.unit || 'PCS',
                            attributes: variant.attributes
                        });
                    });
            });

        setStockTakeItems(draftItems);
        const countedIds = new Set(draftItems.filter(i => i.countedStock !== 0).map(i => i.variantId));
        setCountedItems(countedIds);
        setIsCountingMode(true);
        setIsDraftDialogOpen(false);
        toast.info(`Loaded draft ${draft.journalNumber}`);
    };

    const submitStockTake = async (status: 'DRAFT' | 'COMPLETED' = 'COMPLETED', keepOpen = false) => {
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
                    adjustment: item.variance,
                    price: item.cost || item.price || 0
                }))
            };

            let savedId = currentTransactionId;
            if (currentTransactionId) {
                await updateTransaction(currentTransactionId, transactionData);
            } else {
                const saved = await applyStockTake(transactionData);
                savedId = saved?.id ? String(saved.id) : null;
            }

            if (keepOpen && status === 'DRAFT') {
                // Save only: stay in the journal so further edits update the same entry
                if (savedId) setCurrentTransactionId(savedId);
                else setIsCountingMode(false);
            } else {
                setIsCountingMode(false);
                setStockTakeItems([]);
                setCountedItems(new Set());
                setCurrentTransactionId(null);
            }
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
            <div className="container mx-auto py-3 pb-28 px-3 sm:px-4 max-w-7xl">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-xl font-bold tracking-tight truncate">
                        Stock Take &bull; <span className="text-primary">{locations.find(l => l.id.toString() === selectedLocationId)?.name || 'Select Location'}</span>
                    </h2>
                </div>

                {/* Progress Header Card */}
                <Card className="mb-3 rounded-xl shadow-none border">
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-3 flex-1">
                                <div>
                                    <h3 className="font-semibold text-xs sm:text-sm">Counting Progress</h3>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">{countedItems.size}</span> of {stockTakeItems.length} items counted ({Math.round(progress)}%)
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                    <div className="text-left">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5 block">Location</Label>
                                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                <Package className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                                                <SelectValue placeholder="Location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locations.map(loc => (
                                                    <SelectItem key={loc.id} value={loc.id.toString()} className="text-xs">{loc.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="text-left">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5 block">Date</Label>
                                        <Input
                                            type="date"
                                            value={transactionDate}
                                            onChange={(e) => setTransactionDate(e.target.value)}
                                            className="h-8 text-xs bg-background px-2"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Top action buttons (visible on desktop) */}
                            <div className="hidden xl:flex items-center gap-2">
                                {itemsWithVariance.length > 0 && (
                                    <Badge variant={totalVariance > 0 ? 'default' : 'destructive'} className="h-8 text-xs px-2.5">
                                        {itemsWithVariance.length} variances
                                    </Badge>
                                )}
                                <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => {
                                    cancelStockTake();
                                    setCurrentTransactionId(null);
                                }} disabled={isSubmitting}>Cancel</Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs px-3 font-medium border-primary/30 text-primary hover:bg-primary/10" onClick={() => submitStockTake('DRAFT', true)} disabled={isSubmitting}>
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    Save
                                </Button>
                                <Button variant="secondary" size="sm" className="h-8 text-xs px-3" onClick={() => submitStockTake('DRAFT')} disabled={isSubmitting}>
                                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                                    Hold
                                </Button>
                                <Button onClick={() => submitStockTake('COMPLETED')} size="sm" className="h-8 text-xs px-3.5 font-semibold bg-primary shadow-xs" disabled={countedItems.size === 0 || isSubmitting}>
                                    <Check className="h-3.5 w-3.5 mr-1.5" />
                                    Complete
                                </Button>
                            </div>
                        </div>
                        <Progress value={progress} className="h-1.5 rounded-full" />
                    </CardContent>
                </Card>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search products or SKUs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-background"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-48">
                            <Barcode className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <form onSubmit={handleBarcodeScan}>
                                <Input
                                    placeholder="Scan barcode..."
                                    value={barcodeQuery}
                                    onChange={(e) => setBarcodeQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs bg-background border-primary/30"
                                />
                            </form>
                        </div>

                        <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-8 text-xs px-2.5 justify-start gap-1.5 shrink-0 min-w-[120px] bg-background">
                                    <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    {selectedCategories.size === 0 ? (
                                        <span className="text-muted-foreground truncate">All Categories</span>
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
                            <PopoverContent className="w-56 p-0" align="end">
                                <Command>
                                    <CommandInput placeholder="Search categories..." className="h-8 text-xs" />
                                    <CommandList>
                                        <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">No categories found.</CommandEmpty>
                                        <CommandGroup>
                                            {availableCategories.map(cat => (
                                                <CommandItem
                                                    key={cat}
                                                    value={cat}
                                                    onSelect={() => toggleCategory(cat)}
                                                    className="gap-2 text-xs"
                                                >
                                                    <Checkbox
                                                        checked={selectedCategories.has(cat)}
                                                        className="pointer-events-none"
                                                    />
                                                    <span className="truncate">{cat}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Items Grid */}
                <div className="space-y-2">
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
                                'overflow-hidden transition-all border-l-4 rounded-xl shadow-xs',
                                allCounted ? 'border-l-success' : someCounted ? 'border-l-warning' : 'border-l-muted'
                            )}>
                                <div
                                    className="p-2.5 sm:p-3 cursor-pointer hover:bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    onClick={toggleExpand}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="font-semibold text-xs sm:text-sm truncate">{productName}</h3>
                                                {hasAnyVariance && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning-foreground border-warning/20 shrink-0">
                                                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Var
                                                    </Badge>
                                                )}
                                                {allCounted && !hasAnyVariance && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success-foreground border-success/20 shrink-0">
                                                        <Check className="h-2.5 w-2.5 mr-0.5" /> Done
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                                                {productItems.length} var &bull; {productItems.filter(i => countedItems.has(i.variantId)).length}/{productItems.length} counted &bull; Stock: <span className="font-mono font-medium">{productItems.reduce((sum, item) => sum + item.systemStock, 0).toFixed(2)}</span> {productItems[0]?.unit}
                                            </p>
                                        </div>
                                        <div className="sm:hidden shrink-0">
                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    </div>

                                    {/* Right Section: Single-variant quick count & expand toggle */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-0 border-border/40">
                                        {productItems.length === 1 && (
                                            <div className="flex items-center gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase sm:hidden">Count:</span>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="any"
                                                    min="0"
                                                    value={productItems[0].countedStock || ''}
                                                    onChange={(e) => updateCount(productItems[0].variantId, parseFloat(e.target.value) || 0)}
                                                    className="text-center h-8 w-full sm:w-24 font-bold text-xs sm:text-sm bg-background"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                        <div className="hidden sm:block">
                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <CardContent className="p-0 border-t bg-muted/10">
                                        <div className="divide-y divide-border/40">
                                            {productItems.map(item => {
                                                const isCounted = countedItems.has(item.variantId);
                                                return (
                                                    <div key={item.variantId} className="p-2.5 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs sm:text-sm font-semibold truncate">
                                                                {(item as any).attributes && Object.keys((item as any).attributes).length > 0
                                                                    ? Object.values((item as any).attributes).join(' / ')
                                                                    : item.variantSku}
                                                            </p>
                                                            {(item as any).attributes && Object.keys((item as any).attributes).length > 0 && (
                                                                <p className="text-[10px] text-muted-foreground font-mono">{item.variantSku}</p>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 items-center bg-background/80 p-1.5 sm:p-2 rounded-lg border border-border/50">
                                                            <div className="text-center">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">System</p>
                                                                <p className="font-bold text-xs sm:text-sm truncate">
                                                                    {item.systemStock.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-col items-center">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Count</p>
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    step="any"
                                                                    min="0"
                                                                    value={item.countedStock || ''}
                                                                    onChange={(e) => updateCount(item.variantId, parseFloat(e.target.value) || 0)}
                                                                    className="text-center h-8 w-full max-w-[85px] sm:max-w-[100px] font-bold text-xs sm:text-sm bg-background"
                                                                    placeholder="0"
                                                                />
                                                            </div>

                                                            <div className="text-center">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Variance</p>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <p className={cn(
                                                                        'font-bold text-xs sm:text-sm truncate',
                                                                        item.variance > 0 && 'text-emerald-600 dark:text-emerald-400',
                                                                        item.variance < 0 && 'text-rose-600 dark:text-rose-400',
                                                                        item.variance === 0 && isCounted && 'text-muted-foreground'
                                                                    )}>
                                                                        {item.variance > 0 ? '+' : ''}{isCounted ? item.variance.toFixed(2) : '-'}
                                                                    </p>
                                                                    {isCounted && (
                                                                        <div className={cn(
                                                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                                                            item.variance === 0 ? "bg-emerald-500" : "bg-amber-500"
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

                {/* Fixed Bottom Action Bar (The Action Tab) */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.12)] px-3 py-2 sm:px-6">
                    <div className="container mx-auto flex items-center justify-between gap-2 max-w-7xl">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-tight">Progress</span>
                                <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
                                    <span className="text-primary font-bold">{countedItems.size}</span>/{stockTakeItems.length}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0 bg-muted/60 font-semibold hidden xs:inline-flex">
                                {Math.round(progress)}%
                            </Badge>
                            {itemsWithVariance.length > 0 && (
                                <Badge variant={totalVariance > 0 ? 'default' : 'destructive'} className="text-[10px] sm:text-[11px] px-1.5 py-0 shrink-0 font-medium">
                                    {itemsWithVariance.length} var
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs px-2.5 sm:px-3 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    cancelStockTake();
                                    setCurrentTransactionId(null);
                                }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs px-3 sm:px-3.5 font-semibold text-primary border-primary/40 bg-background hover:bg-primary/10 shadow-xs"
                                onClick={() => submitStockTake('DRAFT', true)}
                                disabled={isSubmitting}
                            >
                                <Save className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                                <span>Save</span>
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 text-xs px-2.5 sm:px-3 font-medium"
                                onClick={() => submitStockTake('DRAFT')}
                                disabled={isSubmitting}
                            >
                                <FolderOpen className="h-3.5 w-3.5 sm:mr-1 text-muted-foreground shrink-0 hidden xs:inline" />
                                <span>Hold</span>
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 text-xs px-3 sm:px-4 font-semibold bg-primary text-primary-foreground shadow-sm"
                                onClick={() => submitStockTake('COMPLETED')}
                                disabled={countedItems.size === 0 || isSubmitting}
                            >
                                <Check className="h-3.5 w-3.5 sm:mr-1 shrink-0" />
                                <span>Complete</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
