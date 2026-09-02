import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';
import { mockCustomers, mockSales } from '@/data/mockData';
import { Product, ProductVariant, Customer, Sale, CartItem, ActiveOrder } from '@/types/inventory';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, Minus, Plus, Trash2, Ban, CreditCard, Banknote, Smartphone, ShoppingCart, Receipt, User, UserPlus, X, Edit, Home, Clock, FileText, PauseCircle, PlayCircle, RotateCcw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Package, RefreshCw, LogOut, Printer, Wallet, Building, Gift, Utensils, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { getProductPriceInfo } from '@/lib/pricing';
import { negativeStockAllowed } from '@/lib/stock';
import { useCurrency } from '@/hooks/useCurrency';

/**
 * Guarantee every cart item has a unique cartItemId. Items rebuilt from a saved sale
 * (re-order, load pending, resume) don't carry one, and a sale with two lines for the
 * same variant would otherwise collide on the React key AND on quantity/price edits.
 */
const withCartIds = (items: CartItem[]): CartItem[] =>
  items.map((it, i) =>
    it.cartItemId
      ? it
      : { ...it, cartItemId: `ci-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}` }
  );

export default function POS() {
  const navigate = useNavigate();
  const {
    products = [],
    locations = [],
    settings = null,
    customers: contextCustomers = [],
    transactions = [],
    promotions = [],
    categories: dbCategories = [],
    createSale,
    createReturn,
    checkReturnableItems,
    voidPrintedItems,
    addCustomer,
    activeOrders = [],
    holdOrder,
    discardOrder,
    salesHistory = [],
    refreshData,
    tables = [],
    posLoadSaleId = null,
    clearPosLoad,
  } = useInventory() || {};
  const tableManagementEnabled = !!settings?.enableTableManagement;
  const { user, logout, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const isAdmin = user?.username?.toLowerCase() === 'admin' || user?.role?.toUpperCase() === 'ADMIN';
  const canVoidPrinted = !rights || rights.voidPrintedItem !== 'no';
  // "Can receive payment" = holds at least one payment-taking right (umbrella,
  // table-order, or any individual POS tender method). If none, the Pending
  // Payments popup shows a Print Bill button instead of Receive Payment.
  const canReceivePayment = !rights || [
    rights.paymentAccess,
    rights.receiveTableOrderPayment,
    rights.posReceiveCash,
    rights.posReceiveBank,
    rights.posReceiveMobile,
    rights.posReceiveComplimentary,
  ].some(v => v !== 'no');
  // Re-printing a bill that was already printed once needs the Reprint Receipt right.
  const canReprintReceipt = !rights || rights.reprintReceipt !== 'no';
  // Adding items to an order whose bill was already printed: 'no' blocks, 'yes' allows,
  // 'supervised' needs a supervisor password to unlock.
  const addToPrintedBillRight = rights?.addToPrintedBill ?? 'yes';
  const { sym, computeTax, vatInclusive } = useCurrency();

  // Hidden admin gesture: click the "POS" title in the header 5 times within 3s to wipe
  // this browser's local/session storage (demo cleanup). No visible affordance or counter.
  const clearStorageTaps = useRef(0);
  const clearStorageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSecretClearStorage = () => {
    if (!isAdmin) return;
    if (clearStorageTimer.current) clearTimeout(clearStorageTimer.current);
    clearStorageTaps.current += 1;
    if (clearStorageTaps.current >= 5) {
      clearStorageTaps.current = 0;
      const apiBase = localStorage.getItem('api_base_url');
      const printers: Record<string, string> = {};
      Object.keys(localStorage)
        .filter(k => k === 'localPrinterName' || k.startsWith('printer_mapping_'))
        .forEach(k => { const v = localStorage.getItem(k); if (v != null) printers[k] = v; });
      localStorage.clear();
      sessionStorage.clear();
      if (apiBase) localStorage.setItem('api_base_url', apiBase);
      Object.entries(printers).forEach(([k, v]) => localStorage.setItem(k, v));
      toast.success('Local storage cleared. Reloading…');
      setTimeout(() => window.location.reload(), 500);
      return;
    }
    clearStorageTimer.current = setTimeout(() => { clearStorageTaps.current = 0; }, 3000);
  };

  // Workstation-specific local printer configuration
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
  const [localPrinter, setLocalPrinter] = useState(() => localStorage.getItem('localPrinterName') || 'Receipt Printer');
  const [posPrinterMappings, setPosPrinterMappings] = useState<Record<string, string>>({});
  const [kotCatSearch, setKotCatSearch] = useState('');
  const [localPrinters, setLocalPrinters] = useState<string[]>([]);
  const [isFetchingPrinters, setIsFetchingPrinters] = useState(false);

  useEffect(() => {
    if (dbCategories.length > 0 || products.length > 0) {
      // Only main categories get a KOT printer mapping; sub-categories inherit their parent's.
      const catIds = new Set(dbCategories.map(c => c.id));
      const mainNames = new Set<string>([
        ...dbCategories.filter(c => c.parentId == null || !catIds.has(c.parentId)).map(c => c.name),
        ...products.filter(p => p.isActive !== false).map(p => p.category).filter(Boolean) as string[],
      ]);
      setPosPrinterMappings(prev => {
        const mappings = { ...prev };
        mainNames.forEach(name => {
          if (!mappings[name]) {
            mappings[name] = localStorage.getItem(`printer_mapping_${name}`) || 'Receipt Printer';
          }
        });
        return mappings;
      });
    }
  }, [dbCategories, products]);

  const fetchLocalPrinters = async () => {
    setIsFetchingPrinters(true);
    try {
      const response = await fetch('http://localhost:9000/printers');
      if (response.ok) {
        const data = await response.json();
        setLocalPrinters(data);
      }
    } catch (err) {
      console.warn("Local print service offline, cannot fetch printer list.");
    } finally {
      setIsFetchingPrinters(false);
    }
  };

  useEffect(() => {
    fetchLocalPrinters();
  }, []);

  // Set default selected customer to CASH-SALES ACCOUNT when customers list is loaded
  useEffect(() => {
    if (contextCustomers && contextCustomers.length > 0 && !selectedCustomer) {
      const defaultCust = contextCustomers.find(
        c => c.name?.toUpperCase() === 'CASH-SALES ACCOUNT'
      );
      if (defaultCust) {
        setSelectedCustomer(defaultCust);
      }
    }
  }, [contextCustomers]);

  const handleSavePrinterSettings = () => {
    localStorage.setItem('localPrinterName', localPrinter);
    Object.entries(posPrinterMappings).forEach(([catName, printerName]) => {
      localStorage.setItem(`printer_mapping_${catName}`, printerName);
    });
    toast.success('Workstation printer settings saved successfully!');
    setIsPrinterSettingsOpen(false);
  };

  // Location selector - default to user's location or main location
  const defaultLocationId = (user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id || '').toString();
  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId);
  const selectedLocation = locations?.find(l => l.id?.toString() === selectedLocationId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const DRAFT_KEY = `pos_draft_order_${user?.id || 'guest'}`;

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.cart || [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  // Bumped on every full POS reset so the cart list remounts with fresh DOM
  // (works around stale paint in the fixed cart panel after clearing).
  const [cartViewKey, setCartViewKey] = useState(0);
  const [categorySidebarOpen, setCategorySidebarOpen] = useState<boolean>(
    () => localStorage.getItem('pos_category_sidebar') !== 'closed'
  );
  const [categorySearch, setCategorySearch] = useState('');
  useEffect(() => {
    localStorage.setItem('pos_category_sidebar', categorySidebarOpen ? 'open' : 'closed');
  }, [categorySidebarOpen]);
  const [selectedTable, setSelectedTable] = useState<{ id: number; code: string } | null>(null);
  const [wantTablePicker, setWantTablePicker] = useState(false);
  const [tableOrdersOpen, setTableOrdersOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Orders Management
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ variantId: string; quantity: number; price: number; taxRate?: number }[]>([]);
  const [returnableLimits, setReturnableLimits] = useState<Record<string, { original: number, returned: number, remaining: number }>>({});
  // Removed local state: activeOrders and salesHistory now come from context
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Void printed KOT item (supervisor-authorised) state
  const [voidTarget, setVoidTarget] = useState<{ item: CartItem; maxQty: number } | null>(null);
  const [voidQty, setVoidQty] = useState(1);
  const [voidReason, setVoidReason] = useState('');
  const [voidSupUser, setVoidSupUser] = useState('');
  const [voidSupPass, setVoidSupPass] = useState('');

  // Customer bill (receipt) already-printed state for the loaded order
  const [currentBillPrinted, setCurrentBillPrinted] = useState(false);
  const [billEditUnlocked, setBillEditUnlocked] = useState(false);
  const [billUnlockDialogOpen, setBillUnlockDialogOpen] = useState(false);
  const [billUnlockSupUser, setBillUnlockSupUser] = useState('');
  const [billUnlockSupPass, setBillUnlockSupPass] = useState('');
  const [printingBillId, setPrintingBillId] = useState<string | number | null>(null);

  // Receive Payment dialog state
  const [receivePaymentSale, setReceivePaymentSale] = useState<Sale | null>(null);
  const [receivePaymentMethods, setReceivePaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank: { active: false, amount: '', reference: '' },
    complimentary: { active: false, amount: '', reference: '' }
  });
  const [isReceivingPayment, setIsReceivingPayment] = useState(false);

  // Order Filters
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStartDate, setOrderStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [orderEndDate, setOrderEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank: { active: false, amount: '', reference: '' },
    complimentary: { active: false, amount: '', reference: '' }
  });

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.selectedCustomer || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', idNumber: '', customerType: 'POS' });
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [postActionPromptOpen, setPostActionPromptOpen] = useState(false);

  // M-Pesa Integration States
  const [completedMpesaPayments, setCompletedMpesaPayments] = useState<{ amount: number, reference: string }[]>([]);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('IDLE');
  const [useStkPush, setUseStkPush] = useState(true);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [currentSaleId, setCurrentSaleId] = useState<number | null>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.currentSaleId || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  // Amount already paid on the order currently loaded into the POS (partial payments)
  const [currentSalePaid, setCurrentSalePaid] = useState<number>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try { return JSON.parse(saved).currentSalePaid || 0; } catch { return 0; }
    }
    return 0;
  });
  // Status of the order currently loaded into the POS, so re-holding it keeps its own
  // status (e.g. a resumed KOT stays PENDING) instead of being forced to PAYMENT_PENDING
  // before the cashier actually places the bill.
  const [currentSaleStatus, setCurrentSaleStatus] = useState<string | null>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try { return JSON.parse(saved).currentSaleStatus || null; } catch { return null; }
    }
    return null;
  });

  // Auto-save draft order
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        cart,
        selectedCustomer,
        currentSaleId,
        currentSalePaid,
        currentSaleStatus
      }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [cart, selectedCustomer, currentSaleId, currentSalePaid, currentSaleStatus, DRAFT_KEY]);

  // Synchronize across multiple tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === DRAFT_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setCart(parsed.cart || []);
            setSelectedCustomer(parsed.selectedCustomer || null);
            setCurrentSaleId(parsed.currentSaleId || null);
            setCurrentSalePaid(parsed.currentSalePaid || 0);
            setCurrentSaleStatus(parsed.currentSaleStatus || null);
          } catch {
            // Ignore parse errors
          }
        } else {
          setCart([]);
          setSelectedCustomer(null);
          setCurrentSaleId(null);
          setCurrentSalePaid(0);
          setCurrentSaleStatus(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [DRAFT_KEY]);

  // Receipt Preview States
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewLabel, setReceiptPreviewLabel] = useState<string | null>(null);
  const receiptIframeRef = useRef<HTMLIFrameElement>(null);
  const autoPrintIframeRef = useRef<HTMLIFrameElement>(null);

  // Reference to track if we should stop polling
  const stopPollingRef = useRef(false);
  const pollSessionRef = useRef(0);

  // Navigation confirmation
  const [printKotOpen, setPrintKotOpen] = useState(false);

  // Get all variants with product info (Active only)
  const allVariants = products
    // include products with no `type` set (legacy rows) — only RAW_MATERIAL is excluded
    .filter(p => p.isActive !== false && p.type !== 'RAW_MATERIAL')
    .flatMap(product =>
      product.variants
        .filter(v => v.isActive !== false)
        .map(variant => ({
          ...variant,
          productName: product.name,
          category: product.category,
          stock: variant.locationStock[selectedLocationId] || 0
        }))
    );

  // Get unique categories (Active only). Prefer the managed categories table (which
  // carries the main/sub-category hierarchy) and union in any legacy category names
  // that only exist on products.
  const productCategoryNames = Array.from(
    new Set(products.filter(p => p.isActive !== false).map(p => p.category).filter(Boolean))
  );
  const dbCategoryIds = new Set(dbCategories.map(c => c.id));
  const mainCategories: { id: number | null; name: string }[] = [
    ...dbCategories
      .filter(c => c.parentId == null || !dbCategoryIds.has(c.parentId))
      .map(c => ({ id: c.id, name: c.name })),
    ...productCategoryNames
      .filter(name => !dbCategories.some(c => c.name === name))
      .map(name => ({ id: null, name })),
  ];
  const selectedMainId = dbCategories.find(c => c.name === selectedCategory && !c.parentId)?.id ?? null;
  const subCategories = selectedMainId != null
    ? dbCategories.filter(c => c.parentId === selectedMainId)
    : [];

  // Product counts per category (active products only), for the category sidebar.
  const productCountByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) {
      if (p.isActive === false) continue;
      const key = p.category || '';
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [products]);
  const totalActiveProducts = useMemo(
    () => products.filter(p => p.isActive !== false).length,
    [products]
  );
  const sidebarCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return mainCategories
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainCategories, categorySearch]);

  // ---- Table management ----
  const activeTables = (tables || []).filter(t => t.active !== false)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const tableOpenCount = (tableId: number) =>
    (salesHistory || []).filter(s => s.status === 'PAYMENT_PENDING' && Number(s.tableId) === tableId).length;
  const showTablePicker = tableManagementEnabled && !selectedTable &&
    ((!currentSaleId && cart.length === 0) || wantTablePicker);
  const currentTableOrders = (selectedTable
    ? (salesHistory || []).filter(s => s.status === 'PAYMENT_PENDING' && Number(s.tableId) === selectedTable.id)
    : []
  ).slice().sort((a, b) => new Date(b.timestamp as any).getTime() - new Date(a.timestamp as any).getTime());

  async function pollMpesaStatus(requestId: string, sessionId?: number) {
    // If we've been told to stop, or this is a ghost session, just exit
    if (stopPollingRef.current) return;
    if (sessionId !== undefined && sessionId !== pollSessionRef.current) return;

    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush/status/${requestId}`);

      if (data.status === 'SUCCESS') {
        setIsPollingMpesa(false);
        setMpesaStatus('SUCCESS');

        const receipt = data.mpesaReceiptNumber || data.MpesaReceiptNumber;
        if (receipt) {
          // Add to the list of completed payments
          setCompletedMpesaPayments(prev => {
            // Check if already added to avoid duplicates if polling overlap
            if (prev.some(p => p.reference === receipt)) return prev;
            return [...prev, { amount: data.amount, reference: receipt }];
          });

          toast.success(`M-Pesa payment of ${sym}${data.amount} confirmed!`);
        }

        if (data.recordedSaleId) {
          toast.success('Sale completed and recorded!');
          discardOrder(`stk-${requestId}`);
          const receiptUrl = `${getBaseUrl()}/api/transactions/sale/${data.recordedSaleId}/receipt`;
          handleReceiptAction(receiptUrl);

          setTimeout(() => {
            resetPOSState();
            setCheckoutOpen(false);
            refreshData();
            setPostActionPromptOpen(true);
          }, 1000);
        } else {
          // If not auto-recorded, just reset polling state so another push can be made
          setTimeout(() => {
            setMpesaStatus('IDLE');
            setCheckoutRequestId(null);
            setMpesaPhone('');
            // Optional: Reduce the mobile payment field by the amount just paid
            setPaymentMethods(prev => {
              const currentMobile = parseFloat(prev.mobile.amount) || 0;
              const newAmount = Math.max(0, currentMobile - data.amount);
              return {
                ...prev,
                mobile: { ...prev.mobile, amount: newAmount > 0.01 ? newAmount.toFixed(2) : '' }
              };
            });
          }, 2000);
        }
      } else if (data.status === 'FAILED') {
        setIsPollingMpesa(false);
        setMpesaStatus('FAILED');
        toast.error('M-Pesa payment failed.');
        discardOrder(`stk-${requestId}`);
      } else if (data.status === 'CANCELLED') {
        setIsPollingMpesa(false);
        setMpesaStatus('CANCELLED');
        toast.error('M-Pesa payment was cancelled.');
        discardOrder(`stk-${requestId}`);
      } else {
        if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
          setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      if (!stopPollingRef.current && (sessionId === undefined || sessionId === pollSessionRef.current)) {
        setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 5000);
      }
    }
  }

  async function manualQueryMpesa(requestId: string) {
    setIsPollingMpesa(true);
    setMpesaStatus('PENDING');
    pollSessionRef.current += 1; // Start new session
    const currentSession = pollSessionRef.current;

    try {
      await apiFetch(`/api/mpesa/stkpush/query/${requestId}`);
      await pollMpesaStatus(requestId, currentSession);
    } catch (error) {
      console.error('Manual query error:', error);
    } finally {
      setIsPollingMpesa(false);
      // Ensure UI is reset even if user closes while checking
      setPaymentMethods({
        cash: { active: false, amount: '', reference: '' },
        card: { active: false, amount: '', reference: '' },
        mobile: { active: false, amount: '', reference: '' }
      });
    }
  }


  // Fix: Set default location when locations load
  useEffect(() => {
    if ((!selectedLocationId || selectedLocationId === '') && locations.length > 0) {
      const defaultId = (user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id || '').toString();
      if (defaultId) setSelectedLocationId(defaultId);
    }
  }, [locations, user]);

  // Cleanup effect for receipt preview URL
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl && receiptPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when category / sub-category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedSubcategory]);

  // Clear the sub-category selection whenever the main category changes
  useEffect(() => {
    setSelectedSubcategory(null);
  }, [selectedCategory]);

  // Filter products (Active only)
  const filteredProducts = products
    .filter(p => p.isActive !== false)
    .filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.variants
          .filter(v => v.isActive !== false)
          .some(v =>
            (v.sku && v.sku.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
            (v.barcode && v.barcode.includes(debouncedSearch))
          );

      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesSubcategory = !selectedSubcategory || product.subcategory === selectedSubcategory;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const addToCart = (variant: ProductVariant, productName: string, productObj?: Product) => {
    if (!ensureBillEditable()) return;
    // Force string lookup for map key
    const availableStock = variant.locationStock?.[selectedLocationId?.toString()] || 0;
    const productForPolicy = productObj || products.find(p => p.id?.toString() === variant?.productId?.toString());
    const allowNegative = negativeStockAllowed(productForPolicy, settings);
    const skipStockCheck = variant.hasRecipe;

    if (availableStock <= 0 && !allowNegative && !skipStockCheck) {
      toast.error(`No stock available at ${selectedLocation?.name || 'selected location'}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.variantId === variant.id && !item.printed);

      // Calculate promotional price - use passed product object if available for better reliability
      const product = productObj || products.find(p => p.id?.toString() === variant?.productId?.toString());
      const priceInfo = product ? getProductPriceInfo(product, variant.id, promotions || []) : { currentPrice: variant.price, promotion: null };
      const currentPrice = priceInfo.promotion ? priceInfo.currentPrice : variant.price;

      if (existing) {
        if (existing.quantity >= availableStock && !allowNegative && !skipStockCheck) {
          toast.error(`Cannot add more. Only ${availableStock} in stock at ${selectedLocation?.name}`);
          return prev;
        }
        return prev.map(item =>
          item.cartItemId === existing.cartItemId
            ? { ...item, quantity: item.quantity + 1, price: currentPrice }
            : item
        );
      }
      return [...prev, {
        cartItemId: `${variant.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        variantId: variant.id,
        productName: productName,
        variantSku: variant.sku,
        attributes: variant.attributes,
        quantity: 1,
        price: currentPrice,
        maxStock: availableStock,
        hasRecipe: variant.hasRecipe,
        allowNegative,
        category: (productObj || product || productForPolicy)?.category,
        taxRate: product?.taxRate ?? 16.0,
        taxType: product?.taxType ?? 'A'
      }];
    });
    setVariantDialogOpen(false);
    const attrStr = Object.values(variant.attributes).join(' / ');
    toast.success(`Added ${productName}${attrStr ? ` (${attrStr})` : ''} to cart`);

    // Warn (top-right) when the item just added is at/below its reorder level
    const reorderLevel = Number(variant.lowStockThreshold || 0);
    if (
      settings?.showStockWarning !== false &&
      !variant.hasRecipe &&
      reorderLevel > 0 &&
      availableStock <= reorderLevel
    ) {
      toast.warning(
        `Low stock: ${productName}${attrStr ? ` (${attrStr})` : ''} — ${availableStock} left at ${selectedLocation?.name || 'this location'} (reorder level ${reorderLevel})`,
        { position: 'top-right' }
      );
    }
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    if (delta > 0 && !ensureBillEditable()) return;
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        if (item.printed && delta < 0) {
          toast.error('Cannot decrease the quantity of printed KOT items');
          return item;
        }
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return item;
        const itemAllowsNegative = item.allowNegative ?? (settings?.allowNegativeStock ?? false);
        if (newQuantity > item.maxStock && !itemAllowsNegative && !item.hasRecipe) {
          toast.error('Cannot exceed available stock');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updatePrice = (cartItemId: string, newPrice: number) => {
    if (newPrice < 0) return;
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    if (item.printed) {
      toast.error('Cannot change the price of printed KOT items');
      return;
    }

    const variant = allVariants?.find(v => v.id?.toString() === item.variantId?.toString());
    
    let finalPrice = newPrice;
    if (isNaN(finalPrice)) {
      const product = products.find(p => p.id?.toString() === variant?.productId?.toString());
      if (product && variant) {
        const priceInfo = getProductPriceInfo(product, variant.id, promotions || []);
        finalPrice = priceInfo.currentPrice;
      } else {
        finalPrice = variant?.price || 0;
      }
    }

    if (variant && finalPrice < variant.cost) {
      toast.error(`Price cannot be below cost price (${sym}${variant.cost})`);
      return;
    }

    setCart(prev => prev.map(item =>
      item.cartItemId === cartItemId
        ? { ...item, price: finalPrice }
        : item
    ));
    if (!isNaN(newPrice)) {
      toast.success('Price updated');
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => cartItemId !== item.cartItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  /**
   * "Cancel": drop the local working cart and fully detach from any loaded DB order
   * WITHOUT modifying that order. The loaded order stays exactly as it is on the board;
   * the next item added starts a brand-new sale (fresh id + idempotency key).
   */
  const cancelWorkingOrder = (opts?: { silent?: boolean }) => {
    const hadLoadedOrder = !!currentSaleId;
    clearCart();
    setCurrentSaleId(null);
    setCurrentSaleStatus(null);
    setCurrentSalePaid(0);
    setCurrentBillPrinted(false);
    setBillEditUnlocked(false);
    setSelectedTable(null);
    setWantTablePicker(false);
    setSelectedCustomer(contextCustomers?.find(c => c.name?.toUpperCase() === 'CASH-SALES ACCOUNT') || null);
    setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    if (hadLoadedOrder && !opts?.silent) {
      toast.info('Cleared. The order you loaded is unchanged — reopen it from Pending Payments or the table board.');
    }
  };

  /**
   * Robustly resolve the product-category name for a cart line (for KOT printer routing).
   * `allVariants` only holds FINISHED_GOOD products, so it can't be trusted here — scan the
   * full product list for whichever product actually owns this variant.
   */
  const resolveItemCategory = (item: { variantId?: string; category?: string }): string | undefined => {
    if (item.category && item.category.trim()) return item.category.trim();
    const vid = item.variantId?.toString();
    if (!vid) return undefined;
    const owner = products.find(p => (p.variants || []).some(v => v.id?.toString() === vid));
    if (owner?.category && owner.category.trim()) return owner.category.trim();
    // legacy: some rows carry a product id in variantId
    const asProduct = products.find(p => p.id?.toString() === vid);
    return asProduct?.category?.trim() || undefined;
  };

  const dispatchKOTs = async (dbSaleId: string | number, newItems: typeof cart, opts?: { cancel?: boolean }) => {
      const token = sessionStorage.getItem('token');
      const kotEndpoint = opts?.cancel ? 'receipt_kot_cancel' : 'receipt_kot_custom';
      toast.info(opts?.cancel ? 'Sending cancellation to kitchen...' : 'Routing KOTs to printers...');

      // 1. Group new items by printer name (and remember which categories landed there)
      const printerGroups: Record<string, typeof newItems> = {};
      const printerCategories: Record<string, string[]> = {};
      const fallbackPrinter = localStorage.getItem('localPrinterName') || 'Receipt Printer';

      for (const item of newItems) {
        const categoryName = resolveItemCategory(item);
        if (!categoryName) {
          console.warn('KOT routing: no category resolved for', item.productName, '(variantId', item.variantId, ') — using fallback printer', fallbackPrinter);
        }

        const printer = (categoryName && posPrinterMappings[categoryName]) ? posPrinterMappings[categoryName] : fallbackPrinter;

        if (!printerGroups[printer]) {
          printerGroups[printer] = [];
          printerCategories[printer] = [];
        }
        printerGroups[printer].push(item);
        if (categoryName && !printerCategories[printer].includes(categoryName)) {
          printerCategories[printer].push(categoryName);
        }
      }

      console.log('--- KOT Printer Routing ---');
      Object.entries(printerGroups).forEach(([printerName, items]) => {
          const itemSummaries = items.map(i => ({
              name: i.productName, category: resolveItemCategory(i), mappedPrinter: printerName,
          }));
          console.log(`=> Dispatched to Printer: [${printerName}]`, itemSummaries);
      });
      console.log('---------------------------');

      // 2. For each printer group, request custom KOT and print
      for (const [printerName, itemsForPrinter] of Object.entries(printerGroups)) {
        const stationLabel = (printerCategories[printerName] || []).join(' / ');
        const catQS = stationLabel ? `?category=${encodeURIComponent(stationLabel)}` : '';
        try {
          const payloadItems = itemsForPrinter.map(item => ({
            variantId: parseInt(item.variantId),
            sku: item.variantSku,
            productName: item.productName,
            adjustment: -item.quantity,
            price: item.price,
            taxRate: item.taxRate ?? 16.0,
            taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
          }));

          const kotUrl = `${getBaseUrl()}/api/transactions/sale/${dbSaleId}/${kotEndpoint}${catQS}`;
          const response = await fetch(kotUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payloadItems)
          });

          if (!response.ok) throw new Error(`Failed to fetch KOT PDF for printer ${printerName}`);

          const blob = await response.blob();

          const printResponse = await fetch(`http://localhost:9000/print?printer=${encodeURIComponent(printerName)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/pdf',
            },
            body: blob,
          });

          if (printResponse.ok) {
            toast.success(`KOT printed on ${printerName}!`);
          } else {
            // Printer is mapped but the local print service rejected the job — surface the
            // real reason and show the KOT in the in-app preview. Never open a browser tab.
            const reason = await printResponse.text().catch(() => `HTTP ${printResponse.status}`);
            console.warn(`Local print service rejected job for ${printerName}: ${reason}`);
            toast.error(`Printer "${printerName}": ${reason}`, { duration: 8000 });
            const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            if (receiptPreviewUrl && receiptPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(receiptPreviewUrl);
            setReceiptPreviewUrl(blobUrl);
            setReceiptPreviewOpen(true);
          }
        } catch (e) {
          console.warn(`Print error for ${printerName}, showing in-app preview...`, e);
          toast.error(
            `Cannot reach the local print service (localhost:9000) for "${printerName}". Is PrinterService running?`,
            { duration: 8000 }
          );
          // Local print service unreachable: re-fetch the KOT and show it in-app (no new tab).
          try {
              const retryResponse = await fetch(`${getBaseUrl()}/api/transactions/sale/${dbSaleId}/${kotEndpoint}${catQS}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(payloadItems)
              });
              const retryBlob = await retryResponse.blob();
              const blobUrl = URL.createObjectURL(new Blob([retryBlob], { type: 'application/pdf' }));
              if (receiptPreviewUrl && receiptPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(receiptPreviewUrl);
              setReceiptPreviewUrl(blobUrl);
              setReceiptPreviewOpen(true);
          } catch(innerErr) {
             console.error("Preview fallback failed", innerErr);
          }
        }
      }
  };

  const handlePrintKOT = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const newItems = cart.filter(item => !item.printed);
    if (newItems.length === 0) {
      toast.info("All items are already sent to the kitchen.");
      return;
    }

    // Printing a KOT now behaves exactly like "Place And Bill" (it creates a real open
    // bill on the table board and deducts stock) — the ONLY difference is that it prints
    // the kitchen ticket(s) instead of the customer bill.
    const fallbackCust = contextCustomers?.find(c => c.name?.toUpperCase() === 'CASH-SALES ACCOUNT');
    const kotCustomer = selectedCustomer || (tableManagementEnabled ? fallbackCust : null);
    if (!kotCustomer) {
      toast.error('Please select a customer to proceed');
      setCustomerPopoverOpen(true);
      return;
    }

    const saleData = {
      type: 'SALE',
      status: 'PAYMENT_PENDING',
      locationId: selectedLocationId,
      customerId: kotCustomer?.id ? kotCustomer.id : null,
      paymentMethod: 'PAY_LATER',
      tableId: selectedTable?.id ?? null,
      tableName: selectedTable?.code ?? null,
      payments: [],
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: 0,
      changeAmount: 0,
      idempotencyKey: currentSaleId ? undefined : `kot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items: cart.map(item => ({
        variantId: parseInt(item.variantId),
        sku: item.variantSku,
        productName: item.productName,
        adjustment: -item.quantity,
        price: item.price,
        taxRate: item.taxRate ?? 16.0,
        taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
      })),
    };

    setIsProcessing(true);
    try {
      let savedSale;
      if (currentSaleId) {
        // Strip amountPaid/changeAmount/payments on an update so a partial payment
        // already recorded against this open order isn't wiped. The backend deducts
        // stock for the delta (newly added lines) only.
        const { amountPaid: _ap, changeAmount: _ca, payments: _pm, ...rest } = saleData;
        const updatePayload = { ...rest, payments: [], status: 'PAYMENT_PENDING' };
        try {
          const res = await apiFetch<any>(`/api/transactions/${currentSaleId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload)
          });
          savedSale = res.data || res;
        } catch (putErr: any) {
          // The loaded order no longer exists (completed, cancelled, stale draft) —
          // fall back to creating a fresh order instead of failing.
          if (String(putErr?.message || '').toLowerCase().includes('not found')) {
            setCurrentSaleId(null);
            const res = await apiFetch<any>('/api/transactions/sale', {
              method: 'POST',
              body: JSON.stringify({ ...saleData, idempotencyKey: `kot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` })
            });
            savedSale = res.data || res;
          } else {
            throw putErr;
          }
        }
      } else {
        const res = await apiFetch<any>('/api/transactions/sale', {
          method: 'POST',
          body: JSON.stringify(saleData)
        });
        savedSale = res.data || res;
      }

      const dbSaleId = savedSale.id;
      setCurrentSaleId(dbSaleId);
      setCurrentSaleStatus('PAYMENT_PENDING');

      // Kitchen ticket(s) only — never the customer bill.
      await dispatchKOTs(dbSaleId, newItems);

      resetPOSState();
      refreshData();
      setPostActionPromptOpen(true);
      toast.success('KOT sent to kitchen. Order is on the table board — no bill printed.');
    } catch (err: any) {
      toast.error("Failed to save KOT order: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const totals = useMemo(() => {
    return cart.reduce((acc, item) => {
      const taxes = computeTax(item.quantity, item.price, item.taxRate ?? 16.0);
      return {
        subtotal: acc.subtotal + taxes.subtotal,
        tax: acc.tax + taxes.tax,
        total: acc.total + taxes.total
      };
    }, { subtotal: 0, tax: 0, total: 0 });
  }, [cart, vatInclusive]);

  const subtotal = totals.subtotal;
  const tax = totals.tax;
  const total = totals.total;

  const totalPaid = Object.values(paymentMethods)
    .reduce((sum, method) => method.active ? sum + (parseFloat(method.amount) || 0) : sum, 0)
    + completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentMethodToggle = (method: string, active: boolean) => {
    setPaymentMethods(prev => {
      const newState = { ...prev };
      if (active) {
        // Auto-fill with remaining amount
        const currentPaid = Object.values(prev)
          .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
        const remaining = Math.max(0, total - currentPaid);
        newState[method] = { ...(prev[method] || { active: false, amount: '', reference: '' }), active: true, amount: remaining.toFixed(2) };
      } else {
        newState[method] = { ...(prev[method] || { active: false, amount: '', reference: '' }), active: false, amount: '', reference: '' };
      }
      return newState;
    });
  };

  const updatePaymentDetail = (method: string, field: 'amount' | 'reference', value: string) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: { ...(prev[method] || { active: false, amount: '', reference: '' }), [field]: value }
    }));
  };

  const resetPOSState = () => {
    setCart([]);
    setPaymentMethods({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' },
      bank: { active: false, amount: '', reference: '' },
      complimentary: { active: false, amount: '', reference: '' }
    });
    const defaultCust = contextCustomers?.find(
      c => c.name?.toUpperCase() === 'CASH-SALES ACCOUNT'
    );
    setSelectedCustomer(defaultCust || null);
    setMpesaPhone('');
    setMpesaStatus('IDLE');
    setCheckoutRequestId(null);
    setIsPollingMpesa(false);
    setCompletedMpesaPayments([]); // Clear the list of payments
    setCurrentSaleId(null);
    setCurrentSalePaid(0);
    setCurrentSaleStatus(null);
    setCurrentBillPrinted(false);
    setBillEditUnlocked(false);
    setSelectedTable(null);
    setWantTablePicker(false);
    setCartViewKey(k => k + 1);
  };

  const handlePreviewReceipt = (url: string, label?: string) => {
    setReceiptPreviewLabel(label || null);
    setReceiptPreviewUrl(url);
    setReceiptPreviewOpen(true);
  };

  const handleReceiptAction = async (url: string, label?: string, opts?: { autoPrint?: boolean }) => {
    setReceiptPreviewLabel(label || null);
    // Try a silent send to the local/custom printer first when auto-print is on for
    // this workstation, or when the caller forces it (e.g. the "Print Bill" button —
    // it says "print", so it should, and only fall back to the popup if that fails,
    // exactly like Place And Bill).
    const autoPrint = opts?.autoPrint ?? !!settings?.autoPrintReceipts;
    try {
      const token = sessionStorage.getItem('token');
      // Fetch the PDF blob using auth token
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipt preview');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

      if (autoPrint) {
        toast.info('Sending to printer...');
        try {
          const localPrinterName = localStorage.getItem('localPrinterName') || 'Receipt Printer';
          const printResponse = await fetch(`http://localhost:9000/print?printer=${encodeURIComponent(localPrinterName)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/pdf',
            },
            body: blob,
          });
          if (printResponse.ok) {
            toast.success(`Printed via local print service on ${localPrinterName}!`);
            URL.revokeObjectURL(blobUrl);
            return;
          }
          console.warn('Local print service rejected the job, falling back to preview...');
        } catch (e) {
          console.warn('Local print service offline, falling back to preview...', e);
        }
        // Direct print failed - show the popup so the document isn't lost silently
      }

      // Cleanup previous blob URL if any, then show the preview popup
      if (receiptPreviewUrl && receiptPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
      setReceiptPreviewUrl(blobUrl);
      setReceiptPreviewOpen(true);
    } catch (error) {
      console.error('Error loading receipt preview:', error);
      toast.error('Failed to load receipt preview');
      // Fallback only if we can't even fetch it
      window.open(url, '_blank');
    }
  };

  const handlePrint = async () => {
    if (receiptPreviewUrl) {
      try {
        const res = await fetch(receiptPreviewUrl);
        const blob = await res.blob();
        const localPrinterName = localStorage.getItem('localPrinterName') || 'Receipt Printer';
        const printResponse = await fetch(`http://localhost:9000/print?printer=${encodeURIComponent(localPrinterName)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
          },
          body: blob,
        });
        if (printResponse.ok) {
          toast.success(`Sent to printer via local print service on ${localPrinterName}!`);
          return;
        }
      } catch (e) {
        console.warn('Local print service not available for manual print, using browser print');
      }
    }

    if (receiptIframeRef.current) {
      try {
        receiptIframeRef.current.contentWindow?.print();
      } catch (e) {
        console.error("Failed to print iframe directly:", e);
        // Fallback to window.open if iframe printing is blocked (e.g. cross-origin)
        if (receiptPreviewUrl) {
          window.open(receiptPreviewUrl, '_blank');
        }
      }
    }
  };

  const handleCheckout = async (finalPayments: PaymentDetails[]) => {
    // PaymentDialog already handles amount validation, we just process what we receive
    const totalPaid = finalPayments.reduce((sum, p) => sum + p.amount, 0);

    const payments = finalPayments.map(p => ({
      method: p.method.toUpperCase(),
      amount: p.amount,
      reference: p.reference,
      glAccountId: p.glAccountId
    }));

    // Build sale data for backend
    const saleData = {
      type: 'SALE',
      locationId: selectedLocationId,
      customerId: selectedCustomer?.id ? (selectedCustomer.id) : null,
      paymentMethod: payments.map(p => p.method).join(', '),
      tableId: selectedTable?.id ?? null,
      tableName: selectedTable?.code ?? null,
      payments,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: totalPaid,
      changeAmount: Math.max(0, totalPaid - total),
      idempotencyKey: idempotencyKey,
      items: cart.map(item => ({
        variantId: item.variantId,
        sku: item.variantSku,
        productName: item.productName,
        adjustment: -item.quantity,
        price: item.price,
        taxRate: item.taxRate ?? 16.0,
        taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
      })),
    };

    setIsProcessing(true);
    try {
      let saved;
      if (currentSaleId && currentSalePaid >= total - 0.01 && total > 0) {
        // The order is already fully covered by earlier payments — don't post again.
        toast.error('This order has already been paid in full.');
        return;
      }
      if (currentSaleId && currentSalePaid > 0) {
        // Order already carries a partial payment: just take the balance. Receiving a
        // payment must never touch the order's line items, so the PUT carries no `items`
        // (the backend leaves them alone when none are sent).
        const { amountPaid: _ap, changeAmount: _ca, payments: _pm, items: _it, ...metaPayload } = saleData;
        const putRes = await apiFetch<any>(`/api/transactions/${currentSaleId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...metaPayload, payments: [], status: 'PAYMENT_PENDING' })
        });
        const putSale = putRes.data || putRes;
        const rpRes = await apiFetch<any>(`/api/transactions/sale/${putSale.journalNumber}/receive-payment`, {
          method: 'POST',
          body: JSON.stringify(payments)
        });
        saved = rpRes.data || rpRes;
        toast.success('Balance received!');
      } else if (currentSaleId) {
        const updatePayload = {
          ...saleData,
          status: 'COMPLETED'
        };
        try {
          const response = await apiFetch<any>(`/api/transactions/${currentSaleId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload)
          });
          saved = response.data || response;
        } catch (putErr: any) {
          if (String(putErr?.message || '').toLowerCase().includes('not found')) {
            setCurrentSaleId(null);
            saved = await createSale(saleData);
          } else {
            throw putErr;
          }
        }
        toast.success('Sale completed!');
      } else {
        saved = await createSale(saleData);
      }

      // Show receipt preview instead of opening new window
      const receiptUrl = `${getBaseUrl()}/api/transactions/sale/${saved.id}/receipt`;
      handleReceiptAction(receiptUrl);

      resetPOSState();
      setCheckoutOpen(false);
      refreshData();
      setPostActionPromptOpen(true);
    } catch (error) {
      // Error already shown by createSale
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayLater = async () => {
    if (cart.length === 0) return;

    // In table mode a customer is optional — fall back to the cash-sales account.
    const fallbackCust = contextCustomers?.find(c => c.name?.toUpperCase() === 'CASH-SALES ACCOUNT');
    const payLaterCustomer = selectedCustomer || (tableManagementEnabled ? fallbackCust : null);
    if (!payLaterCustomer) {
      toast.error('Please select a customer to proceed');
      setCustomerPopoverOpen(true);
      return;
    }

    const saleData = {
      type: 'SALE',
      status: 'PAYMENT_PENDING',
      locationId: selectedLocationId,
      customerId: payLaterCustomer?.id ? payLaterCustomer.id : null,
      paymentMethod: 'PAY_LATER',
      tableId: selectedTable?.id ?? null,
      tableName: selectedTable?.code ?? null,
      payments: [],
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: 0,
      changeAmount: 0,
      idempotencyKey: idempotencyKey,
      items: cart.map(item => ({
        variantId: item.variantId,
        sku: item.variantSku,
        productName: item.productName,
        adjustment: -item.quantity,
        price: item.price,
        taxRate: item.taxRate ?? 16.0,
        taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
      })),
    };

    setIsProcessing(true);
    try {
      let savedId: string | number;
      if (currentSaleId) {
        // Don't send amountPaid/changeAmount/payments on an update — that would wipe
        // any partial payment already recorded against this pending order.
        const { amountPaid: _ap, changeAmount: _ca, payments: _pm, ...rest } = saleData;
        const updatePayload = {
          ...rest,
          payments: [],
          status: 'PAYMENT_PENDING'
        };
        try {
          await apiFetch<any>(`/api/transactions/${currentSaleId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload)
          });
          savedId = currentSaleId;
          toast.success('Pending receipt updated! Payment can be collected later.');
        } catch (putErr: any) {
          if (String(putErr?.message || '').toLowerCase().includes('not found')) {
            setCurrentSaleId(null);
            const res = await createSale(saleData);
            savedId = res.id;
            toast.success('Sale saved! Payment can be collected later.');
          } else {
            throw putErr;
          }
        }
      } else {
        const res = await createSale(saleData);
        savedId = res.id;
        toast.success('Sale saved! Payment can be collected later.');
      }

      // 1. Print Customer Bill.
      const hasNewItems = cart.some(item => !item.printed);
      if (currentBillPrinted && !hasNewItems) {
        // Re-placing an unchanged order that was already billed — don't re-print or
        // re-stamp the bill.
      } else if (currentBillPrinted && !canReprintReceipt) {
        toast.info('Order placed. Ask a supervisor to re-print the bill.');
      } else {
        const receiptUrl = `${getBaseUrl()}/api/transactions/sale/${savedId}/receipt`;
        handleReceiptAction(receiptUrl);
      }

      // 2. Dispatch Unprinted KOTs
      const newItems = cart.filter(item => !item.printed);
      if (newItems.length > 0) {
        await dispatchKOTs(savedId, newItems);
      }

      resetPOSState();
      setCheckoutOpen(false);
      refreshData();
      setPostActionPromptOpen(true);
    } catch (error) {
      // Error already shown by createSale or apiFetch
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceivePayment = async (finalPayments: PaymentDetails[]) => {
    if (!receivePaymentSale) return;

    // Guard against posting twice against an order that is already settled.
    const outstanding = Number(receivePaymentSale.totalAmount || 0) - Number(receivePaymentSale.amountPaid || 0);
    if (outstanding <= 0.01) {
      toast.error('This order has already been paid in full.');
      setReceivePaymentSale(null);
      refreshData();
      return;
    }

    const payments = finalPayments.map(p => ({
      method: p.method.toUpperCase(),
      amount: p.amount,
      reference: p.reference
    }));

    setIsReceivingPayment(true);
    try {
      await apiFetch<any>(`/api/transactions/sale/${receivePaymentSale.journalNumber}/receive-payment`, {
        method: 'POST',
        body: JSON.stringify(payments),
      });
      toast.success('Payment received! Sale completed.');
      const receiptUrl = `${getBaseUrl()}/api/transactions/sale/${receivePaymentSale.id}/receipt`;
      handleReceiptAction(receiptUrl);
      setReceivePaymentSale(null);
      refreshData();
      setPostActionPromptOpen(true);
    } catch (error: any) {
      throw error; // Let PaymentDialog catch and display it
    } finally {
      setIsReceivingPayment(false);
    }
  };

  const handleHomeClick = async () => {
    if (cart.length > 0) {
      await handleHoldOrder();
    }
    navigate('/');
  };

  const handleLogout = async () => {
    if (cart.length > 0) {
      await handleHoldOrder();
    }
    logout();
    navigate('/signin');
  };
  const handleMpesaPush = async () => {
    if (!mpesaPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    const amount = parseFloat(paymentMethods.mobile.amount);
    if (!amount || amount <= 0) {
      toast.error('Invalid mobile payment amount');
      return;
    }

    // Build sale data for payload
    const payments = [];
    if (paymentMethods.cash.active) {
      payments.push({ method: 'CASH', amount: parseFloat(paymentMethods.cash.amount) || 0, reference: paymentMethods.cash.reference });
    }
    if (paymentMethods.card.active) {
      payments.push({ method: 'CARD', amount: parseFloat(paymentMethods.card.amount) || 0, reference: paymentMethods.card.reference });
    }
    if (paymentMethods.bank?.active) {
      payments.push({ method: 'BANK', amount: parseFloat(paymentMethods.bank.amount) || 0, reference: paymentMethods.bank.reference });
    }
    if (paymentMethods.complimentary?.active) {
      payments.push({ method: 'COMPLIMENTARY', amount: parseFloat(paymentMethods.complimentary.amount) || 0, reference: paymentMethods.complimentary.reference });
    }
    // Mobile is being paid via Mpesa STK
    payments.push({ method: 'MOBILE', amount: amount, reference: 'MPESA-STK' });

    const saleData = {
      type: 'SALE',
      locationId: selectedLocationId,
      customerId: selectedCustomer?.id ? parseInt(selectedCustomer.id) : null,
      paymentMethod: payments.map(p => p.method).join(', '),
      payments,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: totalPaid,
      changeAmount: Math.max(0, totalPaid - total),
      items: cart.map(item => ({
        variantId: parseInt(item.variantId),
        sku: item.variantSku,
        productName: item.productName,
        adjustment: -item.quantity,
        price: item.price,
        taxRate: item.taxRate ?? 16.0,
        taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
      })),
    };

    setIsPollingMpesa(true);
    setMpesaStatus('PENDING');
    stopPollingRef.current = false;
    pollSessionRef.current += 1;
    const currentSession = pollSessionRef.current;
    const isFullPayment = amount >= total - 0.01;

    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: amount,
          // Only send payload if it's a full payment to trigger auto-posting
          salePayload: isFullPayment ? JSON.stringify(saleData) : ""
        })
      });

      const requestId = data.CheckoutRequestID || data.checkoutRequestID;
      setCheckoutRequestId(requestId);

      // Hold the order locally so it's not lost if user cancels/app crashes
      const heldOrder: ActiveOrder = {
        id: `stk-${requestId}`,
        customer: selectedCustomer,
        items: cart,
        userId: user?.id,
        timestamp: new Date()
      };
      holdOrder(heldOrder);

      // Start polling
      pollMpesaStatus(requestId, currentSession);
    } catch (error: any) {
      setIsPollingMpesa(false);
      setMpesaStatus('FAILED');
      toast.error(error.message || 'Failed to initiate STK push');
    }
  };

  const handleHoldOrder = async (): Promise<boolean> => {
    if (cart.length === 0) return true;

    // Order was loaded from an existing DB sale (pending payment / KOT): persist the
    // current cart back onto that same order instead of creating a duplicate held copy.
    // Keep the order's existing status — a resumed KOT stays PENDING until the cashier
    // explicitly places the bill (Pay Later / checkout); only orders that were already
    // PAYMENT_PENDING stay PAYMENT_PENDING.
    if (currentSaleId) {
      const keepStatus = currentSaleStatus === 'PENDING' ? 'PENDING' : 'PAYMENT_PENDING';
      try {
        const updatePayload = {
          type: 'SALE',
          status: keepStatus,
          locationId: selectedLocationId,
          customerId: selectedCustomer?.id ? selectedCustomer.id : null,
          paymentMethod: keepStatus === 'PENDING' ? 'PENDING' : 'PAY_LATER',
          tableId: selectedTable?.id ?? null,
          tableName: selectedTable?.code ?? null,
          payments: [],
          subtotal,
          taxAmount: tax,
          totalAmount: total,
          items: cart.map(item => ({
            variantId: item.variantId,
            sku: item.variantSku,
            productName: item.productName,
            adjustment: -item.quantity,
            price: item.price,
            taxRate: item.taxRate ?? 16.0,
            taxAmount: computeTax(item.quantity, item.price, item.taxRate ?? 16.0).tax,
          })),
        };
        await apiFetch(`/api/transactions/${currentSaleId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        });
        toast.success(keepStatus === 'PENDING' ? 'Order saved' : 'Pending order updated');
        resetPOSState();
        refreshData();
        return true;
      } catch (error: any) {
        // Loaded order is gone (completed/cancelled/stale) — drop the dead id and fall
        // through to holding the cart as a fresh local order instead of erroring out.
        if (String(error?.message || '').toLowerCase().includes('not found')) {
          setCurrentSaleId(null);
          setCurrentSaleStatus(null);
        } else {
          toast.error(error?.message || 'Failed to update pending order');
          return false;
        }
      }
    }

    const order: ActiveOrder = {
      id: `hold-${Date.now()}`,
      customer: selectedCustomer,
      items: [...cart],
      userId: user?.id,
      timestamp: new Date()
    };

    if (!holdOrder(order)) {
      toast.error(
        `Maximum held orders reached (${settings?.maxHeldOrders ?? 10}). Resume or clear a held order first.`
      );
      return false;
    }
    clearCart();
    setSelectedTable(null);
    toast.success('Order held successfully');
    return true;
  };

  const handleResumeOrder = async (order: ActiveOrder) => {
    // If the current cart has items, hold it first before resuming (persists to the
    // existing DB order when one is loaded, otherwise creates a local held order).
    if (cart.length > 0) {
      const held = await handleHoldOrder();
      if (!held) return;
    }

    setCart(withCartIds(order.items));
    setSelectedCustomer(order.customer);

    if (order.id.startsWith('db-')) {
      const dbId = parseInt(order.id.replace('db-', ''));
      setCurrentSaleId(dbId);
      const dbSale = (salesHistory || []).find(s => Number(s.id) === dbId)
        || (transactions || []).find(t => Number((t as any).id) === dbId);
      setCurrentSalePaid(Number((dbSale as any)?.amountPaid || 0));
      // Preserve the order's real status (a KOT stays PENDING) so re-holding it doesn't
      // prematurely promote it to PAYMENT_PENDING before the bill is placed.
      setCurrentSaleStatus((dbSale as any)?.status || 'PENDING');
      if ((dbSale as any)?.tableId) {
        setSelectedTable({ id: Number((dbSale as any).tableId), code: (dbSale as any).tableName || `#${(dbSale as any).tableId}` });
      }
    } else {
      setCurrentSaleId((order as any).saleId || null);
      setCurrentSalePaid(0);
      setCurrentSaleStatus((order as any).saleId ? 'PENDING' : null);
    }

    discardOrder(order.id);
    setOrdersDialogOpen(false);
    toast.success('Order resumed');
  };

  const handleReorder = (sale: Sale) => {
    // Convert sale items to cart items (finding current max stock)
    const newCart: CartItem[] = sale.items.map(item => {
      // Find current variant info to get max stock
      const variant = allVariants?.find(v => v.id?.toString() === item.variantId?.toString());
      return {
        ...item,
        variantSku: item.sku,
        quantity: Math.abs(item.adjustment),
        attributes: item.attributes || {},
        price: item.price || 0,
        maxStock: variant ? variant.stock : 0, // Or 0 if discontinued
        printed: true // Mark as printed so KOT only prints new items
      };
    });

    // A re-order is a brand-new sale — don't keep the previous order's DB id, or a
    // later Print KOT / checkout would try to PUT a transaction that isn't this cart.
    setCart(withCartIds(newCart));
    setCurrentSaleId(null);
    setCurrentSalePaid(0);
    setCurrentSaleStatus(null);
    setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    setOrdersDialogOpen(false);
    toast.success('Items loaded to cart');
  };

  const handleLoadPendingReceipt = async (sale: Sale) => {
    // Persist / hold the current cart before loading another order
    if (cart.length > 0) {
      const held = await handleHoldOrder();
      if (!held) return;
    }

    const newCart: CartItem[] = sale.items.map(item => {
      const variant = allVariants?.find(v => v.id?.toString() === item.variantId?.toString());
      return {
        ...item,
        variantSku: item.sku,
        quantity: Math.abs(item.adjustment),
        attributes: item.attributes || {},
        price: item.price || 0,
        maxStock: variant ? variant.stock : 0,
        category: resolveItemCategory({ variantId: item.variantId?.toString() }),
        printed: true
      };
    });

    setCart(withCartIds(newCart));
    const customerObj = contextCustomers?.find(c =>
      c.id?.toString() === sale.customerId?.toString() ||
      c.id?.toString() === (sale as any).customer?.id?.toString()
    );
    setSelectedCustomer(customerObj || (sale as any).customer || null);
    setCurrentSaleId(typeof sale.id === 'number' ? sale.id : parseInt(sale.id.toString()));
    setCurrentSalePaid(Number(sale.amountPaid || 0));
    setCurrentSaleStatus((sale as any).status || 'PAYMENT_PENDING');
    setCurrentBillPrinted(!!(sale as any).billPrintedAt);
    setBillEditUnlocked(false);

    setOrdersDialogOpen(false);
    setTableOrdersOpen(false);
    if ((sale as any).tableId) {
      setSelectedTable({ id: Number((sale as any).tableId), code: (sale as any).tableName || `#${(sale as any).tableId}` });
    }
    toast.success('Pending receipt loaded to cart');
  };

  // Dashboard -> POS hand-off: open a specific pending sale requested from Table Orders
  useEffect(() => {
    if (!posLoadSaleId) return;
    const sale = (salesHistory || []).find(s => Number(s.id) === Number(posLoadSaleId));
    if (sale) {
      handleLoadPendingReceipt(sale as Sale);
    } else {
      toast.error('Could not find that order');
    }
    clearPosLoad?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posLoadSaleId, salesHistory]);

  // When the POS is opened with a held order waiting and nothing already in progress,
  // load the most recent held order automatically so the cashier picks up where they left off.
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current) return;
    if (tableManagementEnabled) return;              // restaurant mode starts at the table picker
    if (posLoadSaleId) return;                       // an explicit dashboard hand-off wins
    if (cart.length > 0 || currentSaleId) return;    // work already in progress / draft restored
    if (!activeOrders || activeOrders.length === 0) return;
    autoResumedRef.current = true;
    handleResumeOrder(activeOrders[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders, posLoadSaleId, tableManagementEnabled]);

  const toggleExpandOrder = (id: string) => {
    if (expandedOrderId === id) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(id);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    await addCustomer({
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim() || undefined,
      phone: newCustomer.phone.trim() || undefined,
      idNumber: newCustomer.idNumber.trim() || undefined,
      customerType: newCustomer.customerType,
    });

    setNewCustomer({ name: '', email: '', phone: '', idNumber: '', customerType: 'POS' });
    setAddCustomerDialogOpen(false);
    toast.success('Customer added successfully');
  };

  // Helper to filter orders
  const filterOrders = (orders: any[]) => {
    const start = startOfDay(parseISO(orderStartDate));
    const end = endOfDay(parseISO(orderEndDate));

    const canViewAll = rights?.viewAllOrders !== 'no';
    const canViewPast = rights?.viewPastOrders !== 'no';
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    return orders.filter(order => {
      // 1. User Scope
      if (!canViewAll && order.userId?.toString() !== user?.id?.toString()) {
        return false;
      }

      // 2. Date Scope (Past Orders)
      const orderDate = new Date(order.timestamp);
      if (!canViewPast && !isWithinInterval(orderDate, { start: todayStart, end: todayEnd })) {
        return false;
      }

      const orderId = order.id ? order.id.toString().toLowerCase() : '';
      const customerName = order.customer?.name?.toLowerCase() || '';
      const userId = order.userId?.toString().toLowerCase() || '';
      const query = orderSearchQuery.toLowerCase();

      const matchSearch =
        orderId.includes(query) ||
        customerName.includes(query) ||
        userId.includes(query);

      const matchDate = isWithinInterval(orderDate, { start, end });

      return matchSearch && matchDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const databasePendingOrders = useMemo(() => {
    return (transactions || [])
      .filter(t => t.type === 'SALE' && t.status === 'PENDING')
      .map(t => {
        const sale = t as Sale;
        const customer = contextCustomers.find(c => c.id?.toString() === sale.customerId?.toString()) || null;

        const items: CartItem[] = sale.items.map(item => {
          const variant = allVariants?.find(v => v.id?.toString() === item.variantId?.toString());
          const availableStock = variant?.locationStock?.[selectedLocationId?.toString()] || 0;
          return {
            variantId: item.variantId ? String(item.variantId) : '',
            productName: item.productName || '',
            variantSku: item.sku || '',
            attributes: {},
            quantity: Math.abs(item.adjustment),
            price: item.price ? Number(item.price) : 0,
            maxStock: availableStock,
            printed: true
          } as CartItem;
        });

        return {
          id: `db-${sale.id}`,
          customer,
          items,
          userId: sale.userId,
          timestamp: new Date(sale.timestamp)
        } as ActiveOrder;
      });
  }, [transactions, contextCustomers, allVariants, selectedLocationId]);

  const combinedActiveOrders = useMemo(() => {
    const dbIds = new Set(databasePendingOrders.map(o => o.id));
    const localFiltered = activeOrders.filter(o => !dbIds.has(o.id));
    return [...databasePendingOrders, ...localFiltered];
  }, [databasePendingOrders, activeOrders]);

  const filteredActiveOrders = filterOrders(combinedActiveOrders);
  const filteredSalesHistory = filterOrders(salesHistory);

  const pendingPaymentSales = useMemo(() => {
    const canViewAll = rights?.viewAllOrders !== 'no';
    
    // Instead of using `transactions`, use `salesHistory` to ensure we have Sale objects with all fields
    return (salesHistory || [])
      .filter(t => t.status === 'PAYMENT_PENDING')
      .filter(t => {
        // Enforce user scope
        if (!canViewAll) {
          // If userId is missing, fallback to assuming it's theirs for safety (though it shouldn't be missing)
          // Actually, we must strictly check, but let's allow it if it strictly matches
          if (t.userId?.toString() !== user?.id?.toString()) return false;
        }
        
        return true;
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [salesHistory, rights, user]);

  const handleOpenReturn = async (sale: Sale) => {
    setSaleToReturn(sale);

    // Fetch limits
    const limits = await checkReturnableItems(Number(sale.id));
    const limitMap: Record<string, { original: number, returned: number, remaining: number }> = {};

    limits.forEach((l: any) => {
      limitMap[l.variantId] = {
        original: l.originalQty,
        returned: l.returnedQty,
        remaining: l.remainingQty
      };
    });
    setReturnableLimits(limitMap);

    // Initialize return items with 0 quantity, deduplicating by variantId
    const uniqueReturnItems = new Map();
    sale.items.forEach(item => {
      if (!uniqueReturnItems.has(item.variantId)) {
        uniqueReturnItems.set(item.variantId, {
          variantId: item.variantId,
          quantity: 0,
          price: item.price,
          taxRate: item.taxRate
        });
      }
    });
    
    setReturnItems(Array.from(uniqueReturnItems.values()).filter(item => (limitMap[item.variantId]?.remaining || 0) > 0));

    setIdempotencyKey(`ret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    setReturnDialogOpen(true);
  };

  const handleReturnAmountChange = (variantId: string, quantity: number, maxQuantity: number) => {
    if (quantity < 0) quantity = 0;
    if (quantity > maxQuantity) quantity = maxQuantity;

    setReturnItems(prev => prev.map(item =>
      item.variantId === variantId ? { ...item, quantity } : item
    ));
  };

  const calculateReturnTotal = () => {
    if (!saleToReturn) return 0;
    
    // Determine if the original sale was VAT inclusive by checking if the total amount equals the sum of base prices
    const sumOriginalPrices = saleToReturn.items.reduce((sum, item) => sum + ((item.price || 0) * Math.abs(item.adjustment)), 0);
    const originalTotal = saleToReturn.totalAmount || saleToReturn.total || 0;
    const isOriginalSaleInclusive = Math.abs(originalTotal - sumOriginalPrices) < 0.1;

    return returnItems.reduce((sum, item) => {
      const amount = item.price * item.quantity;
      if (isOriginalSaleInclusive) {
        return sum + amount; // The base price already included tax
      } else {
        const rate = (item.taxRate ?? 16.0) / 100;
        return sum + amount + (amount * rate); // Tax was added on top of base price
      }
    }, 0);
  };

  const submitReturn = async () => {
    if (!saleToReturn) return;

    // Filter items with quantity > 0
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);

    if (itemsToReturn.length === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    setIsProcessing(true);
    try {
      await createReturn({
        type: 'RETURN',
        originalSaleId: saleToReturn.id,
        idempotencyKey,
        items: itemsToReturn.map(item => ({
          variantId: item.variantId,
          adjustment: item.quantity, // Positive for return
          price: item.price
        })),
        refundAmount: calculateReturnTotal(),
        refundMethod: saleToReturn.paymentMethod || 'CASH'
      });

      setReturnDialogOpen(false);
      setSaleToReturn(null);
      setReturnItems([]);
    } catch (error) {
      console.error("Return failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Adding items to an order whose customer bill was already printed ---
  // Returns true if the caller may proceed with the add/increase now.
  const ensureBillEditable = (): boolean => {
    if (!currentSaleId || !currentBillPrinted || billEditUnlocked) return true;
    if (addToPrintedBillRight === 'no') {
      toast.error('The customer bill was already printed — you are not allowed to add items to it.');
      return false;
    }
    if (addToPrintedBillRight === 'supervised') {
      setBillUnlockDialogOpen(true);
      return false;
    }
    // 'yes' — allow, but flag that the bill is now stale
    setBillEditUnlocked(true);
    toast.warning('This bill was already printed. Re-print it after you finish changing the order.');
    return true;
  };

  const submitBillUnlock = async () => {
    if (!billUnlockSupUser.trim() || !billUnlockSupPass) {
      toast.error('Enter the supervisor username and password.');
      return;
    }
    setIsProcessing(true);
    try {
      const token = sessionStorage.getItem('token');
      const resp = await fetch(`${getBaseUrl()}/api/auth/verify-supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ username: billUnlockSupUser.trim(), password: billUnlockSupPass }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => null);
        toast.error(j?.message || 'Supervisor authorisation failed');
        return;
      }
      setBillEditUnlocked(true);
      setBillUnlockDialogOpen(false);
      setBillUnlockSupUser('');
      setBillUnlockSupPass('');
      toast.success('Editing unlocked. Add the items, then re-print the bill.');
    } catch (e) {
      toast.error('Could not reach the server to verify the supervisor.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Void an already-printed KOT line (supervisor override) ---
  const openVoidDialog = (item: CartItem) => {
    if (!canVoidPrinted) {
      toast.error("You don't have permission to void printed items.");
      return;
    }
    if (!currentSaleId || currentSaleStatus !== 'PAYMENT_PENDING') {
      toast.error('Only items on an open (billed) order can be voided.');
      return;
    }
    setVoidTarget({ item, maxQty: item.quantity });
    setVoidQty(item.quantity);
    setVoidReason('');
    setVoidSupUser('');
    setVoidSupPass('');
  };

  const submitVoid = async () => {
    if (!voidTarget || !currentSaleId || !voidPrintedItems) return;
    const qty = Math.min(Math.max(1, Math.floor(voidQty || 1)), voidTarget.maxQty);
    if (!voidSupUser.trim() || !voidSupPass) {
      toast.error('Enter the supervisor username and password.');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await voidPrintedItems(Number(currentSaleId), {
        items: [{
          variantId: parseInt(voidTarget.item.variantId),
          sku: voidTarget.item.variantSku,
          productName: voidTarget.item.productName,
          adjustment: qty,
          price: voidTarget.item.price,
        }],
        reason: voidReason.trim() || null,
        supervisorUsername: voidSupUser.trim(),
        supervisorPassword: voidSupPass,
      });

      // Shrink / drop the line locally to match the server
      const targetId = voidTarget.item.cartItemId || voidTarget.item.variantId;
      setCart(prev => prev.flatMap(ci => {
        if ((ci.cartItemId || ci.variantId) !== targetId) return [ci];
        const left = ci.quantity - qty;
        return left > 0 ? [{ ...ci, quantity: left }] : [];
      }));

      // Tell the kitchen to stop preparing the voided units
      try {
        await dispatchKOTs(currentSaleId, [{ ...voidTarget.item, quantity: qty }] as typeof cart, { cancel: true });
      } catch (e) {
        console.warn('Cancellation KOT dispatch failed', e);
      }

      toast.success(`Voided ${qty} × ${voidTarget.item.productName} — ${res.journalNumber}`);
      setVoidTarget(null);
      refreshData?.();
    } catch (error) {
      // context already surfaced the message; keep the dialog open
      console.error('Void failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-40px)] w-full bg-background flex flex-col fixed top-10 inset-x-0 bottom-0">
      {/* Mobile View Tabs */}
      <div className="flex md:hidden sticky top-0 z-30 bg-card border-b">
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'products' ? "text-primary border-primary" : "text-muted-foreground border-transparent"
          )}
          onClick={() => setActiveTab('products')}
        >
          <div className="flex items-center justify-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </div>
        </button>
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'cart' ? "text-primary border-primary" : "text-muted-foreground border-transparent"
          )}
          onClick={() => setActiveTab('cart')}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <ShoppingCart className="h-4 w-4" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {cart.length}
                </span>
              )}
            </div>
            Cart
          </div>
        </button>
      </div>

      <div className="flex flex-1 h-[calc(100vh-48px)] md:h-full min-h-0 overflow-hidden">
        {/* Left Panel - Products (scrollable) - has right margin on md+ to make room for fixed cart */}
        <div className={cn(
          "relative flex-1 flex flex-col border-r bg-background h-full overflow-hidden md:mr-64 lg:mr-72 pb-16",
          activeTab !== 'products' && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border-b bg-card gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={handleHomeClick} title="Home" className="h-9 w-9">
                  <Home className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsPrinterSettingsOpen(true)} title="Printer Settings" className="h-9 w-9 text-slate-700 dark:text-slate-300">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleLogout} title="Log out" className="h-9 w-9 text-destructive hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
                <h1
                  className="text-lg md:text-xl font-semibold whitespace-nowrap select-none"
                  onClick={handleSecretClearStorage}
                >POS</h1>
              </div>
              <Button variant="outline" onClick={() => setOrdersDialogOpen(true)} className="md:hidden h-9 px-3">
                <Clock className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 min-w-[160px] sm:w-64 md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setCart([]); // Clear cart when location changes
                  toast.info('Location changed. Cart cleared.');
                }}
                className="h-9 px-2 py-1 rounded-md border border-input bg-background text-xs md:text-sm max-w-[120px]"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setOrdersDialogOpen(true)} className="hidden md:flex h-9">
                <Clock className="h-4 w-4 mr-2" />
                Orders
              </Button>
              {tableManagementEnabled && !selectedTable && (
                <Button variant="outline" className="h-9" onClick={() => setWantTablePicker(true)}>
                  <Utensils className="h-4 w-4 mr-2" />
                  Select Table
                </Button>
              )}
              {tableManagementEnabled && selectedTable && (
                <>
                  <span className="hidden md:inline-flex items-center gap-1 px-2 h-9 rounded-md border bg-primary/10 text-sm font-semibold whitespace-nowrap">
                    <Utensils className="h-4 w-4" /> {selectedTable.code}
                  </span>
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      if (cart.length > 0) { toast.error('Hold or complete the current cart before switching tables'); return; }
                      setSelectedTable(null);
                      setCurrentSaleId(null);
                    }}
                  >
                    Change Table
                  </Button>
                  {rights?.viewTableOrders !== 'no' && (
                    <Button
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        if (rights?.viewTableOrders === 'no') {
                          toast.error('You do not have permission to open Table Orders.');
                          return;
                        }
                        navigate('/table-orders');
                      }}
                    >
                      <Utensils className="h-4 w-4 mr-2" />
                      Table Orders
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refreshData();
                  toast.success('Refreshing products...');
                }}
                title="Refresh Products"
                className="h-9 w-9"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table picker (restaurant mode) */}
          {showTablePicker && (
            <div className="absolute inset-0 z-30 bg-background flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Select a Table</h2>
                  <p className="text-xs text-muted-foreground">Pick a table to start a new order</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleHomeClick} title="Home">
                    <Home className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refreshData()} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {wantTablePicker && (currentSaleId || cart.length > 0) && (
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWantTablePicker(false)} title="Close">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeTables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                    <Utensils className="h-10 w-10 mb-3 opacity-30" />
                    <p>No tables configured yet.</p>
                    <Button variant="outline" className="mt-3" onClick={() => navigate('/tables')}>Manage Tables</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {activeTables.map(t => {
                      const count = tableOpenCount(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTable({ id: t.id, code: t.code }); setWantTablePicker(false); }}
                          className={cn(
                            'border rounded-lg p-4 text-left transition hover:border-primary',
                            count > 0
                              ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                              : 'bg-card'
                          )}
                        >
                          <div className="text-lg font-bold">{t.code}</div>
                          {t.name && <div className="text-xs text-muted-foreground truncate">{t.name}</div>}
                          <div className={cn('text-xs mt-2', count > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                            {count > 0 ? `${count} open order${count > 1 ? 's' : ''}` : 'Available'}
                          </div>
                          {t.capacity != null && (
                            <div className="text-[10px] text-muted-foreground">{t.capacity} seats</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Body: collapsible category sidebar + product column */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Category sidebar */}
            {categorySidebarOpen ? (
              <aside className="w-40 sm:w-52 shrink-0 flex flex-col border-r bg-muted/30">
                <div className="flex items-center justify-between gap-1 h-10 px-2 border-b">
                  <span className="text-xs font-bold tracking-wider text-primary">CATEGORIES</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setCategorySidebarOpen(false)}
                    title="Collapse categories"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search Categories..."
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                  <button
                    onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2.5 min-h-[42px] text-[10px] font-semibold border-l-2 transition-colors text-left active:opacity-80",
                      selectedCategory === null
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-transparent hover:bg-muted text-foreground"
                    )}
                  >
                    <LayoutGrid className={cn("h-4 w-4 shrink-0", selectedCategory === null ? "text-primary-foreground" : "text-primary")} />
                    <span className="flex-1 break-words leading-tight">ALL PRODUCTS</span>
                    <span className={cn("text-[10px] shrink-0 tabular-nums", selectedCategory === null ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {totalActiveProducts}
                    </span>
                  </button>
                  {sidebarCategories.map(category => {
                    const active = selectedCategory === category.name;
                    return (
                      <button
                        key={category.name}
                        onClick={() => { setSelectedCategory(category.name); setSelectedSubcategory(null); }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2.5 min-h-[42px] text-[10px] font-medium border-l-2 transition-colors uppercase text-left active:opacity-80",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-transparent hover:bg-muted text-foreground"
                        )}
                      >
                        <LayoutGrid className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-primary")} />
                        <span className="flex-1 break-words leading-tight">{category.name}</span>
                        <span className={cn("text-[10px] shrink-0 tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {productCountByCategory[category.name] || 0}
                        </span>
                      </button>
                    );
                  })}
                  {sidebarCategories.length === 0 && (
                    <p className="px-2 py-2 text-[10px] text-muted-foreground italic">No categories match.</p>
                  )}
                </div>
              </aside>
            ) : (
              <button
                onClick={() => setCategorySidebarOpen(true)}
                className="w-9 shrink-0 flex flex-col items-center gap-2 border-r bg-muted/30 pt-2 hover:bg-muted transition-colors"
                title="Show categories"
              >
                <ChevronRight className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold tracking-wider text-primary [writing-mode:vertical-rl]">CATEGORIES</span>
              </button>
            )}

            {/* Product column */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Sub-categories (only when the selected main category has some) */}
          {subCategories.length > 0 && (
            <div className="flex gap-2 px-3 py-2 border-b bg-muted/60 backdrop-blur overflow-x-auto">
              <Button
                variant={selectedSubcategory === null ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedSubcategory(null)}
              >
                All {selectedCategory}
              </Button>
              {subCategories.map(sub => (
                <Button
                  key={sub.id}
                  variant={selectedSubcategory === sub.name ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubcategory(sub.name)}
                >
                  {sub.name}
                </Button>
              ))}
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 p-2 overflow-y-auto">
            {/* Pagination Info */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredProducts.length} products)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {paginatedProducts.map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);
                const variantCount = product.variants.filter(v => v.isActive !== false).length;
                return (
                  <div
                    key={product.id}
                    className="cursor-pointer group hover:border-primary transition-all border rounded overflow-hidden bg-card shadow-sm flex flex-col"
                    onClick={() => {
                      const activeVariants = product.variants.filter(v => v.isActive !== false);
                      if (activeVariants.length === 1) {
                        addToCart(activeVariants[0], product.name, product);
                      } else if (activeVariants.length === 0) {
                        toast.error(`${product.name} has no available variants. Please add a variant first.`);
                      } else {
                        setSelectedProduct(product);
                        setVariantDialogOpen(true);
                      }
                    }}
                  >
                    <div className="aspect-square relative bg-muted overflow-hidden flex items-center justify-center">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].startsWith('http') ? product.images[0] : `${getBaseUrl()}${product.images[0]}`}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">No img</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="text-white h-4 w-4" />
                      </div>
                      {totalStock <= 0 && !product.variants.some(v => v.hasRecipe) && (
                        <div className="absolute bottom-1 right-1">
                          <span className="text-[8px] text-red-600 font-bold bg-white/90 px-1 py-0.5 rounded shadow-sm">OUT OF STOCK</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex-1 flex flex-col">
                      <h4 className="font-medium text-[10px] line-clamp-3 leading-tight break-words min-h-[3em]" title={product.name}>{product.name}</h4>
                      <div className="mt-auto flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            {(() => {
                              const priceInfo = getProductPriceInfo(product, undefined, promotions || []);
                              return (
                                <>
                                  <span className={cn("font-bold text-xs", priceInfo.isOnSale ? "text-red-500" : "text-primary")}>
                                    {settings?.currency || '$'}{priceInfo.currentPrice.toFixed(0)}
                                  </span>
                                  {priceInfo.isOnSale && (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                      {settings?.currency || '$'}{priceInfo.originalPrice.toFixed(0)}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <span className={`text-[9px] px-1 py-0.5 rounded ${totalStock > 0 ? 'bg-muted text-muted-foreground' : 'bg-red-100 text-red-600'}`}>
                            {totalStock.toFixed(3)} qty
                          </span>
                        </div>
                        {variantCount > 1 && (
                          <span className="text-[9px] text-muted-foreground">
                            {variantCount} variants
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No products found</p>
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Cart (FIXED - no scroll) */}
        <div className={cn(
          "fixed inset-x-0 bottom-16 top-[48px] z-20 md:fixed md:inset-auto md:right-0 md:top-0 md:bottom-16 md:h-[calc(100vh-4rem)] md:w-64 lg:w-72 flex flex-col bg-card shadow-xl overflow-hidden",
          activeTab !== 'cart' ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 md:p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Current Sale
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="text-destructive h-8 px-2"
                  onClick={() => cancelWorkingOrder()}>
                  Clear
                </Button>
              )}
            </div>

            {/* Customer Selection */}
            <div className="flex gap-2">
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-start"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {selectedCustomer ? selectedCustomer.name : "Select customer..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {contextCustomers.filter(c => !c.customerType || c.customerType === 'POS' || c.customerType === 'BOTH').map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setSelectedCustomer(customer);
                              setCustomerPopoverOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{customer.name}</span>
                              {customer.phone && (
                                <span className="text-xs text-muted-foreground">{customer.phone}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedCustomer ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAddCustomerDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div key={cartViewKey} className="flex-1 p-2 overflow-y-auto">
            {currentSaleId && currentBillPrinted && (
              <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5 shrink-0" />
                  {billEditUnlocked
                    ? 'Bill already printed — re-print it after your changes.'
                    : 'The customer bill for this order was already printed.'}
                </span>
                {!billEditUnlocked && addToPrintedBillRight !== 'no' && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] shrink-0"
                    onClick={() => ensureBillEditable()}>
                    Unlock to edit
                  </Button>
                )}
              </div>
            )}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cart is empty</p>
                <p className="text-sm text-muted-foreground">Select products to add them to the cart</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map((item, idx) => (
                  <div key={item.cartItemId || `${item.variantId}-${idx}`} className="flex items-start gap-2 px-2 py-1.5 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[11px] leading-tight break-words">{item.productName}</p>
                      <p className="text-[10px] leading-tight text-muted-foreground font-medium mt-0.5 break-words">
                        {item.attributes && Object.keys(item.attributes).length > 0
                          ? Object.values(item.attributes).join(' / ')
                          : item.variantSku}
                      </p>
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <p className="text-[9px] leading-tight text-muted-foreground uppercase mt-0.5 break-words">{item.variantSku}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="h-5 p-0 hover:bg-transparent font-semibold text-primary text-xs sm:text-[13px]">
                            {settings?.currency || '$'}{(item.price * item.quantity).toFixed(2)}
                            <Edit className="ml-1 h-2.5 w-2.5 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="grid gap-2">
                            <Label htmlFor={`price-${item.cartItemId || item.variantId}`}>Unit Price override</Label>
                            <Input
                              id={`price-${item.cartItemId || item.variantId}`}
                              type="number"
                              defaultValue={item.price}
                              onChange={(e) => updatePrice(item.cartItemId || item.variantId, parseFloat(e.target.value))}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>

                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          onClick={() => updateQuantity(item.cartItemId || item.variantId, -1)}
                          disabled={item.quantity <= 1 || !!item.printed}
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </Button>
                        <span className="w-5 sm:w-6 text-center text-xs sm:text-[13px] font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          onClick={() => updateQuantity(item.cartItemId || item.variantId, 1)}
                          disabled={!!item.printed}
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </Button>
                        {item.printed && currentSaleId && currentSaleStatus === 'PAYMENT_PENDING' && canVoidPrinted ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5 text-amber-600 hover:text-destructive"
                            onClick={() => openVoidDialog(item)}
                            title="Void this printed item (supervisor approval)"
                          >
                            <Ban className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-5 w-5 sm:h-6 sm:w-6 ml-0.5 ${item.printed ? 'text-slate-300 cursor-not-allowed' : 'text-destructive'}`}
                            onClick={() => removeFromCart(item.cartItemId || item.variantId)}
                            disabled={!!item.printed}
                            title={item.printed ? "Printed KOT item - cannot delete" : "Remove item"}
                          >
                            <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary — totals */}
          <div className="px-3 pt-2 pb-2 border-t bg-muted/30">
            <div className="space-y-1">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{settings?.currency || '$'}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Tax (VAT)</span>
                <span>{settings?.currency || '$'}{tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm sm:text-base md:text-lg font-semibold">
                <span>Total</span>
                <span>{settings?.currency || '$'}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed full-page POS footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 h-14 flex border-t shadow-2xl overflow-x-auto">
        {/* Hold */}
        <button
          id="pos-hold-btn"
          disabled={cart.length === 0}
          onClick={handleHoldOrder}
          className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-amber-400 hover:bg-amber-500 text-white active:brightness-90"
        >
          <PauseCircle className="h-5 w-5" />
          Hold
        </button>

        {/* New */}
        <button
          id="pos-new-btn"
          onClick={() => {
            if (cart.length > 0) {
              handleHoldOrder();
              setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
            } else {
              // No held/loaded work to preserve — fully detach so nothing is left dangling.
              cancelWorkingOrder({ silent: true });
            }
            toast.info('New order started');
          }}
          className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all bg-cyan-500 hover:bg-cyan-600 text-white active:brightness-90"
        >
          <Plus className="h-5 w-5" />
          New
        </button>

        {/* Cancel — detaches from a loaded order without changing it in the DB */}
        <button
          id="pos-cancel-btn"
          disabled={cart.length === 0}
          onClick={() => cancelWorkingOrder()}
          className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-red-500 hover:bg-red-600 text-white active:brightness-90"
        >
          <Trash2 className="h-5 w-5" />
          Cancel
        </button>



        {/* Pay Later */}
        <button
          id="pos-pay-later-btn"
          disabled={cart.length === 0 || isProcessing}
          onClick={handlePayLater}
          className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-blue-500 hover:bg-blue-600 text-white active:brightness-90"
        >
          <Wallet className="h-5 w-5" />
          Place And Bill
        </button>

        {/* KOT */}
        <button
          id="pos-kot-btn"
          disabled={cart.length === 0 || isProcessing}
          onClick={handlePrintKOT}
          className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-blue-700 hover:bg-blue-800 text-white active:brightness-90"
        >
          <FileText className="h-5 w-5" />
          KOT
        </button>

        {/* Mob Money */}
        {(!rights || rights.posReceiveMobile !== 'no') && (
          <button
            id="pos-mob-money-btn"
            disabled={cart.length === 0}
            onClick={() => {
              if (!selectedCustomer) { toast.error('Please select a customer to proceed'); setCustomerPopoverOpen(true); return; }
              setPaymentMethods({ cash: { active: false, amount: '', reference: '' }, card: { active: false, amount: '', reference: '' }, mobile: { active: true, amount: total.toFixed(2), reference: '' }, bank: { active: false, amount: '', reference: '' }, complimentary: { active: false, amount: '', reference: '' } });
              setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
              setCheckoutOpen(true);
            }}
            className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-emerald-700 hover:bg-emerald-800 text-white active:brightness-90"
          >
            <Smartphone className="h-5 w-5" />
            Mob Money
          </button>
        )}

        {/* Bank Transfer */}
        {(!rights || rights.posReceiveBank !== 'no') && (
          <button
            id="pos-bank-btn"
            disabled={cart.length === 0}
            onClick={() => {
              if (!selectedCustomer) { toast.error('Please select a customer to proceed'); setCustomerPopoverOpen(true); return; }
              setPaymentMethods({ cash: { active: false, amount: '', reference: '' }, card: { active: false, amount: '', reference: '' }, mobile: { active: false, amount: '', reference: '' }, bank: { active: true, amount: total.toFixed(2), reference: '' }, complimentary: { active: false, amount: '', reference: '' } });
              setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
              setCheckoutOpen(true);
            }}
            className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-blue-600 hover:bg-blue-700 text-white active:brightness-90"
          >
            <Building className="h-5 w-5" />
            Bank
          </button>
        )}

        {/* Complimentary */}
        {(!rights || rights.posReceiveComplimentary !== 'no') && (
          <button
            id="pos-complimentary-btn"
            disabled={cart.length === 0}
            onClick={() => {
              if (!selectedCustomer) { toast.error('Please select a customer to proceed'); setCustomerPopoverOpen(true); return; }
              setPaymentMethods({ cash: { active: false, amount: '', reference: '' }, card: { active: false, amount: '', reference: '' }, mobile: { active: false, amount: '', reference: '' }, bank: { active: false, amount: '', reference: '' }, complimentary: { active: true, amount: total.toFixed(2), reference: '' } });
              setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
              setCheckoutOpen(true);
            }}
            className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-purple-600 hover:bg-purple-700 text-white active:brightness-90"
          >
            <Gift className="h-5 w-5" />
            Complimentary
          </button>
        )}

        {/* Pay Cash */}
        {(!rights || rights.posReceiveCash !== 'no') && (
          <button
            id="pos-pay-cash-btn"
            disabled={cart.length === 0}
            onClick={() => {
              if (!selectedCustomer) { toast.error('Please select a customer to proceed'); setCustomerPopoverOpen(true); return; }
              setPaymentMethods({ cash: { active: true, amount: total.toFixed(2), reference: '' }, card: { active: false, amount: '', reference: '' }, mobile: { active: false, amount: '', reference: '' }, bank: { active: false, amount: '', reference: '' }, complimentary: { active: false, amount: '', reference: '' } });
              setIdempotencyKey(`pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
              setCheckoutOpen(true);
            }}
            className="flex-1 min-w-[76px] flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-40 bg-teal-500 hover:bg-teal-600 text-white active:brightness-90"
          >
            <Banknote className="h-5 w-5" />
            Pay Cash
          </button>
        )}

      </div>

      <PaymentDialog
        module="POS"
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        totalAmount={Math.max(0, total - currentSalePaid)}
        allowPartialPayment={currentSalePaid > 0}
        initialPayments={paymentMethods as any}
        onSubmit={handleCheckout}
        isProcessing={isProcessing}
        onCancel={() => setCheckoutOpen(false)}
        title={currentSalePaid > 0 ? 'Receive Balance' : 'Complete Payment'}
        description={currentSalePaid > 0
          ? `${sym}${currentSalePaid.toFixed(2)} already paid — balance due ${sym}${Math.max(0, total - currentSalePaid).toFixed(2)}`
          : 'Select payment methods and process the transaction.'}
        extraActions={
          <Button
            size="sm"
            variant="outline"
            onClick={handlePayLater}
            disabled={isProcessing}
            id="pay-later-btn"
            className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950"
          >
            {isProcessing ? 'Saving...' : '📝 Place And Bill'}
          </Button>
        }
      />

      {/* Variant Selection Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Select a variant to add to the sale.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="aspect-video md:aspect-square bg-muted rounded-lg overflow-hidden">
              {selectedProduct?.images[0] ? (
                <img src={selectedProduct.images[0].startsWith('http') ? selectedProduct.images[0] : `${getBaseUrl()}${selectedProduct.images[0]}`} alt={selectedProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image available</div>
              )}
            </div>
            <div className="flex flex-col gap-3 max-h-[50vh] md:h-[400px] overflow-y-auto pr-2">
              {selectedProduct?.variants
                .filter(v => v.isActive !== false)
                .map((variant) => {
                  // correct stock check
                  const locationStock = variant.locationStock?.[selectedLocationId?.toString()] || 0;
                  const isOutOfStock = locationStock <= 0;
                  const canAdd = !isOutOfStock || negativeStockAllowed(selectedProduct, settings) || variant.hasRecipe;

                  return (
                    <div
                      key={variant.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary flex flex-col gap-2 ${!canAdd ? 'opacity-50 grayscale cursor-not-allowed' : 'bg-card'}`}
                      onClick={() => canAdd && selectedProduct && addToCart(variant, selectedProduct.name, selectedProduct)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">
                            {Object.keys(variant.attributes).length > 0
                              ? Object.values(variant.attributes).join(' / ')
                              : `SKU: ${variant.sku}`}
                          </p>
                          {Object.keys(variant.attributes).length > 0 && (
                            <p className="text-[10px] text-muted-foreground uppercase">{variant.sku}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          {(() => {
                            const priceInfo = getProductPriceInfo(selectedProduct, variant.id, promotions || []);
                            return (
                              <>
                                <span className={cn("font-bold text-sm", priceInfo.isOnSale ? "text-red-500" : "text-primary")}>
                                  {settings?.currency || '$'}{priceInfo.currentPrice.toFixed(2)}
                                </span>
                                {priceInfo.isOnSale && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {settings?.currency || '$'}{priceInfo.originalPrice.toFixed(2)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={locationStock <= variant.lowStockThreshold ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {locationStock.toFixed(3)} in stock
                        </span>
                        {locationStock <= 0 && !variant.hasRecipe && <Badge variant="destructive" className="text-[9px]">Out of Stock</Badge>}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders Manager Dialog */}
      <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] sm:w-[90vw] md:w-full h-[85vh] md:h-[80vh] flex flex-col p-3 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Order Management</DialogTitle>
              <Button variant="outline" size="sm" onClick={() => refreshData()} title="Refresh Orders">
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <DialogDescription>
              Manage active held orders and view past sales history.
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, customers..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Input
                type="date"
                value={orderStartDate}
                onChange={(e) => setOrderStartDate(e.target.value)}
                className="w-full flex-grow md:w-auto text-xs sm:text-sm"
              />
              <span className="flex items-center text-muted-foreground">-</span>
              <Input
                type="date"
                value={orderEndDate}
                onChange={(e) => setOrderEndDate(e.target.value)}
                className="w-full flex-grow md:w-auto text-xs sm:text-sm"
              />
            </div>
          </div>

          <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active (Held) Orders</TabsTrigger>
              <TabsTrigger value="pending-payment" id="pending-payments-tab" className="relative">
                Pending Payments
                {pendingPaymentSales.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold w-4 h-4">
                    {pendingPaymentSales.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="posted">Posted (History)</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="flex-1 overflow-y-auto mt-4">
              {filteredActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <PauseCircle className="h-10 w-10 mb-2 opacity-20" />
                  <p>No matching held orders</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 items-start">
                  {filteredActiveOrders.map(order => (
                    <div key={order.id} className="border rounded-md bg-card overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleExpandOrder(order.id)}>
                        {/* Row 1 */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-xs md:text-sm truncate min-w-0">
                            {order.customer ? order.customer.name : 'Walk-in Customer'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-xs md:text-sm whitespace-nowrap">
                              {sym}{order.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}
                            </span>
                            <Button size="sm" className="h-6 px-2 text-[10px] md:text-xs" onClick={(e) => {
                              e.stopPropagation();
                              handleResumeOrder(order);
                            }}>
                              <PlayCircle className="h-3 w-3 mr-1" />
                              Resume
                            </Button>
                            {expandedOrderId === order.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                        {/* Row 2 */}
                        <div className="mt-0.5 text-[10px] md:text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap leading-tight">
                          <span>{format(order.timestamp, 'MMM d, HH:mm')}</span>
                          <span>•</span>
                          <span>{order.items.length} items</span>
                        </div>
                      </div>

                      {expandedOrderId === order.id && (
                        <div className="px-2.5 py-2 bg-muted/10 border-t space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <div>{item.productName} <span className="text-muted-foreground">x{item.quantity}</span></div>
                              <div>{sym}{(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Pending Payments Tab */}
            <TabsContent value="pending-payment" className="flex-1 overflow-y-auto mt-4">
              {pendingPaymentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Wallet className="h-10 w-10 mb-2 opacity-20" />
                  <p>No pending payments</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 items-start">
                  {pendingPaymentSales.map(sale => (
                    <div key={sale.id} className="border border-amber-200 rounded-md bg-card overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpandOrder(sale.id)}>
                        {/* Row 1: ref + amount + actions */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-xs md:text-sm truncate min-w-0">
                            {sale.journalNumber || `Sale #${sale.id?.toString().slice(-6)}`}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-xs md:text-sm text-amber-700 whitespace-nowrap">
                              {sym}{(sale.totalAmount || sale.total || 0).toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] md:text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadPendingReceipt(sale);
                              }}
                            >
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Load to POS
                            </Button>
                            {canReceivePayment ? (
                              <Button
                                size="sm"
                                id={`receive-payment-btn-${sale.id}`}
                                className="h-6 px-2 text-[10px] md:text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReceivePaymentSale(sale);
                                  const due = Number(sale.totalAmount) || 0;
                                  setReceivePaymentMethods({
                                    cash: { active: false, amount: due.toFixed(2), reference: '' },
                                    card: { active: false, amount: '', reference: '' },
                                    mobile: { active: false, amount: '', reference: '' }
                                  });
                                }}
                              >
                                <Wallet className="h-3 w-3 mr-1" />
                                Receive Payment
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] md:text-xs"
                                disabled={printingBillId === sale.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if ((sale as any).billPrintedAt && !canReprintReceipt) {
                                    toast.error('This bill was already printed. You need the "Reprint Receipt" right to print it again.');
                                    return;
                                  }
                                  setPrintingBillId(sale.id);
                                  try {
                                    await handleReceiptAction(
                                      `${getBaseUrl()}/api/transactions/sale/${sale.id}/receipt`,
                                      sale.journalNumber || `Sale #${sale.id?.toString().slice(-6)}`,
                                      { autoPrint: true }
                                    );
                                    // Backend stamped billPrintedAt while rendering the PDF —
                                    // refetch so the row flips to "Re-print" and can't be double-printed.
                                    await refreshData?.();
                                  } finally {
                                    setPrintingBillId(null);
                                  }
                                }}
                              >
                                <Printer className="h-3 w-3 mr-1" />
                                {printingBillId === sale.id
                                  ? 'Printing…'
                                  : (sale as any).billPrintedAt ? 'Re-print Bill' : 'Print Bill'}
                              </Button>
                            )}
                            {expandedOrderId === sale.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                        {/* Row 2: meta */}
                        <div className="mt-0.5 text-[10px] md:text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap leading-tight">
                          <span>{format(new Date(sale.timestamp), 'MMM d, HH:mm')}</span>
                          <span>•</span>
                          <span className="text-amber-600 font-medium">Payment Pending</span>
                          {(sale as any).billPrintedAt && (<><span>•</span><span className="text-emerald-600 font-medium">Bill printed</span></>)}
                          {sale.tableName && (<><span>•</span><span className="font-medium text-foreground">Table {sale.tableName}</span></>)}
                          {sale.createdBy && (<><span>•</span><span>Served by {sale.createdBy}</span></>)}
                        </div>
                      </div>

                      {expandedOrderId === sale.id && (
                        <div className="px-2.5 py-2 bg-muted/10 border-t space-y-1">
                          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5 flex justify-between">
                            <span>ITEM</span>
                            <span>SUBTOTAL</span>
                          </div>
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <div>
                                {item.productName}
                                <span className="text-muted-foreground ml-2">
                                  ({Object.values(item.attributes || {}).join('/')}) x{Math.abs(item.adjustment || (item as any).quantity || 0)}
                                </span>
                              </div>
                              <div>{sym}{(item.price * Math.abs(item.adjustment || (item as any).quantity || 0)).toFixed(2)}</div>
                            </div>
                          ))}
                          <div className="border-t pt-1.5 mt-1 flex justify-between font-medium text-xs">
                            <span>Total Due</span>
                            <span className="text-amber-600">{sym}{(sale.totalAmount || sale.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="posted" className="flex-1 overflow-y-auto mt-4">
              {filteredSalesHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2 opacity-20" />
                  <p>No matching sales history</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 items-start">
                  {filteredSalesHistory.map(sale => (
                    <div key={sale.id} className="border rounded-md bg-card overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleExpandOrder(sale.id)}>
                        {/* Row 1: ref + amount + actions */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-xs md:text-sm truncate min-w-0">
                            {sale.journalNumber || `Sale #${sale.id.toString().slice(-6)}`}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-bold text-xs md:text-sm whitespace-nowrap">
                              {sym}{(sale.total || (sale as any).totalAmount || 0).toFixed(2)}
                            </span>
                            {rights?.reprintReceipt !== 'no' && (
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={(e) => {
                                e.stopPropagation();
                                handleReceiptAction(`${getBaseUrl()}/api/transactions/sale/${sale.id}/receipt`, sale.journalNumber || `Sale #${sale.id.toString().slice(-6)}`);
                              }} title="View/Print Receipt">
                                <Receipt className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] md:text-xs" onClick={(e) => {
                              e.stopPropagation();
                              handleReorder(sale);
                            }}>
                              Re-order
                            </Button>
                            {rights?.returnOrder !== 'no' && (
                              <Button size="sm" variant="destructive" className="h-6 px-1.5 text-[10px] md:text-xs" onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReturn(sale);
                              }}>
                                <RotateCcw className="h-3 w-3 mr-0.5" />
                                Return
                              </Button>
                            )}
                            {expandedOrderId === sale.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                        {/* Row 2: meta */}
                        <div className="mt-0.5 text-[10px] md:text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap leading-tight">
                          <span>{format(sale.timestamp, 'MMM d, HH:mm')}</span>
                          <span>•</span>
                          <span className="capitalize truncate">{sale.paymentMethod}</span>
                          {sale.tableName && (<><span>•</span><span className="font-medium text-foreground">Table {sale.tableName}</span></>)}
                          {sale.createdBy && (<><span>•</span><span className="truncate">Served by {sale.createdBy}</span></>)}
                        </div>
                      </div>

                      {expandedOrderId === sale.id && (
                        <div className="px-2.5 py-2 bg-muted/10 border-t space-y-1">
                          <div className="text-[10px] font-semibold text-muted-foreground mb-0.5 flex justify-between">
                            <span>ITEM</span>
                            <span>SUBTOTAL</span>
                          </div>
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <div>
                                {item.productName}
                                <span className="text-muted-foreground ml-2">
                                  ({Object.values(item.attributes || {}).join('/')}) x{Math.abs(item.adjustment || item.quantity || 0)}
                                </span>
                              </div>
                              <div>{sym}{(item.price * Math.abs(item.adjustment || item.quantity || 0)).toFixed(2)}</div>
                            </div>
                          ))}
                          <div className="border-t pt-1.5 mt-1 flex justify-between font-medium text-xs">
                            <span>Total</span>
                            <span>{sym}{(sale.total || (sale as any).totalAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Void Printed KOT Item Dialog (supervisor override) */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-600" />
              Void printed item
            </DialogTitle>
            <DialogDescription>
              This item was already sent to the kitchen and its stock deducted. Voiding it
              removes it from the bill, restores stock, prints a cancellation slip, and is
              recorded as a cancelled return receipt. Needs a supervisor (admin / manager).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{voidTarget?.item.productName}</div>
              <div className="text-muted-foreground text-xs">
                On the bill: {voidTarget?.maxQty} × {sym}{(voidTarget?.item.price || 0).toFixed(2)}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voidQty">Quantity to void</Label>
              <Input
                id="voidQty"
                type="number"
                min={1}
                max={voidTarget?.maxQty ?? 1}
                value={voidQty}
                onChange={(e) => setVoidQty(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voidReason">Reason (optional)</Label>
              <Input
                id="voidReason"
                placeholder="e.g. wrong item fired, customer changed mind"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="voidSupUser">Supervisor username</Label>
                <Input
                  id="voidSupUser"
                  autoComplete="off"
                  value={voidSupUser}
                  onChange={(e) => setVoidSupUser(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="voidSupPass">Password</Label>
                <Input
                  id="voidSupPass"
                  type="password"
                  autoComplete="off"
                  value={voidSupPass}
                  onChange={(e) => setVoidSupPass(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={isProcessing}>Cancel</Button>
            <Button variant="destructive" onClick={submitVoid} disabled={isProcessing}>
              {isProcessing ? 'Voiding…' : 'Void item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock editing of a bill-printed order (supervisor) */}
      <Dialog open={billUnlockDialogOpen} onOpenChange={(o) => { if (!o) setBillUnlockDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-amber-600" />
              Supervisor approval
            </DialogTitle>
            <DialogDescription>
              This order's customer bill was already printed. A supervisor (admin / manager)
              must approve adding items. The bill will be marked for re-printing.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="billSupUser">Supervisor username</Label>
              <Input id="billSupUser" autoComplete="off" value={billUnlockSupUser}
                onChange={(e) => setBillUnlockSupUser(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billSupPass">Password</Label>
              <Input id="billSupPass" type="password" autoComplete="off" value={billUnlockSupPass}
                onChange={(e) => setBillUnlockSupPass(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillUnlockDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={submitBillUnlock} disabled={isProcessing}>
              {isProcessing ? 'Checking…' : 'Unlock editing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
            <DialogDescription>
              Select items to return from Sale #{saleToReturn?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {saleToReturn && Array.from(new Set(saleToReturn.items.map(i => i.variantId))).map((variantId, idx) => {
              const item = saleToReturn.items.find(i => i.variantId === variantId)!;
              const returnItem = returnItems.find(r => r.variantId === variantId);

              const limit = returnableLimits[variantId] || { original: 0, returned: 0, remaining: 0 };
              const maxQty = limit.remaining;

              const currentQty = returnItem?.quantity || 0;
              const isFullyReturned = maxQty <= 0;

              return (
                <div key={idx} className={cn("flex items-center justify-between border-b pb-4 last:border-0", isFullyReturned && "opacity-50")}>
                  <div className="flex-1">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-sm text-muted-foreground">
                      Sold: {limit.original} | Ret: {limit.returned} | <span className={cn("font-medium", isFullyReturned ? "text-red-500" : "text-green-600")}>Rem: {maxQty}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReturnAmountChange(item.variantId, currentQty - 1, maxQty)}
                      disabled={currentQty <= 0 || isFullyReturned}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div className="w-8 text-center">{currentQty}</div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReturnAmountChange(item.variantId, currentQty + 1, maxQty)}
                      disabled={currentQty >= maxQty || isFullyReturned}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">Total Refund</span>
              <span className="text-xl font-bold">{sym}{calculateReturnTotal().toFixed(2)}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
              <Button variant="destructive" onClick={submitReturn} disabled={calculateReturnTotal() <= 0 || isProcessing}>
                {isProcessing ? 'Processing...' : 'Confirm Return'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerDialogOpen} onOpenChange={setAddCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer profile for this sale.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customerName">Name *</Label>
              <Input
                id="customerName"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="customer@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input 
                id="customerPhone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0700 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input
                id="idNumber"
                value={newCustomer.idNumber}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, idNumber: e.target.value }))}
                placeholder="National ID or Passport"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerType">Customer Type</Label>
              <Select 
                value={newCustomer.customerType} 
                onValueChange={(val) => setNewCustomer(prev => ({ ...prev, customerType: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POS">POS Customer</SelectItem>
                  <SelectItem value="ROOM">Room Customer</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustomerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} disabled={!newCustomer.name.trim()}>
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Current table's open orders */}
      <Dialog open={tableOrdersOpen} onOpenChange={setTableOrdersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Table {selectedTable?.code} — open orders</DialogTitle>
            <DialogDescription>Open any bill to keep adding items or take payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
            {currentTableOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No open orders on this table yet.</p>
            ) : (
              currentTableOrders.map(s => {
                const bal = Math.max(0, Number(s.totalAmount || 0) - Number(s.amountPaid || 0));
                const gross = Number(s.totalAmount || 0);
                const ratio = gross > 0 ? bal / gross : 1;
                const balColor = bal <= 0
                  ? 'text-emerald-600'
                  : ratio >= 0.999 ? 'text-red-700 dark:text-red-500'
                  : ratio >= 0.5 ? 'text-red-600 dark:text-red-400'
                  : 'text-red-400 dark:text-red-300';
                return (
                  <div key={s.journalNumber} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="font-mono text-xs">{s.journalNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {(s.items || []).length} items
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${balColor}`}>{settings?.currency || ''}{bal.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">balance</div>
                      </div>
                      {rights?.editTableOrder !== 'no' && (
                        <Button size="sm" onClick={() => handleLoadPendingReceipt(s as Sale)}>
                          <ShoppingCart className="h-4 w-4 mr-1" /> Open
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableOrdersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        module="POS"
        open={!!receivePaymentSale}
        onOpenChange={(open) => {
          if (!open && !isReceivingPayment) {
            setReceivePaymentSale(null);
          }
        }}
        totalAmount={Number(receivePaymentSale?.totalAmount || 0)}
        onSubmit={handleReceivePayment}
        isProcessing={isReceivingPayment}
        onCancel={() => setReceivePaymentSale(null)}
        title="Receive Payment"
        description={`Record payment for order #${receivePaymentSale?.journalNumber}`}
        submitText="Confirm Payment"
      />

      {/* Receipt Preview Dialog */}
      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipt Preview{receiptPreviewLabel ? ` — ${receiptPreviewLabel}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted">
            {receiptPreviewUrl && (
              <iframe
                ref={receiptIframeRef}
                src={receiptPreviewUrl}
                className="w-full h-full border-none"
                title="Receipt Preview"
                onLoad={() => {
                  if (settings?.autoPrintReceipts) {
                    handlePrint();
                  }
                }}
              />
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-card flex justify-between">
            <Button variant="outline" onClick={() => setReceiptPreviewOpen(false)}>Close</Button>
            {receiptPreviewUrl && (
              <Button onClick={handlePrint}>
                <Receipt className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workstation Printer Settings Dialog */}
      <Dialog open={isPrinterSettingsOpen} onOpenChange={setIsPrinterSettingsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workstation Printer Settings</DialogTitle>
            <DialogDescription>
              Configure printer preferences for this specific workstation. These settings are saved in your local browser storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 my-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="localPrinterName" className="font-semibold">Receipt Printer</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary"
                  onClick={fetchLocalPrinters}
                  disabled={isFetchingPrinters}
                >
                  {isFetchingPrinters ? "Loading..." : "Reload List"}
                </Button>
              </div>
              {localPrinters.length > 0 ? (
                <Select value={localPrinter} onValueChange={setLocalPrinter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {localPrinters.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    id="localPrinterName"
                    value={localPrinter}
                    onChange={(e) => setLocalPrinter(e.target.value)}
                    className="w-full"
                    placeholder="e.g. Receipt Printer"
                  />
                  <p className="text-xs text-muted-foreground">Print service offline. Enter printer name manually.</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">KOT Printer Mappings (By Category)</h4>
                <p className="text-xs text-muted-foreground">Route kitchen order tickets for main categories to specific kitchen/bar printers.</p>
              </div>
              {mainCategories.length > 0 && (
                <Input
                  value={kotCatSearch}
                  onChange={(e) => setKotCatSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="h-9"
                />
              )}
              {(() => {
                const list = mainCategories
                  .filter(c => c.name.toLowerCase().includes(kotCatSearch.trim().toLowerCase()))
                  .sort((a, b) => a.name.localeCompare(b.name));
                if (mainCategories.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">No categories available to map.</p>;
                }
                if (list.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">No categories match "{kotCatSearch}".</p>;
                }
                return (
                <div className="space-y-3">
                  {list.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between gap-4">
                      <Label className="text-xs font-medium flex-1 truncate">{cat.name}</Label>
                      {localPrinters.length > 0 ? (
                        <Select
                          value={posPrinterMappings[cat.name] || 'Receipt Printer'}
                          onValueChange={(val) => setPosPrinterMappings(prev => ({ ...prev, [cat.name]: val }))}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select KOT printer" />
                          </SelectTrigger>
                          <SelectContent>
                            {localPrinters.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={posPrinterMappings[cat.name] || ''}
                          onChange={(e) => setPosPrinterMappings(prev => ({ ...prev, [cat.name]: e.target.value }))}
                          className="w-56"
                          placeholder="e.g. Kitchen Printer"
                        />
                      )}
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPrinterSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePrinterSettings}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Hidden iframe for background auto-printing */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', visibility: 'hidden' }}>
        {settings?.autoPrintReceipts && receiptPreviewUrl && (
          <iframe
            key={receiptPreviewUrl} // Key identifies new print jobs
            ref={autoPrintIframeRef}
            src={receiptPreviewUrl}
            onLoad={() => {
              if (autoPrintIframeRef.current) {
                try {
                  autoPrintIframeRef.current.contentWindow?.focus();
                  autoPrintIframeRef.current.contentWindow?.print();
                } catch (e) {
                  console.error("Background print failed:", e);
                }
              }
            }}
            title="Auto Print Iframe"
          />
        )}
      </div>

      {/* Post Action Logout Prompt */}
      <Dialog open={postActionPromptOpen} onOpenChange={setPostActionPromptOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Action Successful</DialogTitle>
            <DialogDescription>
              Your transaction was processed successfully. What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setPostActionPromptOpen(false)}>
              Stay Here
            </Button>
            <Button variant="destructive" onClick={() => { setPostActionPromptOpen(false); logout(); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
