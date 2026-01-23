import { useState, Fragment } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { StockTransfer as StockTransferType, ProductVariant } from '@/types/inventory';
import { Search, Plus, Minus, Check, History, Package, ArrowRight, Trash2, Send, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PendingTransferItem {
    variantId: string;
    productName: string;
    sku: string;
    sourceStock: number;
    quantity: number;
}

export default function StockTransfer() {
    const { products, locations, createTransfer, confirmTransfer, transactions } = useInventory();
    const { user } = useAuth();

    const transferHistory = transactions.filter(t => t.type === 'TRANSFER') as StockTransferType[];

    const [fromLocationId, setFromLocationId] = useState<string>(
        user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id
    );
    const [toLocationId, setToLocationId] = useState<string>(
        locations.find(l => l.id !== fromLocationId)?.id || ''
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [pendingItems, setPendingItems] = useState<PendingTransferItem[]>([]);
    const [notes, setNotes] = useState('');
    const [arrivalsLocationId, setArrivalsLocationId] = useState<string>(
        user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id
    );
    const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set());
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

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

    // Get all variants with product info (Active only)
    const allVariants = products
        .filter(product => product.isActive !== false)
        .flatMap(product =>
            product.variants
                .filter(variant => variant.isActive !== false)
                .map(variant => ({
                    ...variant,
                    productName: product.name,
                    category: product.category,
                    sourceStock: variant.locationStock[fromLocationId] || 0
                }))
        );

    // Filter variants for search
    const filteredVariants = allVariants.filter(variant =>
        variant.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        variant.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        variant.barcode.includes(searchQuery)
    );

    const addToTransfer = (variant: typeof allVariants[0]) => {
        if (pendingItems.find(p => p.variantId === variant.id)) {
            toast.error('Item already in transfer list');
            return;
        }
        setPendingItems(prev => [...prev, {
            variantId: variant.id,
            productName: variant.productName,
            sku: variant.sku,
            sourceStock: variant.sourceStock,
            quantity: 1
        }]);
        setSearchQuery('');
    };

    const updateQuantity = (variantId: string, delta: number) => {
        setPendingItems(prev => prev.map(item => {
            if (item.variantId === variantId) {
                const newQuantity = item.quantity + delta;
                if (newQuantity <= 0) return item;
                if (newQuantity > item.sourceStock) {
                    toast.error('Cannot transfer more than available stock');
                    return item;
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const setQuantityValue = (variantId: string, value: number) => {
        setPendingItems(prev => prev.map(item => {
            if (item.variantId === variantId) {
                if (value > item.sourceStock) {
                    toast.error('Cannot transfer more than available stock');
                    return item;
                }
                return { ...item, quantity: Math.max(0, value) };
            }
            return item;
        }));
    };

    const removeFromTransfer = (variantId: string) => {
        setPendingItems(prev => prev.filter(item => item.variantId !== variantId));
    };

    const submitTransfer = async () => {
        if (!toLocationId) {
            toast.error('Please select a destination location');
            return;
        }
        if (fromLocationId === toLocationId) {
            toast.error('Source and destination cannot be the same');
            return;
        }
        if (pendingItems.length === 0) {
            toast.error('No items to transfer');
            return;
        }

        try {
            await createTransfer({
                fromLocationId,
                toLocationId,
                notes,
                items: pendingItems.map(item => ({
                    variantId: item.variantId,
                    productName: item.productName,
                    sku: item.sku,
                    adjustment: item.quantity // In transfers, adjustment is the amount to move
                }))
            });

            setPendingItems([]);
            setNotes('');
        } catch (error) {
            // Error handled by context
        }
    };

    return (
        <AppLayout title="Stock Transfer">
            <Tabs defaultValue="new" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="new">New Transfer</TabsTrigger>
                    <TabsTrigger value="arrivals" className="relative">
                        Incoming
                        {transferHistory.filter(t => t.toLocationId === arrivalsLocationId && t.status === 'PENDING').length > 0 && (
                            <Badge className="ml-2 px-1.5 py-0 h-5 bg-primary text-[10px]">
                                {transferHistory.filter(t => t.toLocationId === arrivalsLocationId && t.status === 'PENDING').length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history">
                        <History className="h-4 w-4 mr-2" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="new" className="space-y-6">
                    {/* Location Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Location Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                <div className="space-y-2">
                                    <Label>Source Location</Label>
                                    <Select value={fromLocationId} onValueChange={(val) => {
                                        setFromLocationId(val);
                                        setPendingItems([]); // Clear because stock levels change
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map(loc => (
                                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex justify-center pt-6">
                                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Destination Location</Label>
                                    <Select value={toLocationId} onValueChange={setToLocationId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select destination" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map(loc => (
                                                <SelectItem key={loc.id} value={loc.id} disabled={loc.id === fromLocationId}>
                                                    {loc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Search */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Add Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search products by name, SKU, or barcode..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {searchQuery && (
                                <div className="mt-4 border rounded-lg max-h-64 overflow-y-auto">
                                    {filteredVariants.slice(0, 10).map((variant) => (
                                        <div
                                            key={variant.id}
                                            className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                                            onClick={() => addToTransfer(variant)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                                    <Package className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{variant.productName}</p>
                                                    <p className="text-xs text-muted-foreground">{variant.sku}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase text-muted-foreground">Source Stock</p>
                                                    <p className="font-semibold">{variant.sourceStock}</p>
                                                </div>
                                                <Button size="sm" variant="outline">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Items to Transfer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {pendingItems.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Add products to the list to start the transfer
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border rounded-lg divide-y">
                                        {pendingItems.map((item) => (
                                            <div key={item.variantId} className="flex items-center justify-between p-4">
                                                <div className="flex-1">
                                                    <p className="font-medium">{item.productName}</p>
                                                    <p className="text-sm text-muted-foreground">{item.sku}</p>
                                                </div>
                                                <div className="flex items-center gap-8">
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Avail.</p>
                                                        <p className="font-semibold">{item.sourceStock}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => updateQuantity(item.variantId, -1)}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => setQuantityValue(item.variantId, parseInt(e.target.value) || 0)}
                                                            className="w-16 h-8 text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => updateQuantity(item.variantId, 1)}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeFromTransfer(item.variantId)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Transfer Notes</Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="Optional notes about this transfer..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-4">
                                        <Button variant="outline" onClick={() => setPendingItems([])}>
                                            Clear All
                                        </Button>
                                        <Button onClick={submitTransfer} className="bg-primary text-primary-foreground">
                                            <Send className="h-4 w-4 mr-2" />
                                            Complete Transfer
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="arrivals" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Incoming Shipments</CardTitle>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-medium">Viewing for:</Label>
                                <Select value={arrivalsLocationId} onValueChange={setArrivalsLocationId}>
                                    <SelectTrigger className="w-48 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr className="text-left">
                                            <th className="w-10"></th>
                                            <th className="p-3">Journal #</th>
                                            <th className="p-3">From</th>
                                            <th className="p-3">Note</th>
                                            <th className="p-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {transferHistory
                                            .filter(t => t.toLocationId === arrivalsLocationId && t.status === 'PENDING')
                                            .map((tr) => {
                                                const isExpanded = expandedJournals.has(tr.id!);
                                                const groupedItems = tr.items.reduce((acc, item) => {
                                                    if (!acc[item.productName]) acc[item.productName] = [];
                                                    acc[item.productName].push(item);
                                                    return acc;
                                                }, {} as Record<string, any[]>);

                                                return (
                                                    <Fragment key={tr.id}>
                                                        <tr
                                                            className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isExpanded && "bg-muted/30")}
                                                            onClick={() => toggleJournal(tr.id!)}
                                                        >
                                                            <td className="text-center">
                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            </td>
                                                            <td className="p-3 font-mono font-bold text-primary">{tr.journalNumber}</td>
                                                            <td className="p-3">
                                                                <Badge variant="outline" className="bg-muted text-foreground border-muted-foreground/20">
                                                                    {locations.find(l => l.id === tr.fromLocationId)?.name}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-3 text-xs text-muted-foreground truncate max-w-[150px]">
                                                                {tr.notes || '---'}
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        confirmTransfer(tr.id!);
                                                                    }}
                                                                    className="bg-primary hover:bg-primary/90 h-7 text-xs"
                                                                >
                                                                    <Check className="h-3.5 w-3.5 mr-1" />
                                                                    Confirm Receipt
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-muted/5">
                                                                <td colSpan={5} className="p-0">
                                                                    <div className="px-12 py-3 space-y-2">
                                                                        {Object.entries(groupedItems).map(([productName, variants]) => {
                                                                            const productKey = `${tr.id}-${productName}`;
                                                                            const isProductExpanded = expandedProducts.has(productKey);
                                                                            return (
                                                                                <div key={productName} className="border rounded-md overflow-hidden bg-white shadow-sm">
                                                                                    <div
                                                                                        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            toggleProduct(tr.id!, productName);
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                                                                                            <Package className="h-3.5 w-3.5 text-primary" />
                                                                                            {productName}
                                                                                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-2">
                                                                                                {variants.length} items
                                                                                            </Badge>
                                                                                        </div>
                                                                                        {isProductExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                                    </div>
                                                                                    {isProductExpanded && (
                                                                                        <div className="border-t bg-muted/5 divide-y divide-dashed">
                                                                                            {variants.map((v, idx) => (
                                                                                                <div key={idx} className="flex justify-between px-8 py-2 text-sm">
                                                                                                    <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                                                                                                    <span className="font-bold">{v.adjustment} units</span>
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
                                {transferHistory.filter(t => t.toLocationId === arrivalsLocationId && t.status === 'PENDING').length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No pending arrivals for {locations.find(l => l.id === arrivalsLocationId)?.name}.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Transfer History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="w-10"></th>
                                        <th>Ref #</th>
                                        <th>Date</th>
                                        <th>Route</th>
                                        <th>Status</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transferHistory.map((tr) => {
                                        const isExpanded = expandedJournals.has(tr.id!);
                                        const groupedItems = tr.items.reduce((acc, item) => {
                                            if (!acc[item.productName]) acc[item.productName] = [];
                                            acc[item.productName].push(item);
                                            return acc;
                                        }, {} as Record<string, any[]>);

                                        return (
                                            <Fragment key={tr.id}>
                                                <tr
                                                    className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isExpanded && "bg-muted/30")}
                                                    onClick={() => toggleJournal(tr.id!)}
                                                >
                                                    <td className="text-center">
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </td>
                                                    <td className="font-mono text-sm font-semibold text-primary">{tr.journalNumber}</td>
                                                    <td className="text-sm">
                                                        {format(new Date(tr.timestamp), 'MMM d, yyyy HH:mm')}
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center gap-2 text-xs font-medium">
                                                            <span>{locations.find(l => l.id === tr.fromLocationId)?.name}</span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                            <span>{locations.find(l => l.id === tr.toLocationId)?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "capitalize text-[10px]",
                                                                tr.status === 'RECEIVED' ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                                                            )}
                                                        >
                                                            {tr.status.toLowerCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-sm text-muted-foreground truncate max-w-[150px]">
                                                        {tr.notes || '---'}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-muted/5">
                                                        <td colSpan={6} className="p-0">
                                                            <div className="px-14 py-4 space-y-3">
                                                                {Object.entries(groupedItems).map(([productName, variants]) => {
                                                                    const productKey = `${tr.id}-${productName}`;
                                                                    const isProductExpanded = expandedProducts.has(productKey);
                                                                    return (
                                                                        <div key={productName} className="border rounded-md overflow-hidden bg-white shadow-sm">
                                                                            <div
                                                                                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleProduct(tr.id!, productName);
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
                                                                                        <div key={idx} className="flex justify-between px-8 py-2 text-sm">
                                                                                            <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                                                                                            <span className="font-bold">{v.adjustment} units</span>
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
                            {transferHistory.length === 0 && (
                                <p className="text-center py-12 text-muted-foreground">No transfer history found</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
