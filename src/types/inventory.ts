export interface Location {
  id: string;
  name: string;
  code?: string;
  address?: string;
  isMain: boolean;
}

export interface ShippingLocation {
  id: number;
  name: string;
  fee: number;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  image?: string;
  /** null/undefined = main category; set = sub-category of this parent category id */
  parentId?: number | null;
}

export interface RestaurantTable {
  id: number;
  code: string;
  name?: string;
  capacity?: number;
  active: boolean;
  sortOrder?: number;
}

export interface TableDashboardRow {
  tableId: number;
  code: string;
  name?: string | null;
  capacity?: number | null;
  active: boolean;
  orderCount: number;
  outstanding: number;
  paid: number;
  lastActivity?: string | null;
  cashier?: string;
  status: 'AVAILABLE' | 'OCCUPIED';
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
  wholesalePrice?: number;
  specialPrice?: number;
  tradePrice?: number;
  stock: number; // Decimal support (e.g. 5.5 kg)
  locationStock: Record<string, number>; // locationId -> quantity (decimal)
  lowStockThreshold: number;
  isActive: boolean;
  image?: string;
  hasRecipe?: boolean;
}

export interface RecipeIngredient {
  id?: string;
  componentVariantId: string;
  componentName?: string;
  quantity: number;
}

export interface Recipe {
  id?: string;
  name: string;
  variantId: string;
  ingredients: RecipeIngredient[];
  autoProduce: boolean;
  manualProduce: boolean;
  yield: number;
}

export interface Product {
    id: string;
    name: string;
    type: 'RAW_MATERIAL' | 'FINISHED_GOOD';
    description: string;
  category: string;
  subcategory?: string;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  images: string[];
  availableOnline: boolean;
  isActive: boolean;
  isFeatured: boolean;
  /** Per-product override for overselling. Falls back to SystemSettings.allowNegativeStock when INHERIT/undefined. */
  negativeStockPolicy?: 'INHERIT' | 'ALLOW' | 'BLOCK';
  createdAt: Date;
  updatedAt: Date;
}

export interface Slide {
  id?: number;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  cta: string;
  displayOrder: number;
  isActive: boolean;
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
  taxRate?: number;
  taxAmount?: number;
  attributes?: Record<string, string>;
}

export interface StockTakeItem {
  variantId: string;
  productName: string;
  variantSku: string;
  systemStock: number;
  countedStock: number;
  variance: number;
  cost?: number;
  price?: number;
  unit?: string;
  attributes?: Record<string, string>;
}

export type TransactionType = 'ADJUSTMENT' | 'TRANSFER' | 'STOCK_TAKE' | 'SALE' | 'RETURN' | 'RECEIVED' | 'PRODUCTION' | 'CONSUMPTION';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RECEIVED' | 'DRAFT' | 'PAYMENT_PENDING';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface PurchaseOrder extends InventoryTransaction {
  supplierId: string;
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'PARTIAL';
  paymentMethod?: string;
  referenceNumber?: string;
}

export interface InventoryTransaction {
  id?: string;
  journalNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  timestamp: Date | string;
  userId: string;
  createdBy?: string;
  locationId?: string | number;
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
  idNumber?: string;
  customerType?: string;
  creditLimit?: number;
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
  allowNegativeStock: boolean;
  vatInclusive: boolean;
  enableTableManagement: boolean;
  /** Max orders a cashier can keep on hold in the POS. <= 0 or undefined = unlimited. */
  maxHeldOrders?: number;
}

export interface EcommerceSettings {
  id?: number;
  shopName: string;
  shopDescription: string;
  logoUrl: string;
  heroBannerUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  footerText: string;
}

export interface Sale extends InventoryTransaction {
  id: string; // Override for frontend
  locationId: string | number;
  customerId?: number;
  paymentMethod?: string;
  tableId?: number | null;
  tableName?: string;
  salePayments: { method: string; amount: number; reference?: string }[];
  amountPaid: number;
  changeAmount: number;
  discountAmount?: number;
  customerPhone?: string;
  customerEmail?: string;
  shippingLocation?: string;
  shippingFee?: number;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  deliveryStatus?: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
  trackingNumber?: string;
  courierName?: string;
}

export type DocumentType = 'CASH_SALE' | 'SALE_INVOICE';

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  documentType: DocumentType;
  saleId: number;
  locationCode?: string;
  orderDate?: string;
  dueDate?: string;
  salesPerson?: string;
  reference?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface InvoiceListItem {
  invoiceNumber: string;
  documentType: DocumentType;
  saleId: number;
  journalNumber: string;
  customerId?: number;
  orderDate?: string;
  dueDate?: string;
  salesPerson?: string;
  reference?: string;
  status: TransactionStatus;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  createdBy?: string;
  createdAt?: string;
}

export interface CartItem {
  variantId: string;
  productName: string;
  variantSku: string;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
  maxStock: number;
  cartItemId?: string;
  printed?: boolean;
  hasRecipe?: boolean;
  /** Effective negative-stock permission for this line, resolved when added to the cart. */
  allowNegative?: boolean;
}

export interface ActiveOrder {
  id: string;
  customer: Customer | null;
  items: CartItem[];
  timestamp: Date;
  note?: string;
  userId?: string;
  /** Set when the held order is backed by a saved DB sale (e.g. a printed KOT). */
  saleId?: number | null;
  /** True when this held order was created by printing a KOT. */
  kot?: boolean;
}
export interface Promotion {
  id?: number;
  productId: string | number;
  variantId?: string | number;
  discountType: 'FIXED_PRICE' | 'PERCENTAGE' | 'AMOUNT_OFF';
  discountValue: number;
  startDate: string | Date;
  endDate: string | Date;
  description?: string;
  isActive: boolean;
  active?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Property {
  id?: number;
  name: string;
  address?: string;
  propertyType: 'APARTMENT' | 'HOUSE' | 'OFFICE' | 'SHOP';
  locationId?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  photoUrl?: string;
}

export interface PropertyUnit {
  id?: number;
  propertyId: number;
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent: number;
  depositAmount: number;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';
}

export interface PropertyLease {
  id?: number;
  leaseNumber?: string;
  tenantId: number;
  unitId: number;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  billingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  nextInvoiceDate?: string;
  lastInvoicedDate?: string;
}

export interface PropertyRentInvoice {
  id?: number;
  leaseId: number;
  invoiceNumber: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  billingPeriod: string;
  invoiceType?: string; // INVOICE, DEBIT_NOTE, OPENING_BALANCE
  createdAt?: string;
  createdBy?: string;
}

export interface PropertyRentPayment {
  id?: number;
  invoiceId?: number;
  leaseId?: number;
  paymentDate?: string;
  amount: number;
  amountApplied?: number;
  paymentMethod: 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CARD' | 'CREDIT_NOTE_APPLY' | 'PREPAYMENT_APPLY';
  referenceNumber?: string;
  receiptNumber?: string;
  notes?: string;
  createdBy?: string;
  glAccountId?: number;
}

export interface PropertyMaintenanceRequest {
  id?: number;
  unitId: number;
  issueDescription: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'REPORTED' | 'ASSIGNED' | 'COMPLETED';
  technicianName?: string;
  cost: number;
  completionDate?: string;
  createdAt?: string;
}

