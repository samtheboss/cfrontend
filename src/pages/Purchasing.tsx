import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Supplier, PurchaseOrder } from '@/types/inventory';
import { Plus, Truck, Trash2, Package, FileText, CheckCircle2, Clock, Search, ArrowLeft, Banknote, CreditCard, Smartphone, ChevronsUpDown, Check, ClipboardList, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

interface POItem {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  taxType?: string;
}

export default function Purchasing() {
  const { user } = useAuth();
  const { sym, computeTax, vatInclusive } = useCurrency();
  const { products, locations, suppliers, addSupplier, updateSupplier, refreshData } = useInventory();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inline PO form state
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [editingPOId, setEditingPOId] = useState<number | null>(null);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [poLocationId, setPOLocationId] = useState('');
  const [poNotes, setPONotes] = useState('');
  const [poInvoiceNumber, setPOInvoiceNumber] = useState('');
  const [poDateReceived, setPODateReceived] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [poPaymentStatus, setPOPaymentStatus] = useState<'PENDING' | 'PAID' | 'PARTIAL'>('PENDING');
  const [poPaymentMethods, setPoPaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank_transfer: { active: false, amount: '', reference: '' },
      credit_note: { active: false, amount: '', reference: '' }
    });
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [poSearchQuery, setPOSearchQuery] = useState('');
  const [poDateFilter, setPODateFilter] = useState<'today' | 'all'>('today');
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);

  // View PO dialog state
  const [isViewingPO, setIsViewingPO] = useState(false);
  const [viewingPO, setViewingPO] = useState<any | null>(null);
  const [poReturns, setPoReturns] = useState<any[]>([]);

  // Record Payment dialog state

  // Cancel PO dialog state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReturnItems, setCancelReturnItems] = useState<any[]>([]);
  const [refundMode, setRefundMode] = useState<'PREPAYMENT' | 'REFUND'>('PREPAYMENT');

  const handleOpenCancelModal = () => {
    if (!viewingPO) return;
    setCancelReturnItems(
      (viewingPO.items || []).map((item: any) => {
        // Calculate how many of this item were already returned across all previous returns
        const alreadyReturned = poReturns.reduce((sum: number, r: any) => {
          const retItem = (r.items || []).find((i: any) => String(i.variantId) === String(item.variantId));
          return sum + Math.abs(retItem?.adjustment || retItem?.quantity || 0);
        }, 0);
        
        const originalQty = Math.abs(item.adjustment || item.quantity || 0);
        const availableQty = Math.max(0, originalQty - alreadyReturned);

        return {
          cartItemId: item.cartItemId || item.id,
          variantId: String(item.variantId),
          productName: item.productName,
          returnQty: 0,
          maxQty: availableQty,
          price: item.price || item.unitPrice || 0,
          taxRate: item.taxRate ?? 16.0
        };
      })
    );
    setIsCancelModalOpen(true);
  };

  const calculatedCancelAmount = useMemo(() => {
    return cancelReturnItems.reduce((sum, item) => {
      const taxes = computeTax(item.returnQty, item.price, item.taxRate ?? 16.0);
      return sum + taxes.total;
    }, 0);
  }, [cancelReturnItems, computeTax, vatInclusive]);

  const viewingPOTotalPaid = useMemo(() => {
    if (!viewingPO) return 0;
    let paid = 0;
    try {
      const parsed = JSON.parse(viewingPO.paymentMethod || '[]');
      if (Array.isArray(parsed)) {
        paid = parsed.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      }
    } catch {}
    return paid;
  }, [viewingPO]);

  const submitCancelPO = async () => {
    if (!viewingPO || calculatedCancelAmount <= 0) {
      toast.error("Please select items to return");
      return;
    }
    setIsCancelling(true);
    try {
      const payload = {
        cancelAmount: calculatedCancelAmount,
        refundMode: refundMode,
        returnedItems: cancelReturnItems.filter(i => i.returnQty > 0).map(i => ({
          variantId: Number(i.variantId),
          quantity: i.returnQty
        }))
      };
      
      const res = await apiFetch(`/api/purchase-orders/${viewingPO.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      toast.success('Purchase Order returned/cancelled successfully');
      setIsCancelModalOpen(false);
      setIsViewingPO(false);
      fetchPurchasingData();
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel PO');
    } finally {
      setIsCancelling(false);
    }
  };

  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [recordPaymentMethods, setRecordPaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank_transfer: { active: false, amount: '', reference: '' },
      credit_note: { active: false, amount: '', reference: '' }
    });

  const totalPaid = useMemo(() => {
    return Object.values(poPaymentMethods)
      .reduce((sum, method) => method.active ? sum + (parseFloat(method.amount) || 0) : sum, 0);
  }, [poPaymentMethods]);

  const handlePOPaymentMethodToggle = (method: 'cash' | 'card' | 'mobile' | 'bank_transfer' | 'credit_note', active: boolean) => {
    setPoPaymentMethods(prev => {
      const newState = { ...prev };
      if (active) {
        // Auto-fill with remaining amount
        const currentPaid = Object.values(prev)
          .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
        const remaining = Math.max(0, poTotal - currentPaid);
        newState[method] = { ...prev[method], active: true, amount: remaining > 0 ? remaining.toFixed(2) : '' };
      } else {
        newState[method] = { ...prev[method], active: false, amount: '', reference: '' };
      }
      return newState;
    });
  };

  const updatePOPaymentDetail = (method: 'cash' | 'card' | 'mobile' | 'bank_transfer' | 'credit_note', field: 'amount' | 'reference', value: string) => {
    setPoPaymentMethods(prev => ({
      ...prev,
      [method]: { ...prev[method], [field]: value }
    }));
  };

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
        taxType: p.taxType,
        taxRate: p.taxRate,
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

  useEffect(() => {
    if (poSupplierId) {
      apiFetch<{ data: { currentBalance: number } }>(`/api/supplier-ledger/${poSupplierId}/balance`)
        .then(res => {
          setSupplierBalance(res.data?.currentBalance ?? 0);
        })
        .catch(err => {
          console.error("Failed to fetch supplier balance", err);
          setSupplierBalance(null);
        });
    } else {
      setSupplierBalance(null);
    }
  }, [poSupplierId]);

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
    setIsSavingSupplier(true);
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
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const startNewPO = () => {
    setEditingPOId(null);
    setPOSupplierId('');
    setSupplierBalance(null);
    setPOLocationId(locations[0]?.id || '');
    setPONotes('');
    setPOInvoiceNumber('');
    setPODateReceived(format(new Date(), 'yyyy-MM-dd'));
    setPOPaymentStatus('PENDING');
    setPoPaymentMethods({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' },
      bank_transfer: { active: false, amount: '', reference: '' },
      credit_note: { active: false, amount: '', reference: '' }
    });
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
    setPOPaymentStatus(po.paymentStatus || 'PENDING');
    
    // Parse paymentMethod
    const defaultMethods = {
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' },
      bank_transfer: { active: false, amount: '', reference: '' },
      credit_note: { active: false, amount: '', reference: '' }
    };
    
    if (po.paymentMethod) {
      try {
        const parsed = JSON.parse(po.paymentMethod);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            const methodKey = String(p.method).toLowerCase();
            if (methodKey in defaultMethods) {
              defaultMethods[methodKey as keyof typeof defaultMethods] = {
                active: true,
                amount: String(p.amount || ''),
                reference: String(p.reference || '')
              };
            }
          });
        } else {
          // Old single paymentMethod format
          const oldMethod = String(po.paymentMethod).toLowerCase();
          if (oldMethod in defaultMethods) {
            defaultMethods[oldMethod as keyof typeof defaultMethods] = {
              active: true,
              amount: String(po.totalAmount || ''),
              reference: String(po.referenceNumber || '')
            };
          }
        }
      } catch {
        // Fallback for non-JSON string
        const oldMethod = String(po.paymentMethod).toLowerCase();
        if (oldMethod in defaultMethods) {
          defaultMethods[oldMethod as keyof typeof defaultMethods] = {
            active: true,
            amount: String(po.totalAmount || ''),
            reference: String(po.referenceNumber || '')
          };
        }
      }
    }
    setPoPaymentMethods(defaultMethods);
    setPOItems((po.items || []).map((item: any) => ({
      variantId: String(item.variantId),
      sku: item.sku || '',
      productName: item.productName || '',
      quantity: Math.abs(item.adjustment || item.quantity || 0),
      unitPrice: item.price || item.unitPrice || 0,
      taxRate: item.taxRate ?? 16.0,
      taxAmount: item.taxAmount ?? 0,
      taxType: item.taxType ?? 'A'
    })));
    setIsCreatingPO(true);
  };

  const cancelPO = () => {
    setEditingPOId(null);
    setIsCreatingPO(false);
    setSupplierBalance(null);
  };

  const addItemToPO = (variant: typeof allVariants[0]) => {
    // Check if already added
    const existing = poItems.find(i => String(i.variantId) === String(variant.id));
    if (existing) {
      toast.info('Item already added — update the quantity instead');
      setIsProductSearchOpen(false);
      return;
    }
    const product = products.find(p => p.variants.some(v => v.id === variant.id));
    const taxRate = product?.taxRate ?? 16.0;
    const unitPrice = variant.cost || 0;
    setPOItems(prev => [...prev, {
      variantId: String(variant.id),
      sku: variant.sku || '',
      productName: variant.fullName,
      quantity: 1,
      unitPrice: unitPrice,
      taxRate: taxRate,
      taxType: product?.taxType ?? 'A',
      taxAmount: computeTax(1, unitPrice, taxRate).tax
    }]);
    setIsProductSearchOpen(false);
    setProductSearchQuery('');
  };

  const removeItemFromPO = (idx: number) => {
    setPOItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx: number, qty: number) => {
    setPOItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty, taxAmount: computeTax(qty, item.unitPrice, item.taxRate ?? 16.0).tax } : item));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setPOItems(prev => prev.map((item, i) => i === idx ? { ...item, unitPrice: price, taxAmount: computeTax(item.quantity, price, item.taxRate ?? 16.0).tax } : item));
  };

  const poTotals = useMemo(() => {
    return poItems.reduce((acc, item) => {
      const taxes = computeTax(item.quantity, item.unitPrice, item.taxRate ?? 16.0);
      return {
        subtotal: acc.subtotal + taxes.subtotal,
        tax: acc.tax + taxes.tax,
        total: acc.total + taxes.total
      };
    }, { subtotal: 0, tax: 0, total: 0 });
  }, [poItems, vatInclusive]);

  const poSubtotal = poTotals.subtotal;
  const poTax = poTotals.tax;
  const poTotal = poTotals.total;

  const handleOpenPaymentDetail = () => {
    if (!poSupplierId) { toast.error('Please select a supplier'); return; }
    if (!poLocationId) { toast.error('Please select a receiving location'); return; }
    if (!poItems.length) { toast.error('Please add at least one item'); return; }
    setIsPaymentDetailOpen(true);
  };

  const handleSubmitPO = async (postStatus: 'PENDING' | 'COMPLETED') => {
    if (!poSupplierId) { toast.error('Please select a supplier'); return; }
    if (!poLocationId) { toast.error('Please select a receiving location'); return; }
    if (!poItems.length) { toast.error('Please add at least one item'); return; }

    // Prepare paymentMethod JSON payload
    const activePayments = Object.entries(poPaymentMethods)
      .filter(([_, m]) => m.active && (parseFloat(m.amount) || 0) > 0)
      .map(([method, m]) => ({
        method: method.toUpperCase(),
        amount: parseFloat(m.amount) || 0,
        reference: m.reference || ''
      }));

    setIsSubmitting(true);
    try {
      const currentUser = user?.name || user?.username || 'System';
      const payload: any = {
        type: 'RECEIVED',
        status: postStatus,
        totalAmount: poTotal,
        locationId: poLocationId,
        supplier: { id: Number(poSupplierId) },
        notes: poNotes,
        createdBy: currentUser,
        approvedBy: postStatus === 'COMPLETED' ? currentUser : null,
        userId: user?.id || null,
        invoiceNumber: poInvoiceNumber || null,
        dateReceived: poDateReceived || null,
        paymentStatus: poPaymentStatus,
        paymentMethod: JSON.stringify(activePayments),
        items: poItems.map(item => ({
          variantId: Number(item.variantId),
          sku: item.sku,
          productName: item.productName,
          adjustment: item.quantity,
          price: item.unitPrice,
          taxRate: item.taxRate ?? 16.0,
          taxAmount: item.taxAmount ?? 0,
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
      setIsPaymentDetailOpen(false);
      fetchPurchasingData();
      await refreshData();
    } catch (error) {
      toast.error('Failed to save purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPO = async (id: string | number) => {
    try {
      const currentUser = user?.name || user?.username || 'System';
      const currentUserId = user?.id || '';
      await apiFetch(`/api/purchase-orders/${id}/process?approvedBy=${encodeURIComponent(currentUser)}&userId=${currentUserId}`, { method: 'POST' });
      toast.success('Purchase order processed and stock updated');
      fetchPurchasingData();
      await refreshData();
    } catch (error) {
      toast.error('Failed to process purchase order');
    }
  };

  const formatPaymentMethod = (paymentMethodStr: string) => {
    if (!paymentMethodStr) return '';
    try {
      const parsed = JSON.parse(paymentMethodStr);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return '';
        return parsed.map(p => `${p.method.toLowerCase().replace('_', ' ')}: ${p.amount}`).join(', ');
      }
    } catch {}
    return paymentMethodStr;
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
  const isToday = (dateVal: any) => {
    try {
      if (!dateVal) return false;
      let d: Date;
      if (Array.isArray(dateVal)) {
        const [year, month, day] = dateVal;
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(dateVal);
      }
      if (isNaN(d.getTime())) return false;
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    } catch {
      return false;
    }
  };

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      // 1. Date Filter
      if (poDateFilter === 'today') {
        if (!isToday(po.timestamp)) return false;
      }

      // 2. Search Query Filter
      if (poSearchQuery.trim() !== '') {
        const q = poSearchQuery.toLowerCase();
        const supplierName = po.supplier?.name?.toLowerCase() || '';
        const journalNumber = po.journalNumber?.toLowerCase() || `po-${String(po.id).padStart(5, '0')}`;
        const invoiceNumber = po.invoiceNumber?.toLowerCase() || '';
        return (
          supplierName.includes(q) ||
          journalNumber.includes(q) ||
          invoiceNumber.includes(q)
        );
      }

      return true;
    });
  }, [purchaseOrders, poDateFilter, poSearchQuery]);

  // ─── RENDER: Inline PO Creation Form ────────────────────────────
  if (isCreatingPO) {
    return (
      <AppLayout title="New Purchase Order">
        <div className="space-y-4 max-w-5xl">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={cancelPO}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold">{editingPOId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
          </div>

          {/* Details — all fields in one compact card */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Supplier *</Label>
                    {supplierBalance !== null && (
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-sm border",
                        supplierBalance > 0
                          ? "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/30"
                          : supplierBalance < 0
                          ? "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800/30"
                          : "text-muted-foreground border-muted/30 bg-muted/20"
                      )}>
                        Bal: ${supplierBalance.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isSupplierPopoverOpen}
                        className="w-full h-9 justify-between text-sm font-normal px-3"
                      >
                        <span className="truncate">
                          {poSupplierId
                            ? suppliers.find((s) => String(s.id) === poSupplierId)?.name
                            : "Select supplier..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search supplier..." className="h-9 text-xs" />
                        <CommandList>
                          <CommandEmpty>No supplier found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  setPOSupplierId(String(s.id));
                                  setIsSupplierPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    poSupplierId === String(s.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {s.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location *</Label>
                  <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isLocationPopoverOpen}
                        className="w-full h-9 justify-between text-sm font-normal px-3"
                      >
                        <span className="truncate">
                          {poLocationId
                            ? locations.find((l) => String(l.id) === poLocationId)?.name
                            : "Select location..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search location..." className="h-9 text-xs" />
                        <CommandList>
                          <CommandEmpty>No location found.</CommandEmpty>
                          <CommandGroup>
                            {locations.map((l) => (
                              <CommandItem
                                key={l.id}
                                value={l.name}
                                onSelect={() => {
                                  setPOLocationId(String(l.id));
                                  setIsLocationPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    poLocationId === String(l.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {l.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice No.</Label>
                  <Input className="h-9 text-sm" placeholder="e.g. INV-001" value={poInvoiceNumber} onChange={e => setPOInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date Received</Label>
                  <Input className="h-9 text-sm" type="date" value={poDateReceived} onChange={e => setPODateReceived(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input className="h-9 text-sm" placeholder="Optional notes..." value={poNotes} onChange={e => setPONotes(e.target.value)} />
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
                  <div className="grid grid-cols-[1fr_80px_80px_80px_70px_32px] gap-1.5 px-1 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b">
                    <span>Product</span>
                    <span className="text-right">Avail Stock</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Total</span>
                    <span></span>
                  </div>
                  {poItems.map((item, idx) => {
                    const variant = allVariants.find(v => String(v.id) === String(item.variantId));
                    const currentStock = variant ? (variant.locationStock?.[poLocationId] ?? 0) : 0;
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_70px_32px] gap-1.5 items-center px-1 py-1 hover:bg-muted/40 rounded">
                        <div className="min-w-0">
                          <p className="text-sm truncate leading-tight">{item.productName}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{item.sku}</p>
                        </div>
                        <p className="text-xs text-right text-muted-foreground font-medium pr-1">{currentStock.toFixed(3)}</p>
                        <Input type="number" step="0.001" min="0.001" className="h-7 text-xs text-right" value={item.quantity} onChange={e => updateItemQty(idx, parseFloat(e.target.value) || 0)} />
                        <Input type="number" step="0.01" min="0" className="h-7 text-xs text-right" value={item.unitPrice} onChange={e => updateItemPrice(idx, parseFloat(e.target.value) || 0)} />
                        <p className="text-xs font-medium text-right">{(item.quantity * item.unitPrice).toFixed(2)}</p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItemFromPO(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {/* Totals */}
                  <div className="flex flex-col gap-1 px-1 pt-2 border-t mt-1">
                    <div className="flex justify-between items-center px-8">
                      <p className="text-xs font-semibold text-muted-foreground">Subtotal</p>
                      <p className="text-xs font-semibold">{poSubtotal.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-between items-center px-8">
                      <p className="text-xs font-semibold text-muted-foreground">Tax (VAT)</p>
                      <p className="text-xs font-semibold">{poTax.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-between items-center px-8">
                      <p className="text-sm font-bold">Total ({poItems.length} items)</p>
                      <p className="text-sm font-bold">{poTotal.toFixed(2)}</p>
                    </div>
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
            <Button size="sm" onClick={handleOpenPaymentDetail} disabled={!poSupplierId || !poLocationId || poItems.length === 0 || isSubmitting}>
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

        {/* Payment Detail Dialog */}
        <Dialog open={isPaymentDetailOpen} onOpenChange={setIsPaymentDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription>Configure payment before posting the purchase order.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div>
                    <span className="text-muted-foreground">PO Total:</span>{" "}
                    <span className="font-bold text-sm">{sym}{poTotal.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid:</span>{" "}
                    <span className="font-bold text-sm text-green-600">{sym}{totalPaid.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining:</span>{" "}
                    <span className={`font-bold text-sm ${totalPaid >= poTotal ? 'text-blue-600' : 'text-red-600'}`}>
                      {sym}{Math.abs(poTotal - totalPaid).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 w-full md:w-1/2">
                  <Label className="text-xs font-semibold">Payment Status</Label>
                  <Select value={poPaymentStatus} onValueChange={(val: any) => setPOPaymentStatus(val)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select payment status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="PARTIAL">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">Select Payment Modes</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(['cash', 'card', 'mobile', 'bank_transfer', 'credit_note'] as const).map((method) => (
                      <div key={method} className="space-y-2 border rounded p-2.5 bg-muted/20">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`po-pay-popup-${method}`}
                            checked={poPaymentMethods[method]?.active}
                            onCheckedChange={(checked) => handlePOPaymentMethodToggle(method, checked === true)}
                          />
                          <Label htmlFor={`po-pay-popup-${method}`} className="capitalize flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                            {method === 'cash' && <Banknote className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'card' && <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'mobile' && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'bank_transfer' && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                              {method === 'credit_note' && <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method.replace('_', ' ')}
                          </Label>
                        </div>

                        {poPaymentMethods[method]?.active && (
                          <div className="grid grid-cols-1 gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={poPaymentMethods[method].amount}
                              onChange={(e) => updatePOPaymentDetail(method, 'amount', e.target.value)}
                              className="h-9 text-sm"
                            />
                            <Input
                              type="text"
                              placeholder="Ref # (optional)"
                              value={poPaymentMethods[method].reference}
                              onChange={(e) => updatePOPaymentDetail(method, 'reference', e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 border-t pt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsPaymentDetailOpen(false)}>Cancel</Button>
              <Button onClick={() => handleSubmitPO('COMPLETED')} disabled={isSubmitting}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Post & Receive Stock
              </Button>
            </DialogFooter>
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
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search purchase orders (supplier, journal #, invoice #)..."
                value={poSearchQuery}
                onChange={e => setPOSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <Select value={poDateFilter} onValueChange={(val: any) => setPODateFilter(val)}>
              <SelectTrigger className="w-full md:w-[200px] h-10 text-sm">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today's Orders</SelectItem>
                <SelectItem value="all">All Orders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {purchaseOrders.length === 0 ? (
              !isLoading && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                  <h3 className="text-lg font-medium">No purchase orders found</h3>
                  <p className="text-muted-foreground mb-4">Start by creating a new order to restock your inventory.</p>
                  <Button onClick={startNewPO}>
                    <Plus className="h-4 w-4 mr-2" /> Create First Order
                  </Button>
                </div>
              )
            ) : filteredPurchaseOrders.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-md bg-muted/10">
                <Package className="h-8 w-8 mx-auto text-muted-foreground opacity-30 mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No purchase orders found</p>
                <p className="text-muted-foreground text-xs mt-1">Try changing your search or date filter.</p>
              </div>
            ) : (
              filteredPurchaseOrders.map(po => (
                <Card
                  key={po.id}
                  className="group hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (po.status === 'PENDING') {
                      editPO(po);
                    } else {
                      
        setViewingPO(po);
        apiFetch(`/api/purchase-orders/${po.id}/returns`)
            .then(res => setPoReturns(res.data || []))
            .catch(() => setPoReturns([]))
            .finally(() => setIsViewingPO(true));
    
                    }
                  }}
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
                          {po.paymentMethod && formatPaymentMethod(po.paymentMethod) && ` • ${formatPaymentMethod(po.paymentMethod)}`}
                        </p>
                        {po.status === 'PENDING' ? (
                          <p className="text-[10px] md:text-xs text-primary mt-0.5">Click to edit</p>
                        ) : (
                          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Click to view details</p>
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
                      <div className="order-3 md:order-none flex flex-col gap-1 items-start md:items-end">
                        <Badge variant={po.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-[10px] md:text-xs">
                          {po.status === 'PENDING' ? 'ON HOLD' : po.status}
                        </Badge>
                        {po.paymentStatus && (
                          <Badge variant="outline" className={cn(
                            "text-[9px] md:text-[10px] font-semibold",
                            po.paymentStatus === 'PAID' && "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20",
                            po.paymentStatus === 'PENDING' && "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20",
                            po.paymentStatus === 'PARTIAL' && "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20"
                          )}>
                            {po.paymentStatus}
                          </Badge>
                        )}
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
              ))
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

      {/* Completed Purchase Order View Dialog */}
      <Dialog open={isViewingPO} onOpenChange={setIsViewingPO}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Purchase Order Details</span>
              <Badge variant={viewingPO?.status === 'COMPLETED' ? 'default' : 'secondary'}>
                {viewingPO?.status === 'PENDING' ? 'ON HOLD' : viewingPO?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Journal Number: <span className="font-semibold text-foreground">{viewingPO?.journalNumber || `PO-${String(viewingPO?.id).padStart(5, '0')}`}</span>
            </DialogDescription>
          </DialogHeader>

          {viewingPO && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Supplier</p>
                  <p className="font-medium">{viewingPO.supplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Receiving Location</p>
                  <p className="font-medium">
                    {locations.find(l => String(l.id) === String(viewingPO.locationId))?.name || viewingPO.locationId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date Received</p>
                  <p className="font-medium">{formatDate(viewingPO.dateReceived)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Invoice Number</p>
                  <p className="font-medium">{viewingPO.invoiceNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payment Status</p>
                  <Badge variant="outline" className={cn(
                    "mt-0.5 font-semibold",
                    viewingPO.paymentStatus === 'PAID' && "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20",
                    viewingPO.paymentStatus === 'PENDING' && "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20",
                    viewingPO.paymentStatus === 'PARTIAL' && "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20"
                  )}>
                    {viewingPO.paymentStatus || 'PENDING'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payment Method(s)</p>
                  <div className="font-medium text-xs space-y-0.5 mt-0.5">
                    {(() => {
                      if (!viewingPO.paymentMethod) return '—';
                      try {
                        const parsed = JSON.parse(viewingPO.paymentMethod);
                        if (Array.isArray(parsed)) {
                          if (parsed.length === 0) return '—';
                          return parsed.map((p, i) => (
                            <div key={i}>
                              <span className="capitalize">{p.method.toLowerCase().replace('_', ' ')}</span>: ${Number(p.amount).toFixed(2)}
                              {p.reference && <span className="text-muted-foreground"> ({p.reference})</span>}
                            </div>
                          ));
                        }
                      } catch {}
                      return viewingPO.paymentMethod;
                    })()}
                  </div>
                </div>
              </div>

              {/* Balance Summary */}
              {(() => {
                const originalTotal = Number(viewingPO?.totalAmount || 0);
                const returnsTotal = poReturns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
                const totalAmount = Math.max(0, originalTotal - returnsTotal);
                let totalPaid = 0;
                try {
                  const parsed = JSON.parse(viewingPO.paymentMethod || '[]');
                  if (Array.isArray(parsed)) {
                    totalPaid = parsed.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                  }
                } catch {}
                const remaining = Math.max(0, totalAmount - totalPaid);
                return (
                  <div className="grid grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Total Amount</p>
                      <p className="font-bold text-base">{sym}{totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Total Paid</p>
                      <p className="font-bold text-base text-green-600">{sym}{totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Remaining Balance</p>
                      <p className={`font-bold text-base ${remaining > 0 ? 'text-red-600' : 'text-blue-600'}`}>{sym}{remaining.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })()}

              {viewingPO.notes && (
                <div className="bg-muted/40 p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="mt-0.5">{viewingPO.notes}</p>
                </div>
              )}

              
              {poReturns.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  <p className="text-sm font-semibold text-red-600">Processed Returns</p>
                  <div className="border border-red-200 rounded-md overflow-hidden bg-red-50/20">
                    <div className="grid grid-cols-[100px_1fr_100px] gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-red-100">
                      <span>Date</span>
                      <span>Items Returned</span>
                      <span className="text-right">Value</span>
                    </div>
                    <div className="divide-y divide-red-100 max-h-[20vh] overflow-y-auto">
                      {poReturns.map((ret: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-[100px_1fr_100px] gap-1 px-3 py-2 text-xs items-center hover:bg-red-50/50">
                          <span className="text-muted-foreground">{new Date(ret.timestamp).toLocaleDateString()}</span>
                          <span className="truncate">{ret.items?.length || 0} item(s)</span>
                          <span className="text-right font-medium text-red-600">-{sym}{Number(ret.refundAmount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Purchased Items</p>
                <div className="border rounded-md overflow-hidden">
                  <div className="grid grid-cols-[1fr_80px_90px_90px] gap-1 px-3 py-1.5 text-xs font-semibold bg-muted uppercase tracking-wider text-muted-foreground border-b">
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y max-h-[30vh] overflow-y-auto">
                    {viewingPO.items?.map((item: any, idx: number) => {
                      const qty = Math.abs(item.adjustment || item.quantity || 0);
                      const cost = item.price || item.unitPrice || 0;
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_80px_90px_90px] gap-1 px-3 py-2 text-xs items-center hover:bg-muted/30">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.productName || 'Unknown Product'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.sku || '—'}</p>
                          </div>
                          <p className="text-right font-medium">{qty}</p>
                          <p className="text-right">{Number(cost).toFixed(2)}</p>
                          <p className="text-right font-semibold">{(qty * cost).toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Total footer */}
                  <div className="grid grid-cols-[1fr_80px_90px_90px] gap-1 px-3 py-2 text-xs font-bold bg-muted/30 border-t">
                    <span>Total Cost</span>
                    <span></span><span></span>
                    <div className="text-right flex flex-col items-end">
                      {poReturns.length > 0 && <span className="text-xs text-muted-foreground line-through decoration-red-500">{sym}{Number(viewingPO.totalAmount || 0).toFixed(2)}</span>}
                      <span className="text-sm text-primary">{sym}{Math.max(0, Number(viewingPO.totalAmount || 0) - poReturns.reduce((sum: number, r: any) => sum + Number(r.refundAmount || 0), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-3 flex justify-between">
            <Button variant="outline" onClick={() => setIsViewingPO(false)}>Close</Button>
            {viewingPO?.status === 'COMPLETED' && (
              <Button variant="destructive" onClick={handleOpenCancelModal}>
                <RotateCcw className="h-4 w-4 mr-2" /> Cancel / Return
              </Button>
            )}
            {(() => {
              const originalTotal = Number(viewingPO?.totalAmount || 0);
              const returnsTotal = poReturns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
              const totalAmount = Math.max(0, originalTotal - returnsTotal);
              let totalPaid = 0;
              try {
                const parsed = JSON.parse(viewingPO?.paymentMethod || '[]');
                if (Array.isArray(parsed)) {
                  totalPaid = parsed.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                }
              } catch {}
              const remaining = totalAmount - totalPaid;
              if (remaining > 0) {
                return (
                  <Button onClick={() => {
                    setRecordPaymentMethods({
                      cash: { active: false, amount: '', reference: '' },
                      card: { active: false, amount: '', reference: '' },
                      mobile: { active: false, amount: '', reference: '' },
                      bank_transfer: { active: false, amount: '', reference: '' },
      credit_note: { active: false, amount: '', reference: '' }
    });
                    setIsRecordPaymentOpen(true);
                  }}>
                    <Banknote className="h-4 w-4 mr-2" /> Record Payment
                  </Button>
                );
              }
              return null;
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment against PO: <span className="font-semibold text-foreground">{viewingPO?.journalNumber || `PO-${String(viewingPO?.id).padStart(5, '0')}`}</span>
            </DialogDescription>
          </DialogHeader>

          {viewingPO && (
            <div className="space-y-4 py-2">
              {/* Balance display */}
              {(() => {
                const originalTotal = Number(viewingPO?.totalAmount || 0);
                const returnsTotal = poReturns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
                const totalAmount = Math.max(0, originalTotal - returnsTotal);
                let existingPaid = 0;
                try {
                  const parsed = JSON.parse(viewingPO.paymentMethod || '[]');
                  if (Array.isArray(parsed)) {
                    existingPaid = parsed.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                  }
                } catch {}
                const newPaid = Object.values(recordPaymentMethods)
                  .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
                const remaining = Math.max(0, totalAmount - existingPaid - newPaid);
                return (
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div>
                        <span className="text-muted-foreground">Balance Due:</span>{" "}
                        <span className="font-bold text-sm">{sym}{Math.max(0, totalAmount - existingPaid).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Paying Now:</span>{" "}
                        <span className="font-bold text-sm text-green-600">{sym}{newPaid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">After Payment:</span>{" "}
                        <span className={`font-bold text-sm ${remaining > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          ${remaining.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <Label className="text-xs font-semibold">Select Payment Modes</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(['cash', 'card', 'mobile', 'bank_transfer', 'credit_note'] as const).map((method) => {
                    const handleToggle = (active: boolean) => {
                      setRecordPaymentMethods(prev => {
                        const newState = { ...prev };
                        if (active) {
                          // Auto-fill remaining
                          const originalTotal = Number(viewingPO?.totalAmount || 0);
                const returnsTotal = poReturns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
                const totalAmount = Math.max(0, originalTotal - returnsTotal);
                          let existingPaid = 0;
                          try {
                            const parsed = JSON.parse(viewingPO.paymentMethod || '[]');
                            if (Array.isArray(parsed)) {
                              existingPaid = parsed.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                            }
                          } catch {}
                          const currentNewPaid = Object.values(prev)
                            .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
                          const rem = Math.max(0, totalAmount - existingPaid - currentNewPaid);
                          newState[method] = { ...prev[method], active: true, amount: rem > 0 ? rem.toFixed(2) : '' };
                        } else {
                          newState[method] = { ...prev[method], active: false, amount: '', reference: '' };
                        }
                        return newState;
                      });
                    };
                    const handleUpdate = (field: 'amount' | 'reference', value: string) => {
                      setRecordPaymentMethods(prev => ({
                        ...prev,
                        [method]: { ...prev[method], [field]: value }
                      }));
                    };
                    return (
                      <div key={method} className="space-y-2 border rounded p-2.5 bg-muted/20">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`rec-pay-${method}`}
                            checked={recordPaymentMethods[method]?.active}
                            onCheckedChange={(checked) => handleToggle(checked === true)}
                          />
                          <Label htmlFor={`rec-pay-${method}`} className="capitalize flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                            {method === 'cash' && <Banknote className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'card' && <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'mobile' && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method === 'bank_transfer' && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                              {method === 'credit_note' && <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
                            {method.replace('_', ' ')}
                          </Label>
                        </div>
                        {recordPaymentMethods[method]?.active && (
                          <div className="grid grid-cols-1 gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={recordPaymentMethods[method].amount}
                              onChange={(e) => handleUpdate('amount', e.target.value)}
                              className="h-9 text-sm"
                            />
                            <Input
                              type="text"
                              placeholder="Ref # (optional)"
                              value={recordPaymentMethods[method].reference}
                              onChange={(e) => handleUpdate('reference', e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
            <Button
              disabled={isRecordingPayment}
              onClick={async () => {
                const payments = Object.entries(recordPaymentMethods)
                  .filter(([_, m]) => m.active && (parseFloat(m.amount) || 0) > 0)
                  .map(([method, m]) => ({
                    method: method.toUpperCase(),
                    amount: parseFloat(m.amount) || 0,
                    reference: m.reference || ''
                  }));
                if (payments.length === 0) {
                  toast.error('Please add at least one payment with an amount');
                  return;
                }
                setIsRecordingPayment(true);
                try {
                  await apiFetch(`/api/purchase-orders/${viewingPO.id}/payments`, {
                    method: 'POST',
                    body: JSON.stringify(payments),
                  });
                  toast.success('Payment recorded successfully');
                  setIsRecordPaymentOpen(false);
                  setIsViewingPO(false);
                  fetchPurchasingData();
                  await refreshData();
                } catch (error) {
                  toast.error('Failed to record payment');
                } finally {
                  setIsRecordingPayment(false);
                }
              }}
            >
              {isRecordingPayment ? 'Recording...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setIsSupplierDialogOpen(false)} disabled={isSavingSupplier}>Cancel</Button>
            <Button onClick={handleSaveSupplier} disabled={isSavingSupplier}>
              {isSavingSupplier ? 'Saving...' : 'Save Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel PO Dialog */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancel / Return Items</DialogTitle>
            <DialogDescription>
              Select the quantities to return for PO: <span className="font-semibold text-foreground">{viewingPO?.journalNumber}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_100px_100px] gap-2 px-3 py-2 text-xs font-semibold bg-muted uppercase tracking-wider text-muted-foreground border-b">
                <span>Product</span>
                <span className="text-right">Max Qty</span>
                <span className="text-right">Return Qty</span>
                <span className="text-right">Refund Val</span>
              </div>
              <div className="divide-y max-h-[40vh] overflow-y-auto">
                {cancelReturnItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px] gap-2 px-3 py-3 text-sm items-center hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{sym}{item.price.toFixed(2)} each</p>
                    </div>
                    <p className="text-right text-muted-foreground">{item.maxQty}</p>
                    <div>
                      <Input 
                        type="number" 
                        min="0" 
                        max={item.maxQty}
                        value={item.returnQty || ''}
                        onChange={(e) => {
                          const val = Math.min(item.maxQty, Math.max(0, Number(e.target.value) || 0));
                          setCancelReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: val } : it));
                        }}
                        className="h-8 text-right"
                      />
                    </div>
                    <p className="text-right font-semibold text-red-500">
                      {sym}{(item.returnQty * item.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-muted/20 border-t">
                <span className="font-semibold text-sm">Total Cancel Amount</span>
                <span className="font-bold text-lg text-red-500">{sym}{calculatedCancelAmount.toFixed(2)}</span>
              </div>
            </div>

            {(() => {
              const poTotal = Number(viewingPO?.totalAmount || 0);
              const returnsTotal = poReturns.reduce((sum: number, r: any) => sum + Number(r.refundAmount || 0), 0);
              const effectiveTotal = Math.max(0, poTotal - returnsTotal);
              
              const previousExcess = Math.max(0, viewingPOTotalPaid - effectiveTotal);
              const newEffectiveTotal = Math.max(0, effectiveTotal - calculatedCancelAmount);
              const currentExcess = Math.max(0, viewingPOTotalPaid - newEffectiveTotal);
              const newlyGeneratedExcess = currentExcess - previousExcess;
              
              if (calculatedCancelAmount > 0 && newlyGeneratedExcess > 0) {
                return (
                  <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 space-y-3">
                    <h4 className="font-medium text-sm text-blue-900 dark:text-blue-300">Excess Payment Detected</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-400">
                      This purchase was already paid. Returning these items results in a NEW overpayment of <strong>{sym}{(newlyGeneratedExcess).toFixed(2)}</strong>. How would you like to handle it?
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div 
                        className={`border rounded p-3 cursor-pointer transition-colors ${refundMode === 'PREPAYMENT' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}
                        onClick={() => setRefundMode('PREPAYMENT')}
                      >
                        <p className="font-semibold text-sm">Save as Prepayment</p>
                        <p className="text-xs text-muted-foreground mt-1">Creates a supplier credit for future use.</p>
                      </div>
                      <div 
                        className={`border rounded p-3 cursor-pointer transition-colors ${refundMode === 'REFUND' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}
                        onClick={() => setRefundMode('REFUND')}
                      >
                        <p className="font-semibold text-sm">Process Refund</p>
                        <p className="text-xs text-muted-foreground mt-1">Records cash returned from supplier.</p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

          </div>

          <DialogFooter className="mt-4 border-t pt-3 flex justify-between">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Close</Button>
            <Button variant="destructive" onClick={submitCancelPO} disabled={isCancelling || calculatedCancelAmount <= 0}>
              {isCancelling ? 'Processing...' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}