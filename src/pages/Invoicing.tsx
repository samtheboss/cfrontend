import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';
import { PdfPreviewDialog } from '@/components/receipts/PdfPreviewDialog';
import { usePdfPreview } from '@/hooks/usePdfPreview';
import type { DocumentType, InvoiceListItem, Product, ProductVariant } from '@/types/inventory';
import {
  Search, Trash2, User, UserPlus, X, ChevronsUpDown, Check, Plus,
  FileText, Printer, Wallet, Ban, Pause, RotateCcw, Calculator as CalculatorIcon,
  Eye, Undo2, Minus, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface CartLine {
  cartItemId: string;
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  taxRate: number;
}

const emptyCustomerBalance = { totalInvoiced: 0, totalPaid: 0, currentBalance: 0 };

export default function Invoicing() {
  const { products, locations, customers, addCustomer, activeOrders, holdOrder, discardOrder, settings, createReturn, checkReturnableItems, refreshData } = useInventory();
  const { sym, fmt, computeTax, vatInclusive } = useCurrency();
  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const canView = (right: keyof import('@/types/user').UserRights) => !rights || rights[right] !== 'no';
  const fmtNum = (n: number) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [documentType, setDocumentType] = useState<DocumentType>('SALE_INVOICE');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [customerBalance, setCustomerBalance] = useState(emptyCustomerBalance);

  const mainLocation = locations.find(l => l.isMain) || locations[0];
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  useEffect(() => {
    if (!selectedLocationId && mainLocation) setSelectedLocationId(mainLocation.id);
  }, [mainLocation, selectedLocationId]);
  const selectedLocation = locations.find(l => l.id === selectedLocationId) || null;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSortBy, setItemSortBy] = useState<'name' | 'price'>('name');
  const [itemPageSize, setItemPageSize] = useState(50);
  const [itemPage, setItemPage] = useState(1);

  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [salesPerson, setSalesPerson] = useState('');
  const [reference, setReference] = useState('');
  const [tradeDiscount, setTradeDiscount] = useState('0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcValue, setCalcValue] = useState('0');

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | DocumentType | 'RETURN'>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyUserFilter, setHistoryUserFilter] = useState('ALL');
  const [payingInvoice, setPayingInvoice] = useState<InvoiceListItem | null>(null);

  // View items / return
  const [viewingInvoice, setViewingInvoice] = useState<{ invoice: any; sale: any } | null>(null);
  const [viewingReturn, setViewingReturn] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnableLimits, setReturnableLimits] = useState<Record<string, { original: number; returned: number; remaining: number }>>({});
  const [returnItems, setReturnItems] = useState<{ variantId: string; sku: string; productName: string; quantity: number; price: number; taxRate: number }[]>([]);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnRefundMode, setReturnRefundMode] = useState<'REFUND' | 'PREPAYMENT'>('REFUND');
  const [ledgerRemaining, setLedgerRemaining] = useState(0);

  // Flattened variant list for item search
  const variantOptions = useMemo(() => {
    const list: { product: Product; variant: ProductVariant }[] = [];
    products.filter(p => p.isActive !== false).forEach(p => {
      p.variants.filter(v => v.isActive !== false).forEach(v => list.push({ product: p, variant: v }));
    });
    return list;
  }, [products]);

  const filteredItemOptions = useMemo(() => {
    let list = variantOptions;
    const tokens = itemSearchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      list = list.filter(({ product, variant }) => {
        const haystack = [
          product.name,
          variant.sku,
          variant.barcode,
          ...Object.values(variant.attributes || {}),
        ].filter(Boolean).join(' ').toLowerCase();
        // Every search word must appear somewhere, in any order - "soda fanta" matches "Fanta Soda"
        return tokens.every(tok => haystack.includes(tok));
      });
    }
    list = [...list].sort((a, b) => itemSortBy === 'price'
      ? a.variant.price - b.variant.price
      : a.product.name.localeCompare(b.product.name));
    return list;
  }, [variantOptions, itemSearchQuery, itemSortBy]);

  const itemTotalPages = Math.max(1, Math.ceil(filteredItemOptions.length / itemPageSize));
  const paginatedItemOptions = filteredItemOptions.slice((itemPage - 1) * itemPageSize, itemPage * itemPageSize);

  useEffect(() => { setItemPage(1); }, [itemSearchQuery, itemSortBy, itemPageSize]);

  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [selectedItemTier, setSelectedItemTier] = useState<'retail' | 'wholesale' | 'special' | 'trade'>('retail');

  const tierPrice = (variant: ProductVariant, tier: typeof selectedItemTier) => {
    if (tier === 'wholesale') return variant.wholesalePrice ?? variant.price;
    if (tier === 'special') return variant.specialPrice ?? variant.price;
    if (tier === 'trade') return variant.tradePrice ?? variant.price;
    return variant.price;
  };

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerBalance(emptyCustomerBalance);
      return;
    }
    apiFetch<{ data: any }>(`/api/customer-ledger/${selectedCustomerId}/balance`)
      .then(res => setCustomerBalance({
        totalInvoiced: res.data?.totalInvoiced || 0,
        totalPaid: res.data?.totalPaid || 0,
        currentBalance: res.data?.currentBalance || 0,
      }))
      .catch(() => setCustomerBalance(emptyCustomerBalance));
  }, [selectedCustomerId]);

  const totals = useMemo(() => {
    const raw = cart.reduce((acc, item) => {
      const t = computeTax(item.quantity, item.price, item.taxRate ?? 16.0);
      return {
        subtotal: acc.subtotal + t.subtotal,
        tax: acc.tax + t.tax,
      };
    }, { subtotal: 0, tax: 0 });
    const discount = parseFloat(tradeDiscount) || 0;
    const total = Math.max(0, raw.subtotal - discount + raw.tax);
    return { subtotal: raw.subtotal, tax: raw.tax, discount, total };
  }, [cart, tradeDiscount, vatInclusive]);

  const creditLimit = selectedCustomer?.creditLimit;
  const closingBalance = customerBalance.currentBalance + totals.total;
  const overLimit = documentType === 'SALE_INVOICE' && creditLimit != null && creditLimit > 0 && closingBalance > creditLimit;

  const addToCart = (variant: ProductVariant, product: Product, unitPrice?: number) => {
    const price = unitPrice ?? variant.price;
    const availableStock = variant.locationStock?.[selectedLocationId] ?? variant.stock ?? 0;
    const allowNegative = settings?.allowNegativeStock ?? false;
    const skipStockCheck = (variant as any).hasRecipe;

    if (availableStock <= 0 && !allowNegative && !skipStockCheck) {
      toast.error(`No stock available at ${selectedLocation?.name || 'selected location'}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(l => l.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= availableStock && !allowNegative && !skipStockCheck) {
          toast.error(`Cannot add more. Only ${availableStock} in stock at ${selectedLocation?.name || 'selected location'}`);
          return prev;
        }
        return prev.map(l => l.variantId === variant.id ? { ...l, quantity: l.quantity + 1, price } : l);
      }
      return [...prev, {
        cartItemId: `${variant.id}-${Date.now()}`,
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name + (Object.values(variant.attributes || {}).length ? ` (${Object.values(variant.attributes).join(' / ')})` : ''),
        quantity: 1,
        price,
        taxRate: (variant as any).taxRate ?? (product as any).taxRate ?? 16.0,
      }];
    });
  };

  const confirmItemPicker = () => {
    if (!selectedItemKey) return;
    const found = filteredItemOptions.find(({ variant }) => variant.id === selectedItemKey);
    if (!found) return;
    addToCart(found.variant, found.product, tierPrice(found.variant, selectedItemTier));
    setItemPickerOpen(false);
    setSelectedItemKey(null);
    setSelectedItemTier('retail');
    setItemSearchQuery('');
  };

  const updateLine = (cartItemId: string, patch: Partial<CartLine>) => {
    setCart(prev => prev.map(l => {
      if (l.cartItemId !== cartItemId) return l;
      if (patch.quantity !== undefined) {
        const variant = variantOptions.find(o => o.variant.id === l.variantId)?.variant;
        const availableStock = variant ? (variant.locationStock?.[selectedLocationId] ?? variant.stock ?? 0) : Infinity;
        const allowNegative = settings?.allowNegativeStock ?? false;
        const skipStockCheck = variant ? (variant as any).hasRecipe : false;
        if (patch.quantity > availableStock && !allowNegative && !skipStockCheck) {
          toast.error(`Cannot exceed available stock (${availableStock})`);
          return { ...l, ...patch, quantity: availableStock };
        }
      }
      return { ...l, ...patch };
    }));
  };

  const removeLine = (cartItemId: string) => setCart(prev => prev.filter(l => l.cartItemId !== cartItemId));

  const resetForm = () => {
    setCart([]);
    setSelectedCustomerId(null);
    setTradeDiscount('0');
    setDueDate('');
    setReference('');
    setSalesPerson('');
    setOrderDate(format(new Date(), 'yyyy-MM-dd'));
    setLastInvoiceNumber(null);
  };

  const buildSalePayload = (status: 'COMPLETED' | 'PAYMENT_PENDING', payments: PaymentDetails[] = []) => ({
    type: 'SALE',
    locationId: selectedLocationId,
    customerId: selectedCustomer ? Number(selectedCustomer.id) : null,
    status,
    subtotal: totals.subtotal,
    taxAmount: totals.tax,
    discountAmount: totals.discount,
    totalAmount: totals.total,
    paymentMethod: payments.map(p => p.method).join(', ') || undefined,
    payments: payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference, glAccountId: p.glAccountId })),
    idempotencyKey: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    items: cart.map(item => ({
      variantId: item.variantId,
      sku: item.sku,
      productName: item.productName,
      adjustment: -item.quantity,
      price: item.price,
      taxRate: item.taxRate ?? 16.0,
      taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
    })),
  });

  const createInvoice = async (status: 'COMPLETED' | 'PAYMENT_PENDING', payments: PaymentDetails[] = []) => {
    if (cart.length === 0) {
      toast.error('Add at least one item first');
      return;
    }
    if (!selectedLocationId) {
      toast.error('Select a location');
      return;
    }
    if (documentType === 'SALE_INVOICE' && !selectedCustomer) {
      toast.error('A customer is required for a credit Sale Invoice');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await apiFetch<{ data: { invoice: { invoiceNumber: string }; sale: any } }>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          sale: buildSalePayload(status, payments),
          documentType,
          salesPerson: salesPerson || undefined,
          reference: reference || undefined,
          dueDate: documentType === 'SALE_INVOICE' && dueDate ? dueDate : undefined,
        }),
      });
      const invoiceNumber = result.data.invoice.invoiceNumber;
      setLastInvoiceNumber(invoiceNumber);
      toast.success(`${documentType === 'CASH_SALE' ? 'Cash sale' : 'Invoice'} ${invoiceNumber} created`);
      setCart([]);
      loadInvoices();
      refreshData?.();
      // Auto preview/print the same way POS does right after checkout, driven by the autoPrintReceipts setting
      printInvoice(invoiceNumber);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
      setPaymentDialogOpen(false);
    }
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    holdOrder({
      id: `invoicing-${Date.now()}`,
      customer: selectedCustomer,
      items: cart.map(l => ({
        cartItemId: l.cartItemId, variantId: l.variantId, productName: l.productName,
        variantSku: l.sku, attributes: {}, quantity: l.quantity, price: l.price, maxStock: 999999,
      })),
      timestamp: new Date(),
      note: `Invoicing draft (${documentType})`,
    });
    toast.success('Order held');
    resetForm();
  };

  const resumeHeldOrder = (orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) return;
    setSelectedCustomerId(order.customer?.id || null);
    setCart(order.items.map(item => ({
      cartItemId: item.cartItemId || `${item.variantId}-${Date.now()}`,
      variantId: item.variantId,
      sku: item.variantSku,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      taxRate: 16.0,
    })));
    discardOrder(orderId);
  };

  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const [invoicesRes, returnsRes] = await Promise.all([
        apiFetch<{ data: InvoiceListItem[] }>('/api/invoices'),
        apiFetch<{ data: any[] }>('/api/transactions?type=RETURN'),
      ]);
      setInvoices(invoicesRes.data || []);
      setReturns(returnsRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load invoices: ' + err.message);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  // Unified history rows - invoices/cash sales plus the returns processed against them, so Invoice
  // History shows the full picture instead of just what was originally sold.
  const historyRows = useMemo(() => {
    const invoiceRows = invoices.map(inv => ({
      kind: 'invoice' as const,
      key: inv.invoiceNumber,
      docNumber: inv.invoiceNumber,
      documentType: inv.documentType as string,
      customerId: inv.customerId,
      date: inv.orderDate,
      dueDate: inv.dueDate,
      total: inv.totalAmount,
      paid: inv.amountPaid,
      balance: inv.balance,
      status: inv.status,
      createdBy: inv.createdBy,
      searchText: `${inv.invoiceNumber} ${inv.reference || ''}`.toLowerCase(),
      raw: inv,
    }));
    const returnRows = returns.map(ret => {
      const matchedInvoice = invoices.find(inv => inv.saleId === ret.originalSaleId);
      return {
        kind: 'return' as const,
        key: ret.journalNumber,
        docNumber: ret.journalNumber,
        documentType: 'RETURN',
        customerId: matchedInvoice?.customerId,
        date: ret.timestamp ? String(ret.timestamp).slice(0, 10) : '',
        dueDate: undefined as string | undefined,
        total: ret.totalAmount ?? ret.refundAmount ?? 0,
        paid: undefined as number | undefined,
        balance: undefined as number | undefined,
        status: 'RETURNED',
        createdBy: ret.createdBy,
        searchText: `${ret.journalNumber} ${matchedInvoice?.invoiceNumber || ''}`.toLowerCase(),
        raw: ret,
        againstInvoiceNumber: matchedInvoice?.invoiceNumber,
      };
    });
    return [...invoiceRows, ...returnRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [invoices, returns]);

  const historyUsers = useMemo(() => {
    const names = new Set<string>();
    historyRows.forEach(row => { if (row.createdBy) names.add(row.createdBy); });
    return Array.from(names).sort();
  }, [historyRows]);

  const filteredHistoryRows = historyRows.filter(row => {
    if (historySearch && !row.searchText.includes(historySearch.toLowerCase())) return false;
    if (historyTypeFilter !== 'ALL' && row.documentType !== historyTypeFilter) return false;
    if (historyStartDate && row.date && row.date < historyStartDate) return false;
    if (historyEndDate && row.date && row.date > historyEndDate) return false;
    if (historyUserFilter !== 'ALL' && row.createdBy !== historyUserFilter) return false;
    return true;
  });

  const customerName = (id?: number) => customers.find(c => Number(c.id) === id)?.name || 'Walk-in Customer';

  // Shared PDF preview/print popup (reused for invoices, receipts, and statements across pages)
  const pdfPreview = usePdfPreview();

  const printInvoice = async (invoiceNumber: string) => {
    await pdfPreview.showPdf(`${getBaseUrl()}/api/invoices/${invoiceNumber}/pdf`, { title: 'Invoice Preview' });
  };

  const submitPayment = async (invoiceNumber: string, payments: PaymentDetails[]) => {
    await apiFetch(`/api/invoices/${invoiceNumber}/receive-payment`, {
      method: 'POST',
      body: JSON.stringify(payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference, glAccountId: p.glAccountId }))),
    });
    toast.success('Payment received! Invoice completed.');
    setPayingInvoice(null);
    loadInvoices();
    // Same as POS - auto preview/print the receipt right after payment is received
    printInvoice(invoiceNumber);
  };

  const openInvoiceDetail = async (invoiceNumber: string) => {
    setViewLoading(true);
    try {
      const res = await apiFetch<{ data: { invoice: any; sale: any } }>(`/api/invoices/${invoiceNumber}`);
      setViewingInvoice(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load invoice details');
    } finally {
      setViewLoading(false);
    }
  };

  // Return flow - mirrors POS.tsx's handleOpenReturn/handleReturnAmountChange/calculateReturnTotal/submitReturn,
  // scoped to the single invoice currently open in the view dialog.
  const openReturnDialog = async () => {
    const sale = viewingInvoice?.sale;
    if (!sale) return;
    if (sale.status !== 'COMPLETED' && sale.status !== 'PAYMENT_PENDING') {
      toast.error('This sale cannot be returned');
      return;
    }

    const limits = await checkReturnableItems(Number(sale.id));
    const limitMap: Record<string, { original: number; returned: number; remaining: number }> = {};
    limits.forEach((l: any) => {
      limitMap[l.variantId] = { original: l.originalQty, returned: l.returnedQty, remaining: l.remainingQty };
    });
    setReturnableLimits(limitMap);

    // True, ledger-based amount still genuinely unpaid on this invoice right now - used to preview the
    // matched/excess split accurately. Sale.amountPaid isn't reliable for this: it also counts
    // credit-note-driven "settled via return" amounts from earlier returns, not just real cash.
    try {
      const remainingRes = await apiFetch<{ data: number }>(`/api/customer-ledger/by-sale/${sale.id}/remaining`);
      setLedgerRemaining(remainingRes.data || 0);
    } catch {
      setLedgerRemaining(0);
    }

    const uniqueItems = new Map<string, { variantId: string; sku: string; productName: string; quantity: number; price: number; taxRate: number }>();
    (sale.items || []).forEach((item: any) => {
      if (!uniqueItems.has(item.variantId)) {
        uniqueItems.set(item.variantId, {
          variantId: item.variantId,
          sku: item.sku,
          productName: item.productName,
          quantity: 0,
          price: item.price,
          taxRate: item.taxRate ?? 16.0,
        });
      }
    });

    setReturnItems(Array.from(uniqueItems.values()).filter(item => (limitMap[item.variantId]?.remaining || 0) > 0));
    setReturnRefundMode('REFUND');
    setReturnDialogOpen(true);
  };

  const updateReturnQty = (variantId: string, quantity: number) => {
    const max = returnableLimits[variantId]?.remaining || 0;
    const qty = Math.max(0, Math.min(quantity, max));
    setReturnItems(prev => prev.map(item => item.variantId === variantId ? { ...item, quantity: qty } : item));
  };

  const calculateReturnTotal = () => {
    const sale = viewingInvoice?.sale;
    if (!sale) return 0;
    // Detect whether the original sale's line prices already included tax (same heuristic as POS.tsx)
    const sumOriginalPrices = (sale.items || []).reduce((sum: number, item: any) => sum + ((item.price || 0) * Math.abs(item.adjustment)), 0);
    const originalTotal = sale.totalAmount || sale.total || 0;
    const isOriginalSaleInclusive = Math.abs(originalTotal - sumOriginalPrices) < 0.1;

    return returnItems.reduce((sum, item) => {
      const amount = item.price * item.quantity;
      if (isOriginalSaleInclusive) return sum + amount;
      const rate = (item.taxRate ?? 16.0) / 100;
      return sum + amount + (amount * rate);
    }, 0);
  };

  // Splits the return total the same way the backend does: whatever's still genuinely unpaid on the
  // invoice right now (per the customer ledger, not Sale.amountPaid) is credited against that balance
  // automatically (no choice needed), and only the rest - money that was actually already collected -
  // needs a refund-or-prepayment decision. e.g. a 1000 invoice with 500 paid, returned in full: 500 of
  // the 1000 was never collected (credited straight to the balance), and the other 500 is what
  // "Refund" vs "Prepayment" applies to. Using the live ledger remaining (fetched when the dialog
  // opens) rather than Sale.amountPaid matters for a *second* return on the same invoice - an earlier
  // return's credit note bumps amountPaid without any real cash changing hands, which would otherwise
  // make this return think that phantom amount needs settling too.
  const getReturnSplit = () => {
    const total = calculateReturnTotal();
    const credited = Math.min(total, ledgerRemaining);
    const alreadyPaid = Math.max(0, total - credited);
    return { total, alreadyPaid, credited };
  };

  const submitReturn = async () => {
    const sale = viewingInvoice?.sale;
    if (!sale) return;
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }

    setIsProcessingReturn(true);
    try {
      await createReturn({
        type: 'RETURN',
        originalSaleId: sale.id,
        idempotencyKey: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        items: itemsToReturn.map(item => ({
          variantId: item.variantId,
          adjustment: item.quantity,
          price: item.price,
        })),
        refundAmount: calculateReturnTotal(),
        refundMethod: sale.paymentMethod || 'CASH',
        refundMode: returnRefundMode,
      });
      setReturnDialogOpen(false);
      setReturnItems([]);
      loadInvoices();
      // Refresh the open invoice detail so the item list / balance reflect the return
      openInvoiceDetail(viewingInvoice!.invoice.invoiceNumber);
    } catch (err) {
      // createReturn already toasts the error
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const calcButtons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];

  // Safe arithmetic evaluator (no eval): tokenize + shunting-yard for +-*/ with precedence.
  const evalArithmetic = (expr: string): number => {
    const tokens = expr.match(/\d+\.?\d*|[+\-*/]/g);
    if (!tokens || tokens.length === 0) throw new Error('empty');
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const values: number[] = [];
    const ops: string[] = [];
    const apply = () => {
      const op = ops.pop()!;
      const b = values.pop()!;
      const a = values.pop()!;
      if (op === '+') values.push(a + b);
      else if (op === '-') values.push(a - b);
      else if (op === '*') values.push(a * b);
      else values.push(b === 0 ? NaN : a / b);
    };
    for (const tok of tokens) {
      if (precedence[tok]) {
        while (ops.length && precedence[ops[ops.length - 1]] >= precedence[tok]) apply();
        ops.push(tok);
      } else {
        values.push(parseFloat(tok));
      }
    }
    while (ops.length) apply();
    if (values.length !== 1 || Number.isNaN(values[0])) throw new Error('invalid');
    return values[0];
  };

  const handleCalcButton = (btn: string) => {
    if (btn === '=') {
      try {
        setCalcValue(String(evalArithmetic(calcValue)));
      } catch {
        setCalcValue('Error');
      }
      return;
    }
    setCalcValue(prev => (prev === '0' || prev === 'Error' ? btn : prev + btn));
  };

  return (
    <AppLayout title="Invoicing">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="history">Invoice History</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-3 mt-3">
            {/* Top bar - sticky so document type/customer/location/balance stay visible while scrolling */}
            <Card className={cn('sticky top-28 z-20', overLimit && 'border-destructive')}>
              <CardContent className="py-2 flex flex-wrap items-center gap-2">
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                  <SelectTrigger className="w-44 font-semibold h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALE_INVOICE">Credit Sales</SelectItem>
                    <SelectItem value="CASH_SALE">Cash Sale</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-1 flex-1 min-w-[220px]">
                  <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="flex-1 justify-start h-9">
                        <User className="h-4 w-4 mr-2" />
                        {selectedCustomer ? selectedCustomer.name : 'Select customer...'}
                        <ChevronsUpDown className="h-3 w-3 ml-auto opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customers..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers.filter(c => !c.customerType || c.customerType === 'POS' || c.customerType === 'BOTH').map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => { setSelectedCustomerId(customer.id); setCustomerPopoverOpen(false); }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', selectedCustomerId === customer.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col">
                                  <span>{customer.name}</span>
                                  {customer.phone && <span className="text-xs text-muted-foreground">{customer.phone}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedCustomer && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedCustomerId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Balance / credit limit - same line as the customer field */}
                {selectedCustomer && (
                  <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                    <span><span className="text-muted-foreground">Bal: </span><span className="font-semibold">{fmt(customerBalance.currentBalance)}</span></span>
                    <span><span className="text-muted-foreground">After: </span><span className={cn('font-semibold', overLimit && 'text-destructive')}>{fmt(closingBalance)}</span></span>
                    <span><span className="text-muted-foreground">Limit: </span><span className="font-semibold">{creditLimit != null ? fmt(creditLimit) : 'N/A'}</span></span>
                    {overLimit && <Badge variant="destructive" className="h-5 text-[10px]">Over limit</Badge>}
                  </div>
                )}

                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="ml-auto text-right">
                  <div className="text-[10px] text-muted-foreground leading-none">Order No</div>
                  <div className="font-mono font-semibold text-sm">{lastInvoiceNumber || 'New Invoice'}</div>
                </div>
              </CardContent>
              <CardContent className="pt-0 pb-3">
                <div className="relative w-[800px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search item name, barcode, item code"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (itemSearchQuery.trim() && filteredItemOptions.length === 1) {
                        const { product, variant } = filteredItemOptions[0];
                        addToCart(variant, product);
                        toast.success(`Added ${product.name} to cart`);
                        setItemSearchQuery('');
                      } else {
                        setItemPickerOpen(true);
                      }
                    }}
                    className="pl-9 pr-11 h-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setItemPickerOpen(true)}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              {/* Left: items */}
              <div className="lg:col-span-2 space-y-3">
                <Card>
                  <CardContent className="p-0">
                    <div className="sticky top-56 z-10 bg-card grid grid-cols-[1fr_70px_80px_70px_80px_28px] gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground border-b rounded-t-lg">
                      <div>Item</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Tax %</div>
                      <div className="text-right">Total</div>
                      <div />
                    </div>
                    {cart.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-sm">No items added yet</div>
                    ) : cart.map(line => {
                      const t = computeTax(line.quantity, line.price, line.taxRate ?? 16.0);
                      const cartVariant = variantOptions.find(o => o.variant.id === line.variantId)?.variant;
                      const cartStock = cartVariant ? (cartVariant.locationStock?.[selectedLocationId] ?? cartVariant.stock ?? 0) : null;
                      return (
                        <div key={line.cartItemId} className="grid grid-cols-[1fr_70px_80px_70px_80px_28px] gap-1.5 px-2 py-1 items-center border-b last:border-b-0">
                          <div className="min-w-0 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{line.productName}</div>
                              <div className="text-xs text-muted-foreground truncate">{line.sku}</div>
                            </div>
                            {canView('viewItemStock') && cartStock !== null && (
                              <div className={cn('text-xs whitespace-nowrap shrink-0', cartStock <= 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                Stock: {cartStock}
                              </div>
                            )}
                          </div>
                          <Input type="number" min="0" value={line.quantity}
                            onChange={(e) => updateLine(line.cartItemId, { quantity: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-right px-1.5" />
                          <Input type="number" min="0" value={line.price}
                            onChange={(e) => updateLine(line.cartItemId, { price: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-right px-1.5" />
                          <Input type="number" min="0" value={line.taxRate}
                            onChange={(e) => updateLine(line.cartItemId, { taxRate: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-right px-1.5" />
                          <div className="text-sm text-right font-medium">{fmt(t.total)}</div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(line.cartItemId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {activeOrders.length > 0 && (
                  <Card>
                    <CardHeader className="py-2"><CardTitle className="text-sm">Held Orders</CardTitle></CardHeader>
                    <CardContent className="py-2 space-y-1">
                      {activeOrders.map(order => (
                        <div key={order.id} className="flex items-center justify-between text-sm py-1">
                          <span>{order.customer?.name || 'Walk-in'} — {order.items.length} item(s)</span>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => resumeHeldOrder(order.id)}>Resume</Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => discardOrder(order.id)}>Discard</Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right: order details - sticky below the sticky top bar, stays visible while the item list scrolls */}
              <div className="space-y-2 lg:sticky lg:top-56 lg:self-start lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
                <Card>
                  <Tabs defaultValue="details">
                    <CardHeader className="pb-0">
                      <TabsList className="w-full">
                        <TabsTrigger value="details" className="flex-1">Order Details</TabsTrigger>
                        <TabsTrigger value="extra" className="flex-1">Order Extra</TabsTrigger>
                      </TabsList>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2">
                      <TabsContent value="details" className="space-y-2 mt-0">
                        <div className={cn('grid gap-2', documentType === 'SALE_INVOICE' ? 'grid-cols-2' : 'grid-cols-1')}>
                          <div className="space-y-1">
                            <Label className="text-xs">Order Date</Label>
                            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-9" />
                          </div>
                          {documentType === 'SALE_INVOICE' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Due Date</Label>
                              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Trade Discount</Label>
                          <Input type="number" min="0" value={tradeDiscount} onChange={(e) => setTradeDiscount(e.target.value)} className="h-9" />
                        </div>
                      </TabsContent>
                      <TabsContent value="extra" className="space-y-2 mt-0">
                        <div className="space-y-1">
                          <Label className="text-xs">Sales Person</Label>
                          <Input value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)} placeholder="Optional" className="h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Reference</Label>
                          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className="h-9" />
                        </div>
                      </TabsContent>
                    </CardContent>
                  </Tabs>
                </Card>

                <Card>
                  <CardContent className="py-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{fmt(totals.discount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{fmt(totals.tax)}</span></div>
                    <div className="flex justify-between text-base font-bold pt-1 border-t"><span>Total</span><span>{fmt(totals.total)}</span></div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={resetForm}><Plus className="h-4 w-4 mr-1" />New Order</Button>
                  <Button variant="outline" onClick={() => setCalculatorOpen(true)}><CalculatorIcon className="h-4 w-4 mr-1" />Calculator</Button>
                  <Button variant="outline" onClick={handleHoldOrder} disabled={cart.length === 0}><Pause className="h-4 w-4 mr-1" />Hold Order</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => setCart([])} disabled={cart.length === 0}><Ban className="h-4 w-4 mr-1" />Cancel Order</Button>

                  {documentType === 'CASH_SALE' ? (
                    <Button className="col-span-2" disabled={cart.length === 0 || isSubmitting} onClick={() => setPaymentDialogOpen(true)}>
                      <Wallet className="h-4 w-4 mr-1" />Pay Cash / Mob Money
                    </Button>
                  ) : (
                    <Button className="col-span-2" disabled={cart.length === 0 || isSubmitting} onClick={() => createInvoice('PAYMENT_PENDING')}>
                      <FileText className="h-4 w-4 mr-1" />{isSubmitting ? 'Approving...' : 'Approve Order'}
                    </Button>
                  )}

                  {lastInvoiceNumber && (
                    <Button variant="outline" className="col-span-2" onClick={() => printInvoice(lastInvoiceNumber)}>
                      <Printer className="h-4 w-4 mr-1" />Print {lastInvoiceNumber}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            <Card className="sticky top-28 z-20 bg-background">
              <CardContent className="py-3 flex flex-wrap items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search invoice #, reference..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={historyTypeFilter} onValueChange={(v) => setHistoryTypeFilter(v as any)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="SALE_INVOICE">Sale Invoice</SelectItem>
                    <SelectItem value="CASH_SALE">Cash Sale</SelectItem>
                    <SelectItem value="RETURN">Return</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                  <Input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="w-40" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                  <Input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="w-40" />
                </div>
                <Select value={historyUserFilter} onValueChange={setHistoryUserFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Approved By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Users</SelectItem>
                    {historyUsers.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(historySearch || historyTypeFilter !== 'ALL' || historyStartDate || historyEndDate || historyUserFilter !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setHistorySearch(''); setHistoryTypeFilter('ALL'); setHistoryStartDate(''); setHistoryEndDate(''); setHistoryUserFilter('ALL'); }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" className="ml-auto" onClick={loadInvoices} disabled={invoicesLoading}>
                  <RotateCcw className={cn('h-3.5 w-3.5 mr-1', invoicesLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistoryRows.map(row => (
                      <TableRow key={row.key} className={cn(row.kind === 'return' && 'bg-destructive/5')}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {row.docNumber}
                          {row.kind === 'return' && row.againstInvoiceNumber && (
                            <div className="text-[10px] font-normal text-muted-foreground">vs {row.againstInvoiceNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.kind === 'return' ? (
                            <Badge variant="destructive">
                              <Undo2 className="h-3 w-3 mr-1" />Return
                            </Badge>
                          ) : (
                            <Badge variant={row.documentType === 'CASH_SALE' ? 'secondary' : 'outline'}>
                              {row.documentType === 'CASH_SALE' ? 'Cash Sale' : 'Sale Invoice'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{customerName(row.customerId)}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.dueDate || '-'}</TableCell>
                        <TableCell className={cn('text-right', row.kind === 'return' && 'text-destructive')}>
                          {row.kind === 'return' ? `-${fmt(row.total || 0)}` : fmt(row.total || 0)}
                        </TableCell>
                        <TableCell className="text-right">{row.paid !== undefined ? fmt(row.paid) : '-'}</TableCell>
                        <TableCell className={cn('text-right font-medium', (row.balance || 0) > 0 && 'text-destructive')}>
                          {row.balance !== undefined ? fmt(row.balance) : '-'}
                        </TableCell>
                        <TableCell>
                          {row.kind === 'return' ? (
                            <Badge variant="outline">RETURNED</Badge>
                          ) : (
                            <Badge variant={row.status === 'COMPLETED' ? 'default' : 'secondary'}>
                              {row.status === 'PAYMENT_PENDING'
                                ? ((row.paid || 0) > 0 ? 'PARTIALLY PAID' : 'UNPAID')
                                : row.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.createdBy || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {row.kind === 'invoice' && row.status === 'PAYMENT_PENDING' && (
                              <Button variant="outline" size="sm" onClick={() => setPayingInvoice(row.raw)}>Receive Payment</Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => row.kind === 'return' ? setViewingReturn(row.raw) : openInvoiceDetail(row.docNumber)}
                              title="View items"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {row.kind === 'invoice' && (
                              <Button variant="ghost" size="sm" onClick={() => printInvoice(row.docNumber)} title="Print">
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredHistoryRows.length === 0 && !invoicesLoading && (
                      <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">No invoices found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Item Picker Dialog */}
      <Dialog open={itemPickerOpen} onOpenChange={(open) => { setItemPickerOpen(open); if (!open) { setSelectedItemKey(null); setSelectedItemTier('retail'); setItemSearchQuery(''); } }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Products
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30">
            <Label className="text-xs text-muted-foreground shrink-0">Location</Label>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search..."
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Table */}
          {(() => {
            const canRetail = canView('viewRetailPrice');
            const canWholesale = canView('viewWholesalePrice');
            const canSpecial = canView('viewSpecialPrice');
            const canTrade = canView('viewTradePrice');
            const canCost = canView('viewCostPrice');
            const canStock = canView('viewItemStock');
            const visibleColCount = 3 + [canStock, canRetail, canWholesale, canSpecial, canTrade, canCost].filter(Boolean).length;
            return (
              <div className="flex-1 overflow-auto">
                {/* Plain <table> (not the shared Table wrapper, which adds its own overflow-auto div and
                    breaks position:sticky on the header) so the column header can stick while scrolling */}
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-3">Product ID</TableHead>
                      <TableHead className="h-8 py-1.5 px-3">Product Name</TableHead>
                      <TableHead className="h-8 py-1.5 px-3">UOM</TableHead>
                      {canStock && <TableHead className="h-8 py-1.5 px-3 text-right">Stock</TableHead>}
                      {canRetail && <TableHead className="h-8 py-1.5 px-3 text-right">Retail</TableHead>}
                      {canWholesale && <TableHead className="h-8 py-1.5 px-3 text-right">Wholesale</TableHead>}
                      {canSpecial && <TableHead className="h-8 py-1.5 px-3 text-right">Special</TableHead>}
                      {canTrade && <TableHead className="h-8 py-1.5 px-3 text-right">Trade</TableHead>}
                      {canCost && <TableHead className="h-8 py-1.5 px-3 text-right">Cost</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItemOptions.map(({ product, variant }) => {
                      const isSelected = selectedItemKey === variant.id;
                      const variantLabel = product.name + (Object.values(variant.attributes || {}).length ? ` (${Object.values(variant.attributes).join(' / ')})` : '');
                      const stock = variant.locationStock?.[selectedLocationId] ?? variant.stock ?? 0;
                      const selectTier = (tier: typeof selectedItemTier) => {
                        setSelectedItemKey(variant.id);
                        setSelectedItemTier(tier);
                      };
                      return (
                        <TableRow
                          key={variant.id}
                          className={cn('cursor-pointer', isSelected && 'bg-primary/10')}
                          onClick={() => selectTier('retail')}
                          onDoubleClick={confirmItemPicker}
                        >
                          <TableCell className="py-1 px-3 font-mono text-xs">{variant.sku || variant.barcode}</TableCell>
                          <TableCell className="py-1 px-3 text-sm">{variantLabel}</TableCell>
                          <TableCell className="py-1 px-3 text-xs text-muted-foreground">{(product as any).unit || 'PCS'}</TableCell>
                          {canStock && (
                            <TableCell className={cn('py-1 px-3 text-right text-sm', stock <= 0 && 'text-destructive')}>{stock}</TableCell>
                          )}
                          {canRetail && (
                            <TableCell
                              onClick={(e) => { e.stopPropagation(); selectTier('retail'); }}
                              className={cn('py-1 px-3 text-right text-sm', isSelected && selectedItemTier === 'retail' && 'font-bold bg-primary/20 rounded')}
                            >{fmtNum(variant.price)}</TableCell>
                          )}
                          {canWholesale && (
                            <TableCell
                              onClick={(e) => { e.stopPropagation(); selectTier('wholesale'); }}
                              className={cn('py-1 px-3 text-right text-sm', isSelected && selectedItemTier === 'wholesale' && 'font-bold bg-primary/20 rounded')}
                            >{fmtNum(tierPrice(variant, 'wholesale'))}</TableCell>
                          )}
                          {canSpecial && (
                            <TableCell
                              onClick={(e) => { e.stopPropagation(); selectTier('special'); }}
                              className={cn('py-1 px-3 text-right text-sm', isSelected && selectedItemTier === 'special' && 'font-bold bg-primary/20 rounded')}
                            >{fmtNum(tierPrice(variant, 'special'))}</TableCell>
                          )}
                          {canTrade && (
                            <TableCell
                              onClick={(e) => { e.stopPropagation(); selectTier('trade'); }}
                              className={cn('py-1 px-3 text-right text-sm', isSelected && selectedItemTier === 'trade' && 'font-bold bg-primary/20 rounded')}
                            >{fmtNum(tierPrice(variant, 'trade'))}</TableCell>
                          )}
                          {canCost && (
                            <TableCell className="py-1 px-3 text-right text-sm text-muted-foreground">{fmtNum(variant.cost)}</TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {paginatedItemOptions.length === 0 && (
                      <TableRow><TableCell colSpan={visibleColCount} className="h-24 text-center text-muted-foreground">No products found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </table>
              </div>
            );
          })()}

          {/* Footer: sort/page-size/pagination + OK */}
          <DialogFooter className="p-3 border-t bg-card flex-row items-center justify-between sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Sort By</Label>
              <Select value={itemSortBy} onValueChange={(v) => setItemSortBy(v as any)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(itemPageSize)} onValueChange={(v) => setItemPageSize(Number(v))}>
                <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={itemPage <= 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>
                <ChevronsUpDown className="h-3 w-3 rotate-90" />
              </Button>
              <span className="text-xs text-muted-foreground">Page {itemPage} of {itemTotalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={itemPage >= itemTotalPages} onClick={() => setItemPage(p => Math.min(itemTotalPages, p + 1))}>
                <ChevronsUpDown className="h-3 w-3 -rotate-90" />
              </Button>
            </div>
            <Button onClick={confirmItemPicker} disabled={!selectedItemKey}>
              <Check className="h-4 w-4 mr-1" />Ok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Items Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => { if (!open) setViewingInvoice(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingInvoice?.invoice?.invoiceNumber}
              {viewingInvoice?.sale && (
                <Badge variant={viewingInvoice.sale.status === 'COMPLETED' ? 'default' : 'secondary'}>
                  {viewingInvoice.sale.status === 'PAYMENT_PENDING'
                    ? ((viewingInvoice.sale.amountPaid || 0) > 0 ? 'PARTIALLY PAID' : 'UNPAID')
                    : viewingInvoice.sale.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {customerName(viewingInvoice?.sale?.customerId)} &middot; {viewingInvoice?.invoice?.orderDate}
              {viewingInvoice?.invoice?.dueDate ? ` · Due ${viewingInvoice.invoice.dueDate}` : ''}
            </DialogDescription>
          </DialogHeader>

          {viewLoading && <div className="py-10 text-center text-muted-foreground text-sm">Loading...</div>}

          {!viewLoading && viewingInvoice && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-3">Item</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Qty</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Price</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewingInvoice.sale.items || []).map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5 px-3">
                          <div className="text-sm font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-right">{Math.abs(item.adjustment)}</TableCell>
                        <TableCell className="py-1.5 px-3 text-right">{fmt(item.price || 0)}</TableCell>
                        <TableCell className="py-1.5 px-3 text-right font-medium">{fmt((item.price || 0) * Math.abs(item.adjustment))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(viewingInvoice.sale.subtotal || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{fmt(viewingInvoice.sale.discountAmount || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{fmt(viewingInvoice.sale.taxAmount || 0)}</span></div>
                  <div className="flex justify-between font-bold pt-1 border-t"><span>Total</span><span>{fmt(viewingInvoice.sale.totalAmount || 0)}</span></div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{fmt(viewingInvoice.sale.amountPaid || 0)}</span></div>
                  <div className="flex justify-between font-bold pt-1 border-t">
                    <span>Balance</span>
                    <span className={cn(((viewingInvoice.sale.totalAmount || 0) - (viewingInvoice.sale.amountPaid || 0)) > 0 && 'text-destructive')}>
                      {fmt(Math.max(0, (viewingInvoice.sale.totalAmount || 0) - (viewingInvoice.sale.amountPaid || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {(viewingInvoice?.sale?.status === 'COMPLETED' || viewingInvoice?.sale?.status === 'PAYMENT_PENDING') && (
              <Button variant="outline" onClick={openReturnDialog}>
                <Undo2 className="h-4 w-4 mr-1" />Return Items
              </Button>
            )}
            <Button variant="outline" onClick={() => viewingInvoice && printInvoice(viewingInvoice.invoice.invoiceNumber)}>
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
            <Button onClick={() => setViewingInvoice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Return Details Dialog */}
      <Dialog open={!!viewingReturn} onOpenChange={(open) => { if (!open) setViewingReturn(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-destructive" />
              {viewingReturn?.journalNumber}
              <Badge variant="destructive">Return</Badge>
            </DialogTitle>
            <DialogDescription>
              {viewingReturn?.timestamp ? String(viewingReturn.timestamp).slice(0, 10) : ''}
              {viewingReturn?.refundMethod ? ` · ${viewingReturn.refundMethod}` : ''}
              {viewingReturn?.refundMode === 'PREPAYMENT' ? ' · Kept as store credit' : ''}
            </DialogDescription>
          </DialogHeader>

          {viewingReturn && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-3">Item</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Qty</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Price</TableHead>
                      <TableHead className="h-8 py-1.5 px-3 text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewingReturn.items || []).map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5 px-3">
                          <div className="text-sm font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-right">{Math.abs(item.adjustment)}</TableCell>
                        <TableCell className="py-1.5 px-3 text-right">{fmt(item.price || 0)}</TableCell>
                        <TableCell className="py-1.5 px-3 text-right font-medium">{fmt((item.price || 0) * Math.abs(item.adjustment))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Refund Total</span>
                <span className="text-destructive">{fmt(viewingReturn.refundAmount ?? viewingReturn.totalAmount ?? 0)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewingReturn(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Items Dialog - mirrors POS.tsx's return dialog: qty steppers bounded by returnable remaining */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-destructive" />
              Return Items - {viewingInvoice?.invoice?.invoiceNumber}
            </DialogTitle>
            <DialogDescription>Select the quantity of each item being returned.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2">
            {returnItems.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">Nothing left to return on this invoice.</div>
            )}
            {returnItems.map(item => {
              const max = returnableLimits[item.variantId]?.remaining || 0;
              return (
                <div key={item.variantId} className="flex items-center justify-between gap-2 border rounded-lg p-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">{item.sku} &middot; {fmt(item.price)} each &middot; max {max}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateReturnQty(item.variantId, item.quantity - 1)} disabled={item.quantity <= 0}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      value={item.quantity}
                      onChange={(e) => updateReturnQty(item.variantId, parseFloat(e.target.value) || 0)}
                      className="h-7 w-16 text-center"
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateReturnQty(item.variantId, item.quantity + 1)} disabled={item.quantity >= max}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {returnItems.some(i => i.quantity > 0) && (() => {
            const { total, alreadyPaid, credited } = getReturnSplit();
            return (
              <div className="space-y-2 border-t pt-3">
                {credited > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credited against balance owed (automatic)</span>
                    <span className="font-medium">{fmt(credited)}</span>
                  </div>
                )}
                {alreadyPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Already paid - needs to be settled</span>
                      <span className="font-medium">{fmt(alreadyPaid)}</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">How should the {fmt(alreadyPaid)} already paid be settled?</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReturnRefundMode('REFUND')}
                          className={cn(
                            'border rounded p-2.5 text-left text-sm transition-colors',
                            returnRefundMode === 'REFUND' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          )}
                        >
                          <div className="font-medium">Refund Payment</div>
                          <div className="text-xs text-muted-foreground">Pay {fmt(alreadyPaid)} back now ({viewingInvoice?.sale?.paymentMethod || 'CASH'})</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReturnRefundMode('PREPAYMENT')}
                          className={cn(
                            'border rounded p-2.5 text-left text-sm transition-colors',
                            returnRefundMode === 'PREPAYMENT' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          )}
                        >
                          <div className="font-medium">Save as Prepayment</div>
                          <div className="text-xs text-muted-foreground">Keep {fmt(alreadyPaid)} as store credit for a future invoice</div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center gap-2 border-t pt-3">
            <div className="text-sm font-semibold">
              Refund Total: <span className="text-destructive">{fmt(calculateReturnTotal())}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={submitReturn}
                disabled={isProcessingReturn || returnItems.every(i => i.quantity <= 0)}
              >
                {isProcessingReturn ? 'Processing...' : 'Process Return'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Sale payment dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        title="Complete Cash Sale"
        totalDue={totals.total}
        module="POS"
        onConfirm={async (payments) => createInvoice('COMPLETED', payments)}
      />

      {/* Receive payment against an outstanding credit invoice */}
      {payingInvoice && (
        <PaymentDialog
          open={!!payingInvoice}
          onOpenChange={(open) => !open && setPayingInvoice(null)}
          title={`Receive Payment - ${payingInvoice.invoiceNumber}`}
          totalDue={payingInvoice.balance}
          allowPartialPayment
          module="POS"
          onConfirm={(payments) => submitPayment(payingInvoice.invoiceNumber, payments)}
        />
      )}

      {/* Shared PDF preview/print popup - used for invoice previews here */}
      <PdfPreviewDialog
        open={pdfPreview.open}
        onOpenChange={pdfPreview.setOpen}
        url={pdfPreview.url}
        title={pdfPreview.title}
        iframeRef={pdfPreview.iframeRef}
        onPrint={pdfPreview.handlePrint}
        autoPrintOnLoad={pdfPreview.autoPrintOnLoad}
      />

      {/* Calculator */}
      <Dialog open={calculatorOpen} onOpenChange={setCalculatorOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Calculator</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input readOnly value={calcValue} className="text-right text-lg font-mono h-12" />
            <div className="grid grid-cols-4 gap-2">
              {calcButtons.map(btn => (
                <Button key={btn} variant="outline" onClick={() => handleCalcButton(btn)}>{btn}</Button>
              ))}
              <Button variant="ghost" className="col-span-4" onClick={() => setCalcValue('0')}>
                <RotateCcw className="h-4 w-4 mr-1" />Clear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
