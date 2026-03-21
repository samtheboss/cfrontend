import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Promotion, Product, ProductVariant } from '@/types/inventory';
import {
    Plus,
    Search,
    Trash2,
    Calendar,
    Tag,
    Percent,
    DollarSign,
    AlertCircle,
    Package,
    CheckCircle2,
    Pencil,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Promotions() {
    const { products, promotions, categories, addPromotion, addBulkPromotions, updatePromotion, updateBulkPromotions, deletePromotion, deleteBulkPromotions } = useInventory();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const [newPromotion, setNewPromotion] = useState<Partial<Promotion>>({
        productId: '',
        variantId: '',
        discountType: 'FIXED_PRICE',
        discountValue: 0,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        isActive: true
    });

    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.category.toLowerCase().includes(productSearch.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const displayProducts = filteredProducts.slice(0, 5);

    const handleProductSelect = (product: Product) => {
        if (selectedProducts.find(p => p.id === product.id)) {
            setProductSearch('');
            return;
        }
        setSelectedProducts(prev => [...prev, product]);
        setProductSearch('');
    };

    const handleSelectAllFiltered = () => {
        const toAdd = filteredProducts
            .filter(p => !selectedProducts.find(sp => sp.id === p.id))
            .slice(0, 50); // Limit to 50 at a time to prevent UI lag

        if (toAdd.length > 0) {
            setSelectedProducts(prev => [...prev, ...toAdd]);
        }
        setProductSearch('');
    };

    const removeProduct = (productId: string | number) => {
        setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const handleCreatePromotion = async () => {
        if (selectedProducts.length === 0 || !newPromotion.discountValue) return;

        const bulkData = selectedProducts.map(product => ({
            ...newPromotion,
            productId: product.id,
            // Use the specific variant if it was selected during the flow (handled by a new state or just current one if single)
            variantId: product.id === selectedProducts[0].id ? newPromotion.variantId : '',
            startDate: `${newPromotion.startDate}T00:00:00`,
            endDate: `${newPromotion.endDate}T23:59:59`
        }));

        await addBulkPromotions(bulkData);

        setIsAddDialogOpen(false);
        resetForm();
    };

    const handleEditClick = (promo: Promotion) => {
        setEditingPromotion(promo);
        setIsEditDialogOpen(true);
    };

    const handleUpdatePromotion = async () => {
        if (!editingPromotion) return;

        // Find all promotions that belong to the same campaign (group)
        const originalPromo = promotions.find(p => p.id === editingPromotion.id);
        if (!originalPromo) return;

        const campaignItems = promotions.filter(p =>
            p.description === originalPromo.description &&
            p.startDate === originalPromo.startDate &&
            p.endDate === originalPromo.endDate &&
            p.discountValue === originalPromo.discountValue &&
            p.discountType === originalPromo.discountType
        );

        // Map updates to all items in the campaign
        const updatedPromotions = campaignItems.map(p => ({
            ...p,
            discountType: editingPromotion.discountType,
            discountValue: editingPromotion.discountValue,
            startDate: editingPromotion.startDate.toString().includes('T') ? editingPromotion.startDate : `${editingPromotion.startDate}T00:00:00`,
            endDate: editingPromotion.endDate.toString().includes('T') ? editingPromotion.endDate : `${editingPromotion.endDate}T23:59:59`,
            description: editingPromotion.description,
            isActive: editingPromotion.isActive
        }));

        await updateBulkPromotions(updatedPromotions as Promotion[]);
        setIsEditDialogOpen(false);
    };

    const resetForm = () => {
        setNewPromotion({
            productId: '',
            variantId: '',
            discountType: 'FIXED_PRICE',
            discountValue: 0,
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
            description: '',
            isActive: true
        });
        setSelectedProducts([]);
        setProductSearch('');
    };

    const getProductName = (productId: string | number) => {
        return products.find(p => p.id.toString() === productId.toString())?.name || 'Unknown Product';
    };

    const getVariantName = (productId: string | number, variantId?: string | number) => {
        if (!variantId) return 'All Variants';
        const product = products.find(p => p.id.toString() === productId.toString());
        const variant = product?.variants.find(v => v.id.toString() === variantId.toString());
        if (!variant) return 'Unknown Variant';
        return Object.values(variant.attributes).join(' / ') || variant.sku;
    };

    const getProductPrice = (productId: string | number) => {
        const product = products.find(p => p.id.toString() === productId.toString());
        return product?.variants[0]?.price || 0;
    };

    const filteredPromotions = promotions.filter(p =>
        getProductName(p.productId).toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group promotions by Campaign (Description + Dates + Value)
    const groupedPromotions = filteredPromotions.reduce((acc: any[], current) => {
        const groupKey = `${current.description}-${current.startDate}-${current.endDate}-${current.discountType}-${current.discountValue}`;
        const existingGroup = acc.find(g => g.groupKey === groupKey);

        if (existingGroup) {
            existingGroup.items.push(current);
        } else {
            acc.push({
                groupKey,
                description: current.description,
                startDate: current.startDate,
                endDate: current.endDate,
                discountType: current.discountType,
                discountValue: current.discountValue,
                active: current.active,
                isActive: current.isActive,
                items: [current]
            });
        }
        return acc;
    }, []);

    return (
        <AppLayout title="Promotions">
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search promotions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            New Promotion
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Promotion</DialogTitle>
                            <DialogDescription>
                                Set a promotional price or discount for one or more products.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="category-filter">Category Filter</Label>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger id="category-filter">
                                            <SelectValue placeholder="All Categories" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Categories</SelectItem>
                                            {categories.map(c => (
                                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="product">Search Products</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="product"
                                            placeholder="Type..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                </div>
                            </div>
                            {productSearch && (
                                <div className="absolute top-[180px] left-0 right-0 z-50 bg-popover border rounded-md shadow-lg mt-1 overflow-hidden">
                                    <div className="p-1 border-b bg-muted/30 flex justify-between items-center px-3">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Results ({filteredProducts.length})</span>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleSelectAllFiltered}>
                                            Add All {filteredProducts.length > 50 ? '50' : filteredProducts.length}
                                        </Button>
                                    </div>
                                    <div className="max-h-[250px] overflow-y-auto">
                                        {displayProducts.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between gap-2"
                                                onClick={() => handleProductSelect(p)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">{p.name}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                    {filteredProducts.length === 0 && (
                                        <div className="p-3 text-sm text-center text-muted-foreground">No products found</div>
                                    )}
                                </div>
                            )}

                            {selectedProducts.length > 0 && (
                                <div className="grid gap-2 border rounded-md p-3 bg-muted/20">
                                    <div className="flex justify-between items-center mb-1">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Items in this Promotion ({selectedProducts.length})</Label>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setSelectedProducts([])}>
                                            Clear All
                                        </Button>
                                    </div>
                                    <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                                        {selectedProducts.map(p => (
                                            <div key={p.id} className="flex items-center justify-between bg-background p-2 rounded border shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium leading-none">{p.name}</span>
                                                    <span className="text-[10px] text-muted-foreground mt-1">{p.category}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {p.variants.length > 0 && (
                                                        <Select
                                                            size="sm"
                                                            value={selectedProducts.length === 1 ? (newPromotion.variantId?.toString() || 'all') : 'all'}
                                                            onValueChange={(val) => {
                                                                if (selectedProducts.length === 1) {
                                                                    setNewPromotion(prev => ({ ...prev, variantId: val === 'all' ? '' : val }));
                                                                }
                                                                // Future improvement: track per-product variants in a map
                                                            }}
                                                            disabled={selectedProducts.length > 1} // Simplified for now, variant selection only for single items
                                                        >
                                                            <SelectTrigger className="h-7 text-[10px] w-[120px]">
                                                                <SelectValue placeholder="All Variants" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="all">All Variants</SelectItem>
                                                                {p.variants.map(v => (
                                                                    <SelectItem key={v.id} value={v.id.toString()}>
                                                                        {Object.values(v.attributes).join('/') || v.sku}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeProduct(p.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="discountType">Discount Type</Label>
                                    <Select
                                        value={newPromotion.discountType}
                                        onValueChange={(value: any) => setNewPromotion(prev => ({ ...prev, discountType: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                                            <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                            <SelectItem value="AMOUNT_OFF">Amount Off</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="discountValue">Value</Label>
                                    <div className="relative">
                                        {newPromotion.discountType === 'PERCENTAGE' ? (
                                            <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        ) : (
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">KES</span>
                                        )}
                                        <Input
                                            id="discountValue"
                                            type="number"
                                            value={newPromotion.discountValue}
                                            onChange={(e) => setNewPromotion(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                                            className={newPromotion.discountType !== 'PERCENTAGE' ? 'pl-10' : 'pr-9'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={newPromotion.startDate as string}
                                        onChange={(e) => setNewPromotion(prev => ({ ...prev, startDate: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={newPromotion.endDate as string}
                                        onChange={(e) => setNewPromotion(prev => ({ ...prev, endDate: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Description (Internal)</Label>
                                <Input
                                    id="description"
                                    value={newPromotion.description}
                                    onChange={(e) => setNewPromotion(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="e.g., Summer Sale 2024"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreatePromotion} disabled={selectedProducts.length === 0 || !newPromotion.discountValue}>
                                {selectedProducts.length > 1 ? `Create ${selectedProducts.length} Promotions` : 'Create Promotion'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Promotion</DialogTitle>
                    </DialogHeader>
                    {editingPromotion && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Product</Label>
                                <Input value={getProductName(editingPromotion.productId)} disabled />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="editDiscountType">Discount Type</Label>
                                    <Select
                                        value={editingPromotion.discountType}
                                        onValueChange={(value: any) => setEditingPromotion(prev => prev ? ({ ...prev, discountType: value }) : null)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                                            <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                                            <SelectItem value="AMOUNT_OFF">Amount Off</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="editDiscountValue">Value</Label>
                                    <div className="relative">
                                        {editingPromotion.discountType === 'PERCENTAGE' ? (
                                            <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        ) : (
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">KES</span>
                                        )}
                                        <Input
                                            id="editDiscountValue"
                                            type="number"
                                            value={editingPromotion.discountValue}
                                            onChange={(e) => setEditingPromotion(prev => prev ? ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }) : null)}
                                            className={editingPromotion.discountType !== 'PERCENTAGE' ? 'pl-10' : 'pr-9'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="editStartDate">Start Date</Label>
                                    <Input
                                        id="editStartDate"
                                        type="date"
                                        value={editingPromotion.startDate.toString().split('T')[0]}
                                        onChange={(e) => setEditingPromotion(prev => prev ? ({ ...prev, startDate: e.target.value }) : null)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="editEndDate">End Date</Label>
                                    <Input
                                        id="editEndDate"
                                        type="date"
                                        value={editingPromotion.endDate.toString().split('T')[0]}
                                        onChange={(e) => setEditingPromotion(prev => prev ? ({ ...prev, endDate: e.target.value }) : null)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="editDescription">Description</Label>
                                <Input
                                    id="editDescription"
                                    value={editingPromotion.description || ''}
                                    onChange={(e) => setEditingPromotion(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdatePromotion}>Update Promotion</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedPromotions.map((group) => {
                    const isExpired = new Date(group.endDate) < new Date();
                    const isUpcoming = new Date(group.startDate) > new Date();
                    const isCurrentlyActive = group.active !== false && group.isActive !== false;
                    const isActive = !isExpired && !isUpcoming && isCurrentlyActive;

                    const handleGroupDelete = () => {
                        const ids = group.items.map((item: any) => item.id).filter(Boolean);
                        if (ids.length > 0) {
                            deleteBulkPromotions(ids);
                        }
                    };

                    const handleGroupEdit = () => {
                        // For editing, we pick the first one and the form will handle the rest
                        setEditingPromotion(group.items[0]);
                        setIsEditDialogOpen(true);
                    };

                    return (
                        <Card key={group.groupKey} className={cn("overflow-hidden border-t-4 shadow-sm hover:shadow-md transition-shadow", isActive ? "border-t-green-500" : isUpcoming ? "border-t-blue-500" : "border-t-muted")}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant={isActive ? "default" : isUpcoming ? "secondary" : "outline"} className={cn(isActive && "bg-green-500 hover:bg-green-600")}>
                                        {isActive ? "Active Now" : isUpcoming ? "Upcoming" : "Expired"}
                                    </Badge>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={handleGroupEdit}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive"
                                            onClick={handleGroupDelete}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardTitle className="text-lg mt-2 flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-primary" />
                                    {group.description || "Promotion Campaign"}
                                </CardTitle>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {group.items.slice(0, 3).map((item: any) => (
                                        <Badge key={item.id} variant="secondary" className="text-[10px] py-0 h-5">
                                            {getProductName(item.productId)}
                                        </Badge>
                                    ))}
                                    {group.items.length > 3 && (
                                        <Badge variant="outline" className="text-[10px] py-0 h-5">
                                            +{group.items.length - 3} more items
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-primary">
                                        {group.discountType === 'FIXED_PRICE' ? `KES ${group.discountValue.toLocaleString()}` :
                                            group.discountType === 'PERCENTAGE' ? `${group.discountValue}% OFF` :
                                                `KES ${group.discountValue.toLocaleString()} OFF`}
                                    </span>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">
                                        {group.discountType.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="space-y-2 py-2 border-y border-muted/50">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>Starts: {format(new Date(group.startDate), 'PPP')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>Ends: {format(new Date(group.endDate), 'PPP')}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {groupedPromotions.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Tag className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No promotions found</p>
                        <p className="text-sm">Create your first promotion to boost sales!</p>
                        <Button variant="outline" className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Promotion
                        </Button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
