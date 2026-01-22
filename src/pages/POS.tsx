import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockProducts, mockCustomers, mockSales } from '@/data/mockData';
import { ProductVariant, SaleItem, Customer, Sale } from '@/types/inventory';
import { Search, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, ShoppingCart, Receipt, User, UserPlus, X, Edit, Home, Clock, FileText, PauseCircle, PlayCircle, RotateCcw, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
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

interface CartItem extends SaleItem {
  maxStock: number;
}

interface ActiveOrder {
  id: string;
  customer: Customer | null;
  items: CartItem[];
  timestamp: Date;
}

export default function POS() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Orders Management
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>(mockSales);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Order Filters
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStartDate, setOrderStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [orderEndDate, setOrderEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' }
  });

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });

  // Get all variants with product info
  const allVariants = mockProducts.flatMap(product =>
    product.variants
      .filter(v => v.stock > 0)
      .map(variant => ({
        ...variant,
        productName: product.name,
        category: product.category,
      }))
  );

  // Get unique categories
  const categories = Array.from(new Set(mockProducts.map(p => p.category)));

  // Filter variants
  const filteredVariants = allVariants.filter(variant => {
    const matchesSearch =
      variant.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variant.barcode.includes(searchQuery);

    const matchesCategory = !selectedCategory || variant.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const addToCart = (variant: typeof allVariants[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) {
          toast.error('Cannot add more than available stock');
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
        productName: variant.productName,
        variantSku: variant.sku,
        attributes: variant.attributes,
        quantity: 1,
        price: variant.price,
        maxStock: variant.stock
      }];
    });
    toast.success(`Added ${variant.productName} to cart`);
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
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const totalPaid = Object.values(paymentMethods)
    .reduce((sum, method) => method.active ? sum + (parseFloat(method.amount) || 0) : sum, 0);

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

  const handleCheckout = () => {
    if (totalPaid < total) {
      toast.error('Payment amount is less than total');
      return;
    }

    // Create Sale record
    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      items: cart,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethods.card.active ? 'card' : 'cash', // Simplified
      timestamp: new Date(),
      userId: 'current-user', // Mock
    };

    setSalesHistory(prev => [newSale, ...prev]);

    const customerInfo = selectedCustomer ? ` for ${selectedCustomer.name}` : '';
    toast.success(`Sale completed successfully${customerInfo}!`);

    // Reset state
    setCart([]);
    setCheckoutOpen(false);
    setPaymentMethods({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' }
    });
    setSelectedCustomer(null);
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) return;

    const order: ActiveOrder = {
      id: `hold-${Date.now()}`,
      customer: selectedCustomer,
      items: cart,
      timestamp: new Date()
    };

    setActiveOrders(prev => [order, ...prev]);
    setCart([]);
    setSelectedCustomer(null);
    toast.success('Order held successfully');
  };

  const handleResumeOrder = (order: ActiveOrder) => {
    setCart(order.items);
    setSelectedCustomer(order.customer);
    setActiveOrders(prev => prev.filter(o => o.id !== order.id));
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

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    const customer: Customer = {
      id: `c${Date.now()}`,
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim() || undefined,
      phone: newCustomer.phone.trim() || undefined,
      createdAt: new Date(),
    };
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
    setNewCustomer({ name: '', email: '', phone: '' });
    setAddCustomerDialogOpen(false);
    toast.success('Customer added successfully');
  };

  // Helper to filter orders
  const filterOrders = (orders: any[]) => {
    const start = startOfDay(parseISO(orderStartDate));
    const end = endOfDay(parseISO(orderEndDate));

    return orders.filter(order => {
      const matchSearch =
        order.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        (order.customer && order.customer.name.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
        (order.userId && order.userId.toLowerCase().includes(orderSearchQuery.toLowerCase()));

      const orderDate = new Date(order.timestamp);
      const matchDate = isWithinInterval(orderDate, { start, end });

      return matchSearch && matchDate;
    });
  };

  const filteredActiveOrders = filterOrders(activeOrders);
  const filteredSalesHistory = filterOrders(salesHistory);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col border-r">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate('/')} title="Home">
                <Home className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Point of Sale</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64 md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => setOrdersDialogOpen(true)}>
                <Clock className="h-4 w-4 mr-2" />
                Orders
              </Button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 p-4 border-b bg-muted/30 overflow-x-auto">
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
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredVariants.map((variant) => (
                <div
                  key={variant.id}
                  className="pos-product-card cursor-pointer hover:border-primary transition-colors border rounded-lg p-3 bg-card shadow-sm"
                  onClick={() => addToCart(variant)}
                >
                  <div className="flex flex-col h-full">
                    <h4 className="font-medium text-sm line-clamp-1">{variant.productName}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(variant.attributes).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-[10px]">
                          {value}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto pt-2 flex items-center justify-between">
                      <span className="font-semibold text-primary">${variant.price.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">{variant.stock} left</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredVariants.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No products found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-96 flex flex-col bg-card shadow-xl z-10">
          <div className="p-4 border-b">
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
                        {customers.map((customer) => (
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
                      <p className="text-xs text-muted-foreground">{item.variantSku}</p>
                      <div className="flex gap-1 mt-1">
                        {Object.entries(item.attributes).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-[10px]">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-primary">
                            ${(item.price * item.quantity).toFixed(2)}
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
          < div className="p-4 border-t bg-muted/30" >
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                className="col-span-1"
                disabled={cart.length === 0}
                onClick={handleHoldOrder}
                title="Hold Order"
              >
                <PauseCircle className="h-4 w-4" />
              </Button>
              <Button
                className="col-span-3"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setCheckoutOpen(true)}
              >
                Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => {
        setCheckoutOpen(open);
        if (open) {
          // Reset payment state when opening
          setPaymentMethods({
            cash: { active: false, amount: '', reference: '' },
            card: { active: false, amount: '', reference: '' },
            mobile: { active: false, amount: '', reference: '' }
          });
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
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ref-${method}`} className="text-xs">Reference (Optional)</Label>
                        <Input
                          id={`ref-${method}`}
                          type="text"
                          value={paymentMethods[method].reference}
                          onChange={(e) => updatePaymentDetail(method, 'reference', e.target.value)}
                          placeholder="Ref #"
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(totalPaid < total) && (
              <div className="text-xs text-red-500 text-center font-medium">
                Balance remaining: ${(total - totalPaid).toFixed(2)}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCheckout}
              disabled={totalPaid < total - 0.01} // Small epsilon for float comparison
              className={totalPaid >= total - 0.01 ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders Manager Dialog */}
      <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Order Management</DialogTitle>
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
                              Sale #{sale.id.slice(-6)}
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
                            ${sale.total.toFixed(2)}
                          </div>
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation();
                            handleReorder(sale);
                          }}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Re-order
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
                                  ({Object.values(item.attributes).join('/')}) x{item.quantity}
                                </span>
                              </div>
                              <div>${(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                            <span>Total</span>
                            <span>${sale.total.toFixed(2)}</span>
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
    </div>
  );
}
