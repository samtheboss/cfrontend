import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Supplier, PurchaseOrder } from '@/types/inventory';
import { Plus, Truck, Trash2, Package, FileText, CheckCircle2, Clock, Search, ArrowLeft } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface POItem {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function Purchasing() {
  const { products, locations, suppliers, addSupplier, updateSupplier } = useInventory();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inline PO form state
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [editingPOId, setEditingPOId] = useState<number | null>(null);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poLocationId, setPOLocationId] = useState('');
  const [poNotes, setPONotes] = useState('');
  const [poInvoiceNumber, setPOInvoiceNumber] = useState('');
  const [poDateReceived, setPODateReceived] = useState('');
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product search dialog state
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Supplier dialog state
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

  const allVariants = useMemo(() =>
    products.flatMap(p =>
      p.variants.map(v => ({
        ...v,
        fullName: `${p.name}${Object.values(v.attributes).length ? ' - ' + Object.values(v.attributes).join(' / ') : ''}`,
        categoryName: p.category || '',
      }))
    ), [products]);

  const filteredVariants = useMemo(() => {
    if (!productSearchQuery) return allVariants;
    const q = productSearchQuery.toLowerCase();
    return allVariants.filter(v =>
      v.fullName.toLowerCase().includes(q) ||
      v.sku?.toLowerCase().includes(q) ||
      v.barcode?.toLowerCase().includes(q)
    );
  }, [allVariants, productSearchQuery]);

  useEffect(() => {
    fetchPurchasingData();
  }, []);

  const fetchPurchasingData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ data: any[] }>('/api/purchase-orders');
      setPurchaseOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch POs:', error);
      toast.error('Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSupplier = async () => {
    if (!editingSupplier?.name) return;
    try {
      if (editingSupplier.id) {
        await updateSupplier(editingSupplier as Supplier);
      } else {
        await addSupplier(editingSupplier);
      }
      toast.success('Supplier saved');
      setIsSupplierDialogOpen(false);
    } catch (error) {
      toast.error('Failed to save supplier');
    }
  };

  const startNewPO = () => {
    setEditingPOId(null);
    setPOSupplierId('');
    setPOLocationId(locations[0]?.id || '');
    setPONotes('');
    setPOInvoiceNumber('');
    setPODateReceived('');
    setPOItems([]);
    setIsCreatingPO(true);
  };

  const editPO = (po: any) => {
    setEditingPOId(po.id);
    setPOSupplierId(String(po.supplier?.id || ''));
    setPOLocationId(String(po.locationId || ''));
    setPONotes(po.notes || '');
    setPOInvoiceNumber(po.invoiceNumber || '');
    setPODateReceived(po.dateReceived ? String(po.dateReceived).substring(0, 10) : '');
    setPOItems((po.items || []).map((item: any) => ({
      variantId: String(item.variantId),
      sku: item.sku || '',
      productName: item.productName || '',
      quantity: Math.abs(item.adjustment || item.quantity || 0),
      unitPrice: item.price || item.unitPrice || 0,
    })));
    setIsCreatingPO(true);
  };

  const cancelPO = () => {
    setEditingPOId(null);
    setIsCreatingPO(false);
  };

  const addItemToPO = (variant: typeof allVariants[0]) => {
    // Check if already added
    const existing = poItems.find(i => String(i.variantId) === String(variant.id));
    if (existing) {
      toast.info('Item already added — update the quantity instead');
      setIsProductSearchOpen(false);
      return;
    }
    setPOItems(prev => [...prev, {
      variantId: String(variant.id),
      sku: variant.sku || '',
      productName: variant.fullName,
      quantity: 1,
      unitPrice: variant.cost || 0,
    }]);
    setIsProductSearchOpen(false);
    setProductSearchQuery('');
  };

  const removeItemFromPO = (idx: number) => {
    setPOItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx: number, qty: number) => {
    setPOItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setPOItems(prev => prev.map((item, i) => i === idx ? { ...item, unitPrice: price } : item));
  };

  const poTotal = useMemo(() =>
    poItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0), [poItems]);

  const handleSubmitPO = async (postStatus: 'PENDING' | 'COMPLETED') => {
    if (!poSupplierId) { toast.error('Please select a supplier'); return; }
    if (!poLocationId) { toast.error('Please select a receiving location'); return; }
    if (!poItems.length) { toast.error('Please add at least one item'); return; }

    setIsSubmitting(true);
    try {
      const payload: any = {
        type: 'RECEIVED',
        status: postStatus,
        locationId: poLocationId,
        supplier: { id: Number(poSupplierId) },
        notes: poNotes,
        invoiceNumber: poInvoiceNumber || null,
        dateReceived: poDateReceived || null,
        items: poItems.map(item => ({
          variantId: Number(item.variantId),
          sku: item.sku,
          productName: item.productName,
          adjustment: item.quantity,
          price: item.unitPrice,
        })),
      };

      if (editingPOId) {
        await apiFetch(`/api/purchase-orders/${editingPOId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success(postStatus === 'COMPLETED' ? 'Purchase order posted & stock updated' : 'Purchase order updated');
      } else {
        await apiFetch('/api/purchase-orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(postStatus === 'COMPLETED' ? 'Purchase order posted & stock updated' : 'Purchase order saved on hold');
      }
      setEditingPOId(null);
      setIsCreatingPO(false);
      fetchPurchasingData();
    } catch (error) {
      toast.error('Failed to save purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPO = async (id: string | number) => {
    try {
      await apiFetch(`/api/purchase-orders/${id}/process`, { method: 'POST' });
      toast.success('Purchase order processed and stock updated');
      fetchPurchasingData();
    } catch (error) {
      toast.error('Failed to process purchase order');
    }
  };

  const formatDate = (dateVal: any) => {
    try {
      if (!dateVal) return '—';
      // Handle array format [2026, 3, 22, 19, 30]
      if (Array.isArray(dateVal)) {
        const [y, m, d] = dateVal;
        return format(new Date(y, m - 1, d), 'MMM dd, yyyy');
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return format(d, 'MMM dd, yyyy');
    } catch {
      return '—';
    }
  };

  // ─── RENDER: Inline PO Creation Form ────────────────────────────
  if (isCreatingPO) {
    return (
      <AppLayout title="New Purchase Order">
        <div className="space-y-3 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelPO}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold">{editingPOId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
          </div>

          {/* Details — all fields in one compact card */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Supplier *</Label>
                  <Select value={poSupplierId} onValueChange={setPOSupplierId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location *</Label>
                  <Select value={poLocationId} onValueChange={setPOLocationId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice No.</Label>
                  <Input className="h-8 text-sm" placeholder="e.g. INV-001" value={poInvoiceNumber} onChange={e => setPOInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date Received</Label>
                  <Input className="h-8 text-sm" type="date" value={poDateReceived} onChange={e => setPODateReceived(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input className="h-8 text-sm" placeholder="Optional notes..." value={poNotes} onChange={e => setPONotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Items</p>
                <Button size="sm" className="h-7 text-xs" onClick={() => { setProductSearchQuery(''); setIsProductSearchOpen(true); }}>
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              {poItems.length === 0 ? (
                <div className="text-center py-5 border border-dashed rounded-md">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
                  <p className="text-muted-foreground text-xs">No items added yet</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => { setProductSearchQuery(''); setIsProductSearchOpen(true); }}>
                    <Search className="h-3 w-3 mr-1" /> Search & Add
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-1.5 px-1 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b">
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Total</span>
                    <span></span>
                  </div>
                  {poItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-1.5 items-center px-1 py-1 hover:bg-muted/40 rounded">
                      <div className="min-w-0">
                        <p className="text-sm truncate leading-tight">{item.productName}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{item.sku}</p>
                      </div>
                      <Input type="number" step="0.001" min="0.001" className="h-7 text-xs text-right" value={item.quantity} onChange={e => updateItemQty(idx, parseFloat(e.target.value) || 0)} />
                      <Input type="number" step="0.01" min="0" className="h-7 text-xs text-right" value={item.unitPrice} onChange={e => updateItemPrice(idx, parseFloat(e.target.value) || 0)} />
                      <p className="text-xs font-medium text-right">{(item.quantity * item.unitPrice).toFixed(2)}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItemFromPO(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {/* Totals */}
                  <div className="grid grid-cols-[1fr_80px_80px_70px_32px] gap-1.5 px-1 pt-2 border-t mt-1">
                    <p className="text-xs font-semibold">Total ({poItems.length} items)</p>
                    <span></span><span></span>
                    <p className="text-sm font-bold text-right">{poTotal.toFixed(2)}</p>
                    <span></span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Spacer to prevent fixed footer from covering content on mobile */}
          <div className="h-20 sm:hidden" />

          {/* Actions - Fixed on mobile, relative on desktop */}
          <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-3 flex justify-end gap-2 z-50 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:relative sm:p-0 sm:border-0 sm:bg-transparent sm:z-10 sm:pb-0 sm:mt-6">
            <Button variant="outline" size="sm" onClick={cancelPO} disabled={isSubmitting}>Cancel</Button>
            <Button variant="secondary" size="sm" onClick={() => handleSubmitPO('PENDING')} disabled={!poSupplierId || !poLocationId || poItems.length === 0 || isSubmitting}>
              <Clock className="h-3.5 w-3.5 mr-1" /> Hold
            </Button>
            <Button size="sm" onClick={() => handleSubmitPO('COMPLETED')} disabled={!poSupplierId || !poLocationId || poItems.length === 0 || isSubmitting}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Post & Receive Stock
            </Button>
          </div>
        </div>

        {/* Product Search Dialog */}
        <Dialog open={isProductSearchOpen} onOpenChange={setIsProductSearchOpen}>
          <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Select Product</DialogTitle>
              <DialogDescription>Search and select a product to add to the purchase order.</DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU or barcode..."
                className="pl-9"
                value={productSearchQuery}
                onChange={e => setProductSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[45vh]">
              {filteredVariants.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No products found</p>
              ) : (
                filteredVariants.map(v => {
                  const alreadyAdded = poItems.some(i => String(i.variantId) === String(v.id));
                  return (
                    <button
                      key={v.id}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md flex items-center justify-between gap-3 transition-colors",
                        alreadyAdded ? "bg-primary/5 opacity-60 cursor-default" : "hover:bg-muted cursor-pointer"
                      )}
                      onClick={() => !alreadyAdded && addItemToPO(v)}
                      disabled={alreadyAdded}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{v.fullName}</p>
                        <p className="text-xs text-muted-foreground">{v.sku}{v.barcode ? ` • ${v.barcode}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Stock: {v.stock ?? 0}</p>
                        <p className="text-xs font-medium">Cost: {v.cost ?? 0}</p>
                      </div>
                      {alreadyAdded && <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>}
                    </button>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // ─── RENDER: Main Purchasing View ───────────────────────────────
  return (
    <AppLayout title="Purchasing">
      <Tabs defaultValue="orders" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button onClick={startNewPO}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
            <Button variant="outline" onClick={() => {
              setEditingSupplier({ name: '', contactPerson: '', email: '', phone: '' });
              setIsSupplierDialogOpen(true);
            }}>
              <Truck className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </div>

        <TabsContent value="orders" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {purchaseOrders.map(po => (
              <Card
                key={po.id}
                className={cn(
                  "group hover:border-primary/50 transition-colors",
                  po.status === 'PENDING' && "cursor-pointer"
                )}
                onClick={() => po.status === 'PENDING' && editPO(po)}
              >
                <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={cn(
                      "p-1.5 md:p-2 rounded-full shrink-0",
                      po.status === 'COMPLETED' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {po.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" /> : <Clock className="h-4 w-4 md:h-5 md:w-5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm md:text-base truncate">{po.journalNumber || `PO-${String(po.id).padStart(5, '0')}`}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        {po.supplier?.name || 'Unknown Supplier'} • {formatDate(po.timestamp)}
                      </p>
                      {po.status === 'PENDING' && (
                        <p className="text-[10px] md:text-xs text-primary mt-0.5">Click to edit</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:flex items-center gap-x-4 gap-y-2 md:gap-6">
                    <div className="text-left md:text-right order-1 md:order-none">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Items</p>
                      <p className="text-sm md:text-base font-medium">{po.items?.length || 0}</p>
                    </div>
                    <div className="text-right order-2 md:order-none">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                      <p className="text-sm md:text-base font-bold">{Number(po.totalAmount || 0).toFixed(2)}</p>
                    </div>
                    <div className="order-3 md:order-none">
                      <Badge variant={po.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-[10px] md:text-xs">
                        {po.status === 'PENDING' ? 'ON HOLD' : po.status}
                      </Badge>
                    </div>
                    {po.status === 'PENDING' && (
                      <div className="col-span-2 md:col-span-1 order-4 md:order-none">
                        <Button size="sm" className="w-full h-8 md:h-9 md:w-auto text-xs" onClick={(e) => { e.stopPropagation(); handleProcessPO(po.id); }}>
                          Mark as Received
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {!purchaseOrders.length && !isLoading && (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-medium">No purchase orders found</h3>
                <p className="text-muted-foreground mb-4">Start by creating a new order to restock your inventory.</p>
                <Button onClick={startNewPO}>
                  <Plus className="h-4 w-4 mr-2" /> Create First Order
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.map(supplier => (
              <Card key={supplier.id} className="group overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-primary/5 pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{supplier.name}</CardTitle>
                    <Truck className="h-5 w-5 text-primary opacity-50" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-sm text-muted-foreground">
                  <p>👤 {supplier.contactPerson}</p>
                  <p>📧 {supplier.email}</p>
                  <p>📞 {supplier.phone}</p>
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      setEditingSupplier(supplier);
                      setIsSupplierDialogOpen(true);
                    }}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Supplier Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier?.id ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
            <DialogDescription>Fill in the supplier details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Supplier Name</Label>
              <Input
                value={editingSupplier?.name || ''}
                onChange={e => setEditingSupplier(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Contact Person</Label>
              <Input
                value={editingSupplier?.contactPerson || ''}
                onChange={e => setEditingSupplier(prev => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={editingSupplier?.email || ''}
                  onChange={e => setEditingSupplier(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={editingSupplier?.phone || ''}
                  onChange={e => setEditingSupplier(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSupplier}>Save Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
