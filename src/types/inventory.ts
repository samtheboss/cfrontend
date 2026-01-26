export interface Location {
  id: string;
  name: string;
  address?: string;
  isMain: boolean;
}

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
  stock: number; // For backward compatibility or aggregate
  locationStock: Record<string, number>; // locationId -> quantity
  lowStockThreshold: number;
  isActive: boolean;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  images: string[];
  availableOnline: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionItem {
  id?: string;
  variantId: string;
  sku: string;
  productName: string;
  quantityBefore?: number;
  quantityAfter?: number;
  adjustment: number;
  price?: number;
  attributes?: Record<string, string>;
}

export type TransactionType = 'ADJUSTMENT' | 'TRANSFER' | 'STOCK_TAKE' | 'SALE';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RECEIVED';

export interface InventoryTransaction {
  id?: string;
  journalNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: Date;
  userId: string;
  notes?: string;
  items: TransactionItem[];
  subtotal?: number;
  tax?: number;
  taxAmount?: number;
  total?: number;
  totalAmount?: number;
}

export interface StockAdjustment extends InventoryTransaction {
  locationId: string;
}

export interface StockTransfer extends InventoryTransaction {
  fromLocationId: string;
  toLocationId: string;
}

export interface StockTake extends InventoryTransaction {
  locationId: string;
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

export interface SystemSettings {
  id?: number;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  taxId: string;
  taxRate: number;
  currency: string;
  autoPrintReceipts: boolean;
  showStockWarning: boolean;
  lowStockAlerts: boolean;
  outOfStockAlerts: boolean;
  dailySalesSummary: boolean;
}

export interface Sale extends InventoryTransaction {
  id: string; // Override for frontend
  locationId: number;
  customerId?: number;
  salePayments: { method: string; amount: number; reference?: string }[];
  amountPaid: number;
  changeAmount: number;
}

export interface CartItem {
  variantId: string;
  productName: string;
  variantSku: string;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
  maxStock: number;
}

export interface ActiveOrder {
  id: string;
  customer: Customer | null;
  items: CartItem[];
  timestamp: Date;
  note?: string;
}
