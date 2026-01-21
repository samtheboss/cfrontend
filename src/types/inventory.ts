export interface ProductAttribute {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;
  price: number;
  cost: number;
  wasPrice?: number;
  stock: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  attributes: ProductAttribute[];
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  images: string[];
  availableOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockAdjustment {
  id: string;
  variantId: string;
  productName: string;
  variantSku: string;
  previousStock: number;
  adjustment: number;
  newStock: number;
  reason: string;
  userId: string;
  timestamp: Date;
}

export interface SaleItem {
  variantId: string;
  productName: string;
  variantSku: string;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  timestamp: Date;
  userId: string;
}

export interface StockTakeItem {
  variantId: string;
  productName: string;
  variantSku: string;
  systemStock: number;
  countedStock: number;
  variance: number;
}

export interface StockTake {
  id: string;
  items: StockTakeItem[];
  status: 'in-progress' | 'completed' | 'applied';
  startedAt: Date;
  completedAt?: Date;
  userId: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: Date;
}

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export function getStockStatus(stock: number, threshold: number): StockStatus {
  if (stock === 0) return 'out-of-stock';
  if (stock <= threshold) return 'low-stock';
  return 'in-stock';
}
