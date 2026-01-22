import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockProducts } from '@/data/mockData';
import { ProductVariant, SaleItem } from '@/types/inventory';
import { Search, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, ShoppingCart, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CartItem extends SaleItem {
  maxStock: number;
}

export default function POS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'card' | 'mobile' | null>(null);

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

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(item => item.variantId !== variantId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (!selectedPayment) {
      toast.error('Please select a payment method');
      return;
    }
    toast.success('Sale completed successfully!');
    setCart([]);
    setCheckoutOpen(false);
    setSelectedPayment(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col border-r">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <h1 className="text-xl font-semibold">Point of Sale</h1>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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
                  className="pos-product-card"
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
        <div className="w-96 flex flex-col bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Current Sale
            </h2>
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
                      <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
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
          <div className="p-4 border-t bg-muted/30">
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
            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              Checkout
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Total amount: ${total.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              variant={selectedPayment === 'cash' ? 'default' : 'outline'}
              className="h-24 flex-col gap-2"
              onClick={() => setSelectedPayment('cash')}
            >
              <Banknote className="h-8 w-8" />
              Cash
            </Button>
            <Button
              variant={selectedPayment === 'card' ? 'default' : 'outline'}
              className="h-24 flex-col gap-2"
              onClick={() => setSelectedPayment('card')}
            >
              <CreditCard className="h-8 w-8" />
              Card
            </Button>
            <Button
              variant={selectedPayment === 'mobile' ? 'default' : 'outline'}
              className="h-24 flex-col gap-2"
              onClick={() => setSelectedPayment('mobile')}
            >
              <Smartphone className="h-8 w-8" />
              Mobile
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={!selectedPayment}>
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
