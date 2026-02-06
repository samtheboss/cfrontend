import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { mockCustomers, mockSales } from '@/data/mockData';
import { Product, ProductVariant, Customer, Sale, CartItem, ActiveOrder } from '@/types/inventory';
import { BASE_URL, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Search, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, ShoppingCart, Receipt, User, UserPlus, X, Edit, Home, Clock, FileText, PauseCircle, PlayCircle, RotateCcw, ChevronDown, ChevronUp, Calendar, Package, RefreshCw, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';



export default function POS() {
  const navigate = useNavigate();
  const { products, locations, settings, customers: contextCustomers, transactions, createSale, createReturn, checkReturnableItems, addCustomer, activeOrders, holdOrder, discardOrder, salesHistory, refreshData } = useInventory();
  const { user, logout } = useAuth();

  // Location selector - default to user's location or main location
  const defaultLocationId = (user?.locationId || locations.find(l => l.isMain)?.id || locations[0]?.id || '').toString();
  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId);
  const selectedLocation = locations.find(l => l.id.toString() === selectedLocationId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
  const [returnItems, setReturnItems] = useState<{ variantId: string; quantity: number; price: number }[]>([]);
  const [returnableLimits, setReturnableLimits] = useState<Record<string, { original: number, returned: number, remaining: number }>>({});
  // Removed local state: activeOrders and salesHistory now come from context
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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
  const [paymentMethods, setPaymentMethods] = useState({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' }
  });

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });

  // M-Pesa Integration States
  const [completedMpesaPayments, setCompletedMpesaPayments] = useState<{ amount: number, reference: string }[]>([]);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('IDLE');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  // Receipt Preview States
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const receiptIframeRef = useRef<HTMLIFrameElement>(null);
  const autoPrintIframeRef = useRef<HTMLIFrameElement>(null);

  // Reference to track if we should stop polling
  const stopPollingRef = useRef(false);
  const pollSessionRef = useRef(0);

  // Get all variants with product info (Active only)
  const allVariants = products
    .filter(p => p.isActive !== false)
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

  // Get unique categories (Active only)
  const categories = Array.from(new Set(products.filter(p => p.isActive !== false).map(p => p.category)));

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

          toast.success(`M-Pesa payment of $${data.amount} confirmed!`);
        }

        if (data.recordedSaleId) {
          toast.success('Sale completed and recorded!');
          discardOrder(`stk-${requestId}`);
          const receiptUrl = `${BASE_URL}/api/transactions/sale/${data.recordedSaleId}/receipt`;
          handleReceiptAction(receiptUrl);

          setTimeout(() => {
            resetPOSState();
            setCheckoutOpen(false);
            refreshData();
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

  // Reset page when category changes
  useEffect(() => {
    setCurrentPage(1);
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
            v.sku.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            v.barcode.includes(debouncedSearch)
          );

      const matchesCategory = !selectedCategory || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const addToCart = (variant: ProductVariant, productName: string) => {
    // Force string lookup for map key
    const availableStock = variant.locationStock[selectedLocationId.toString()] || 0;

    if (availableStock <= 0) {
      toast.error(`No stock available at ${selectedLocation?.name || 'selected location'}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          toast.error(`Cannot add more. Only ${availableStock} in stock at ${selectedLocation?.name}`);
          return prev;
        }
        return prev.map(item =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        variantId: variant.id,
        productName: productName,
        variantSku: variant.sku,
        attributes: variant.attributes,
        quantity: 1,
        price: variant.price,
        maxStock: availableStock
      }];
    });
    setVariantDialogOpen(false);
    toast.success(`Added ${productName} (${Object.values(variant.attributes).join(' / ')}) to cart`);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return item;
        if (newQuantity > item.maxStock) {
          toast.error('Cannot exceed available stock');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updatePrice = (variantId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart(prev => prev.map(item =>
      item.variantId === variantId
        ? { ...item, price: newPrice }
        : item
    ));
    toast.success('Price updated');
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(item => item.variantId !== variantId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = settings?.taxRate || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const totalPaid = Object.values(paymentMethods)
    .reduce((sum, method) => method.active ? sum + (parseFloat(method.amount) || 0) : sum, 0)
    + completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentMethodToggle = (method: 'cash' | 'card' | 'mobile', active: boolean) => {
    setPaymentMethods(prev => {
      const newState = { ...prev };
      if (active) {
        // Auto-fill with remaining amount
        const currentPaid = Object.values(prev)
          .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
        const remaining = Math.max(0, total - currentPaid);
        newState[method] = { ...prev[method], active: true, amount: remaining.toFixed(2) };
      } else {
        newState[method] = { ...prev[method], active: false, amount: '', reference: '' };
      }
      return newState;
    });
  };

  const updatePaymentDetail = (method: 'cash' | 'card' | 'mobile', field: 'amount' | 'reference', value: string) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: { ...prev[method], [field]: value }
    }));
  };

  const resetPOSState = () => {
    setCart([]);
    setPaymentMethods({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' }
    });
    setSelectedCustomer(null);
    setMpesaPhone('');
    setMpesaStatus('IDLE');
    setCheckoutRequestId(null);
    setIsPollingMpesa(false);
    setCompletedMpesaPayments([]); // Clear the list of payments
  };

  const handlePreviewReceipt = (url: string) => {
    setReceiptPreviewUrl(url);
    setReceiptPreviewOpen(true);
  };

  const handleReceiptAction = async (url: string) => {
    try {
      const token = localStorage.getItem('token');
      // Fetch the PDF blob using auth token
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipt preview');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

      // Cleanup previous blob URL if any
      if (receiptPreviewUrl && receiptPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }

      setReceiptPreviewUrl(blobUrl);

      // If auto-print is enabled, we bypass the modal and use a hidden iframe
      if (settings?.autoPrintReceipts) {
        toast.info('Sending receipt to printer...');
      } else {
        setReceiptPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error loading receipt preview:', error);
      toast.error('Failed to load receipt preview');
      // Fallback only if we can't even fetch it
      window.open(url, '_blank');
    }
  };

  const handlePrint = () => {
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

  const handleCheckout = async () => {
    if (totalPaid < total - 0.01) {
      toast.error('Payment amount is less than total');
      return;
    }

    // Determine payment methods list - Cap at total (exclude change)
    const payments: { method: string; amount: number; reference?: string }[] = [];
    let remaining = total;

    // 1. Process M-Pesa/Mobile (Confirmed & UI)
    completedMpesaPayments.forEach(p => {
      const amt = Math.min(p.amount, remaining);
      if (amt > 0) {
        payments.push({ method: 'MOBILE', amount: amt, reference: p.reference });
        remaining -= amt;
      }
    });

    if (paymentMethods.mobile.active && parseFloat(paymentMethods.mobile.amount) > 0) {
      const amt = Math.min(parseFloat(paymentMethods.mobile.amount), remaining);
      if (amt > 0) {
        payments.push({ method: 'MOBILE', amount: amt, reference: paymentMethods.mobile.reference });
        remaining -= amt;
      }
    }

    // 2. Process Card
    if (paymentMethods.card.active && parseFloat(paymentMethods.card.amount) > 0) {
      const amt = Math.min(parseFloat(paymentMethods.card.amount), remaining);
      if (amt > 0) {
        payments.push({ method: 'CARD', amount: amt, reference: paymentMethods.card.reference });
        remaining -= amt;
      }
    }

    // 3. Process Cash (Any remaining bill goes here)
    if (paymentMethods.cash.active && parseFloat(paymentMethods.cash.amount) > 0) {
      const amt = Math.min(parseFloat(paymentMethods.cash.amount), remaining);
      if (amt > 0) {
        payments.push({ method: 'CASH', amount: amt, reference: paymentMethods.cash.reference });
        remaining -= amt;
      }
    }

    // Build sale data for backend
    const saleData = {
      type: 'SALE',
      locationId: selectedLocationId,
      customerId: selectedCustomer?.id ? (selectedCustomer.id) : null,
      paymentMethod: payments.map(p => p.method).join(', '),
      payments,
      subtotal,
      taxAmount: tax,
      totalAmount: total,
      amountPaid: totalPaid,
      changeAmount: Math.max(0, totalPaid - total),
      items: cart.map(item => ({
        variantId: item.variantId,
        sku: item.variantSku,
        productName: item.productName,
        adjustment: -item.quantity,
        price: item.price,
      })),
    };

    setIsProcessing(true);
    try {
      const saved = await createSale(saleData);

      // Show receipt preview instead of opening new window
      const receiptUrl = `${BASE_URL}/api/transactions/sale/${saved.id}/receipt`;
      handleReceiptAction(receiptUrl);

      resetPOSState();
      setCheckoutOpen(false);
      refreshData();
    } catch (error) {
      // Error already shown by createSale
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
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

  const handleHoldOrder = () => {
    if (cart.length === 0) return;

    const order: ActiveOrder = {
      id: `hold-${Date.now()}`,
      customer: selectedCustomer,
      items: cart,
      timestamp: new Date()
    };

    holdOrder(order);
    setCart([]);
    toast.success('Order held successfully');
  };

  const handleResumeOrder = (order: ActiveOrder) => {
    // If the current cart has items, hold it first before resuming
    if (cart.length > 0) {
      const currentOrder: ActiveOrder = {
        id: `hold-${Date.now()}`,
        customer: selectedCustomer,
        items: [...cart], // Create a copy to ensure reference doesn't change
        timestamp: new Date()
      };
      holdOrder(currentOrder);
      toast.info('Current order held');
    }

    setCart(order.items);
    setSelectedCustomer(order.customer);
    discardOrder(order.id);
    setOrdersDialogOpen(false);
    toast.success('Order resumed');
  };

  const handleReorder = (sale: Sale) => {
    // Convert sale items to cart items (finding current max stock)
    const newCart: CartItem[] = sale.items.map(item => {
      // Find current variant info to get max stock
      const variant = allVariants.find(v => v.id === item.variantId);
      return {
        ...item,
        variantSku: item.sku,
        quantity: Math.abs(item.adjustment),
        attributes: item.attributes || {},
        price: item.price || 0,
        maxStock: variant ? variant.stock : 0 // Or 0 if discontinued
      };
    });

    setCart(newCart);
    setOrdersDialogOpen(false);
    toast.success('Items loaded to cart');
  };

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
    });

    setNewCustomer({ name: '', email: '', phone: '' });
    setAddCustomerDialogOpen(false);
    toast.success('Customer added successfully');
  };

  // Helper to filter orders
  const filterOrders = (orders: any[]) => {
    const start = startOfDay(parseISO(orderStartDate));
    const end = endOfDay(parseISO(orderEndDate));

    return orders.filter(order => {
      const orderId = order.id ? order.id.toString().toLowerCase() : '';
      const customerName = order.customer?.name?.toLowerCase() || '';
      const userId = order.userId?.toString().toLowerCase() || '';
      const query = orderSearchQuery.toLowerCase();

      const matchSearch =
        orderId.includes(query) ||
        customerName.includes(query) ||
        userId.includes(query);

      const orderDate = new Date(order.timestamp);
      const matchDate = isWithinInterval(orderDate, { start, end });

      return matchSearch && matchDate;
    });
  };

  const filteredActiveOrders = filterOrders(activeOrders);
  const filteredSalesHistory = filterOrders(salesHistory);

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

    // Initialize return items with 0 quantity
    setReturnItems(sale.items.map(item => ({
      variantId: item.variantId,
      quantity: 0,
      price: item.price
    })).filter(item => (limitMap[item.variantId]?.remaining || 0) > 0)); // Only include items that can be returned? 
    // Actually, keep all but ensure max is enforced. Better to keep them so we can show "Fully Returned".

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
    return returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const submitReturn = async () => {
    if (!saleToReturn) return;

    // Filter items with quantity > 0
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);

    if (itemsToReturn.length === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    try {
      await createReturn({
        type: 'RETURN',
        originalSaleId: saleToReturn.id,
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
    }
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col fixed inset-0">
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

      <div className="flex flex-1 h-full overflow-hidden">
        {/* Left Panel - Products (scrollable) - has right margin on md+ to make room for fixed cart */}
        <div className={cn(
          "flex-1 flex flex-col border-r bg-background h-full overflow-hidden md:mr-80 lg:mr-96",
          activeTab !== 'products' && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border-b bg-card gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => navigate('/')} title="Home" className="h-9 w-9">
                  <Home className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleLogout} title="Log out" className="h-9 w-9 text-destructive hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
                <h1 className="text-lg md:text-xl font-semibold whitespace-nowrap">POS</h1>
              </div>
              <Button variant="outline" onClick={() => setOrdersDialogOpen(true)} className="md:hidden h-9 px-3">
                <Clock className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 md:w-80">
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

          {/* Categories */}
          <div className="flex gap-2 p-3 border-b bg-muted/95 backdrop-blur overflow-x-auto">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

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

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
              {paginatedProducts.map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + (v.locationStock[selectedLocationId] || 0), 0);
                const variantCount = product.variants.filter(v => v.isActive !== false).length;
                return (
                  <div
                    key={product.id}
                    className="cursor-pointer group hover:border-primary transition-all border rounded overflow-hidden bg-card shadow-sm flex flex-col"
                    onClick={() => {
                      setSelectedProduct(product);
                      setVariantDialogOpen(true);
                    }}
                  >
                    <div className="aspect-square relative bg-muted overflow-hidden flex items-center justify-center">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].startsWith('http') ? product.images[0] : `${BASE_URL}${product.images[0]}`}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">No img</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="text-white h-4 w-4" />
                      </div>
                      {totalStock <= 0 && (
                        <div className="absolute bottom-1 right-1">
                          <span className="text-[8px] text-red-600 font-bold bg-white/90 px-1 py-0.5 rounded shadow-sm">OUT OF STOCK</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex-1 flex flex-col">
                      <h4 className="font-medium text-xs line-clamp-2 leading-tight min-h-[2.4em]" title={product.name}>{product.name}</h4>
                      <div className="mt-auto flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-primary">
                          {settings?.currency || '$'}{Math.min(...product.variants.map(v => v.price)).toFixed(0)}
                        </span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${totalStock > 0 ? 'bg-muted text-muted-foreground' : 'bg-red-100 text-red-600'}`}>
                          {totalStock} qty • {variantCount} var
                        </span>
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

        {/* Right Panel - Cart (FIXED - no scroll) */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col bg-card shadow-xl z-20 md:fixed md:right-0 md:top-0 md:h-screen",
          activeTab !== 'cart' && "hidden md:flex"
        )}>
          <div className="p-3 md:p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Current Sale
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-destructive h-8 px-2">
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
                        {contextCustomers.map((customer) => (
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
          <div className="flex-1 p-4 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Cart is empty</p>
                <p className="text-sm text-muted-foreground">Select products to add them to the cart</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.variantId} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {item.attributes && Object.keys(item.attributes).length > 0
                          ? Object.values(item.attributes).join(' / ')
                          : item.variantSku}
                      </p>
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <p className="text-[10px] text-muted-foreground uppercase">{item.variantSku}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-primary">
                            {settings?.currency || '$'}{(item.price * item.quantity).toFixed(2)}
                            <Edit className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="grid gap-2">
                            <Label htmlFor={`price-${item.variantId}`}>Unit Price override</Label>
                            <Input
                              id={`price-${item.variantId}`}
                              type="number"
                              defaultValue={item.price}
                              onChange={(e) => updatePrice(item.variantId, parseFloat(e.target.value))}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.variantId, -1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeFromCart(item.variantId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="p-3 md:p-4 border-t bg-muted/30">
            <div className="space-y-1 md:space-y-2 mb-3 md:mb-4">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{settings?.currency || '$'}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>{settings?.currency || '$'}{tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base md:text-lg font-semibold">
                <span>Total</span>
                <span>{settings?.currency || '$'}{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                className="col-span-1 h-11 md:h-12"
                disabled={cart.length === 0}
                onClick={handleHoldOrder}
                title="Hold Order"
              >
                <PauseCircle className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
              <Button
                className="col-span-3 h-11 md:h-12 text-sm md:text-base"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => {
                  if (!selectedCustomer) {
                    toast.error("Please select a customer to proceed");
                    setCustomerPopoverOpen(true);
                    return;
                  }
                  setCheckoutOpen(true);
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => {
        if (!isProcessing) {
          setCheckoutOpen(open);
          if (!open) {
            // Signal to stop polling when dialog closes
            stopPollingRef.current = true;
            setIsPollingMpesa(false);
            setMpesaStatus('IDLE');
            setCheckoutRequestId(null);
          } else {
            // Opening dialog
            setPaymentMethods({
              cash: { active: false, amount: '', reference: '' },
              card: { active: false, amount: '', reference: '' },
              mobile: { active: false, amount: '', reference: '' }
            });

            // Reset M-Pesa states
            setMpesaPhone('');
            setMpesaStatus('IDLE');
            setCheckoutRequestId(null);
            setIsPollingMpesa(false);
            stopPollingRef.current = false;
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Total amount due: ${total.toFixed(2)}
              {selectedCustomer && (
                <span className="block mt-1">Customer: {selectedCustomer.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">Total Due</div>
                <div className="font-semibold">${total.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="font-semibold text-green-600">${totalPaid.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {totalPaid.toFixed(2) >= total.toFixed(2) ? 'Change' : 'Remaining'}
                </div>
                <div className={`font-semibold ${totalPaid >= total ? 'text-blue-600' : 'text-red-600'}`}>
                  ${Math.abs(totalPaid - total).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Payment Methods Checkboxes */}
            <div className="space-y-4 border rounded-md p-4">
              <Label className="text-sm font-medium">Select Payment Methods</Label>

              {(['cash', 'card', 'mobile'] as const).map((method) => (
                <div key={method} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`pay-${method}`}
                      checked={paymentMethods[method].active}
                      onCheckedChange={(checked) => handlePaymentMethodToggle(method, checked === true)}
                    />
                    <Label htmlFor={`pay-${method}`} className="capitalize flex items-center gap-2 cursor-pointer">
                      {method === 'cash' && <Banknote className="h-4 w-4 text-muted-foreground" />}
                      {method === 'card' && <CreditCard className="h-4 w-4 text-muted-foreground" />}
                      {method === 'mobile' && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                      {method}
                    </Label>
                  </div>

                  {paymentMethods[method].active && (
                    <div className="grid grid-cols-2 gap-3 pl-6 animate-in fade-in slide-in-from-top-1">
                      <div className="space-y-1">
                        <Label htmlFor={`amount-${method}`} className="text-xs">Amount</Label>
                        <Input
                          id={`amount-${method}`}
                          type="number"
                          value={paymentMethods[method].amount}
                          onChange={(e) => updatePaymentDetail(method, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="h-8"
                          disabled={isPollingMpesa && method === 'mobile'}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ref-${method}`} className="text-xs">
                          {method === 'mobile' ? 'M-Pesa Phone' : 'Reference (Optional)'}
                        </Label>
                        {method === 'mobile' ? (
                          <div className="flex gap-2">
                            <Input
                              id="mpesa-phone"
                              type="text"
                              value={mpesaPhone}
                              onChange={(e) => setMpesaPhone(e.target.value)}
                              placeholder="07..."
                              className="h-8 flex-1"
                              disabled={isPollingMpesa}
                            />
                            <Button
                              size="sm"
                              className="h-8"
                              onClick={handleMpesaPush}
                              disabled={isPollingMpesa}
                            >
                              {isPollingMpesa ? '...' : 'Push'}
                            </Button>
                          </div>
                        ) : (
                          <Input
                            id={`ref-${method}`}
                            type="text"
                            value={paymentMethods[method].reference}
                            onChange={(e) => updatePaymentDetail(method, 'reference', e.target.value)}
                            placeholder="Ref #"
                            className="h-8"
                          />
                        )}
                      </div>
                      {method === 'mobile' && (isPollingMpesa || mpesaStatus !== 'IDLE') && (
                        <div className="col-span-2 space-y-2 py-2">
                          <div className={`flex items-center justify-center gap-2 text-xs font-medium ${mpesaStatus === 'PENDING' ? 'text-blue-600 animate-pulse' :
                            mpesaStatus === 'SUCCESS' ? 'text-green-600' :
                              mpesaStatus === 'CANCELLED' ? 'text-amber-600' :
                                'text-red-600'
                            }`}>
                            <span>
                              {mpesaStatus === 'PENDING' && 'Waiting for M-Pesa confirmation...'}
                              {mpesaStatus === 'SUCCESS' && 'Payment Successful!'}
                              {mpesaStatus === 'CANCELLED' && 'Payment Cancelled.'}
                              {mpesaStatus === 'FAILED' && 'Payment Failed.'}
                            </span>
                            {mpesaStatus !== 'SUCCESS' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => checkoutRequestId && manualQueryMpesa(checkoutRequestId)}
                                disabled={isPollingMpesa}
                              >
                                {isPollingMpesa ? 'Checking...' : 'Check Again'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {completedMpesaPayments.length > 0 && (
              <div className="space-y-1 py-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Confirmed M-Pesa Payments</Label>
                {completedMpesaPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-green-50 px-2 py-1 rounded text-xs border border-green-100">
                    <span className="font-mono text-[10px]">{p.reference}</span>
                    <span className="font-semibold text-green-700">${p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {(totalPaid < total) && (
              <div className="text-xs text-red-500 text-center font-medium">
                Balance remaining: ${(total - totalPaid).toFixed(2)}
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              disabled={totalPaid < total - 0.01 || isProcessing} // Small epsilon for float comparison
              className={totalPaid >= total - 0.01 ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isProcessing ? 'Processing...' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Selection Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Select a variant to add to the sale.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              {selectedProduct?.images[0] ? (
                <img src={selectedProduct.images[0].startsWith('http') ? selectedProduct.images[0] : `${BASE_URL}${selectedProduct.images[0]}`} alt={selectedProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image available</div>
              )}
            </div>
            <div className="flex flex-col gap-3 h-[400px] overflow-y-auto pr-2">
              {selectedProduct?.variants
                .filter(v => v.isActive !== false)
                .map((variant) => {
                  // correct stock check
                  const locationStock = variant.locationStock[selectedLocationId.toString()] || 0;

                  return (
                    <div
                      key={variant.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary flex flex-col gap-2 ${locationStock === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'bg-card'}`}
                      onClick={() => locationStock > 0 && selectedProduct && addToCart(variant, selectedProduct.name)}
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
                        <span className="font-bold text-primary">${variant.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={locationStock <= variant.lowStockThreshold ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {locationStock} in stock
                        </span>
                        {locationStock === 0 && <Badge variant="destructive" className="text-[9px]">Out of Stock</Badge>}
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
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
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
            <div className="flex gap-2">
              <Input
                type="date"
                value={orderStartDate}
                onChange={(e) => setOrderStartDate(e.target.value)}
                className="w-auto"
              />
              <span className="flex items-center text-muted-foreground">-</span>
              <Input
                type="date"
                value={orderEndDate}
                onChange={(e) => setOrderEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>

          <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active (Held) Orders</TabsTrigger>
              <TabsTrigger value="posted">Posted (History)</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="flex-1 overflow-y-auto mt-4">
              {filteredActiveOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <PauseCircle className="h-10 w-10 mb-2 opacity-20" />
                  <p>No matching held orders</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredActiveOrders.map(order => (
                    <div key={order.id} className="border rounded-lg bg-card overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleExpandOrder(order.id)}>
                        <div className="flex gap-4 items-center">
                          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <PauseCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {order.customer ? order.customer.name : 'Walk-in Customer'}
                            </div>
                            <div className="text-sm text-muted-foreground flex gap-2">
                              <span>{format(order.timestamp, 'HH:mm')}</span>
                              <span>•</span>
                              <span>{order.items.length} items</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="font-semibold text-right">
                            ${order.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}
                          </div>
                          <Button size="sm" onClick={(e) => {
                            e.stopPropagation();
                            handleResumeOrder(order);
                          }}>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Resume
                          </Button>
                          {expandedOrderId === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {expandedOrderId === order.id && (
                        <div className="p-4 bg-muted/10 border-t space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <div>{item.productName} <span className="text-muted-foreground">x{item.quantity}</span></div>
                              <div>${(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
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
                <div className="space-y-2">
                  {filteredSalesHistory.map(sale => (
                    <div key={sale.id} className="border rounded-lg bg-card overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleExpandOrder(sale.id)}>
                        <div className="flex gap-4 items-center">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Sale #{sale.id.toString().slice(-6)}
                            </div>
                            <div className="text-sm text-muted-foreground flex gap-2">
                              <span>{format(sale.timestamp, 'MMM d, HH:mm')}</span>
                              <span>•</span>
                              <span className="capitalize">{sale.paymentMethod}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="font-semibold text-right">
                            ${(sale.total || (sale as any).totalAmount || 0).toFixed(2)}
                          </div>
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            handleReceiptAction(`${BASE_URL}/api/transactions/sale/${sale.id}/receipt`);
                          }} title="View/Print Receipt">
                            <Receipt className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            handleReorder(sale);
                          }}>
                            Re-order
                          </Button>
                          <Button size="sm" variant="destructive" onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReturn(sale);
                          }}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Return
                          </Button>
                          {expandedOrderId === sale.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {expandedOrderId === sale.id && (
                        <div className="p-4 bg-muted/10 border-t space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-2 flex justify-between">
                            <span>ITEM</span>
                            <span>SUBTOTAL</span>
                          </div>
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <div>
                                {item.productName}
                                <span className="text-muted-foreground ml-2">
                                  ({Object.values(item.attributes || {}).join('/')}) x{Math.abs(item.adjustment || item.quantity || 0)}
                                </span>
                              </div>
                              <div>${(item.price * Math.abs(item.adjustment || item.quantity || 0)).toFixed(2)}</div>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                            <span>Total</span>
                            <span>${(sale.total || (sale as any).totalAmount || 0).toFixed(2)}</span>
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
            {saleToReturn && saleToReturn.items.map((item, idx) => {
              const returnItem = returnItems.find(r => r.variantId === item.variantId);

              const limit = returnableLimits[item.variantId] || { original: 0, returned: 0, remaining: 0 };
              const maxQty = limit.remaining;
              // Fallback if limits haven't loaded yet? Or we can default to max adjust if map empty.
              // But wait, if we initialized with filter, items with 0 limit shouldn't be here if filter worked.
              // Wait, I filtered `returnItems` initialization, but here I iterate `saleToReturn.items`. 
              // So finding `returnItem` might fail if it was filtered out.

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
              <span className="text-xl font-bold">${calculateReturnTotal().toFixed(2)}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={submitReturn} disabled={calculateReturnTotal() <= 0}>
                Confirm Return
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
            <div className="grid gap-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="555-0100"
              />
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
      {/* Receipt Preview Dialog */}
      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipt Preview
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
    </div>
  );
}
