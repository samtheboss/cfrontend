import { Product, Sale, StockAdjustment } from '@/types/inventory';

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Classic Cotton T-Shirt',
    description: 'Premium cotton t-shirt with comfortable fit',
    category: 'Apparel',
    attributes: [
      { id: 'size', name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { id: 'color', name: 'Color', values: ['Black', 'White', 'Navy'] }
    ],
    variants: [
      { id: 'v1', productId: '1', sku: 'TSH-BLK-S', barcode: '1234567890001', attributes: { size: 'S', color: 'Black' }, price: 29.99, cost: 12.00, stock: 45, lowStockThreshold: 10 },
      { id: 'v2', productId: '1', sku: 'TSH-BLK-M', barcode: '1234567890002', attributes: { size: 'M', color: 'Black' }, price: 29.99, cost: 12.00, stock: 8, lowStockThreshold: 10 },
      { id: 'v3', productId: '1', sku: 'TSH-BLK-L', barcode: '1234567890003', attributes: { size: 'L', color: 'Black' }, price: 29.99, cost: 12.00, stock: 0, lowStockThreshold: 10 },
      { id: 'v4', productId: '1', sku: 'TSH-WHT-S', barcode: '1234567890004', attributes: { size: 'S', color: 'White' }, price: 29.99, cost: 12.00, stock: 32, lowStockThreshold: 10 },
      { id: 'v5', productId: '1', sku: 'TSH-WHT-M', barcode: '1234567890005', attributes: { size: 'M', color: 'White' }, price: 29.99, cost: 12.00, stock: 28, lowStockThreshold: 10 },
      { id: 'v6', productId: '1', sku: 'TSH-NVY-L', barcode: '1234567890006', attributes: { size: 'L', color: 'Navy' }, price: 29.99, cost: 12.00, stock: 5, lowStockThreshold: 10 },
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20')
  },
  {
    id: '2',
    name: 'Denim Jeans Slim Fit',
    description: 'Modern slim fit denim jeans',
    category: 'Apparel',
    attributes: [
      { id: 'waist', name: 'Waist', values: ['28', '30', '32', '34'] },
      { id: 'color', name: 'Color', values: ['Blue', 'Black'] }
    ],
    variants: [
      { id: 'v7', productId: '2', sku: 'JNS-BLU-28', barcode: '1234567890007', attributes: { waist: '28', color: 'Blue' }, price: 79.99, cost: 35.00, stock: 15, lowStockThreshold: 5 },
      { id: 'v8', productId: '2', sku: 'JNS-BLU-30', barcode: '1234567890008', attributes: { waist: '30', color: 'Blue' }, price: 79.99, cost: 35.00, stock: 22, lowStockThreshold: 5 },
      { id: 'v9', productId: '2', sku: 'JNS-BLU-32', barcode: '1234567890009', attributes: { waist: '32', color: 'Blue' }, price: 79.99, cost: 35.00, stock: 3, lowStockThreshold: 5 },
      { id: 'v10', productId: '2', sku: 'JNS-BLK-30', barcode: '1234567890010', attributes: { waist: '30', color: 'Black' }, price: 79.99, cost: 35.00, stock: 18, lowStockThreshold: 5 },
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18')
  },
  {
    id: '3',
    name: 'Running Sneakers Pro',
    description: 'High-performance running shoes',
    category: 'Footwear',
    attributes: [
      { id: 'size', name: 'Size', values: ['8', '9', '10', '11', '12'] },
      { id: 'color', name: 'Color', values: ['White', 'Black', 'Red'] }
    ],
    variants: [
      { id: 'v11', productId: '3', sku: 'SNK-WHT-9', barcode: '1234567890011', attributes: { size: '9', color: 'White' }, price: 129.99, cost: 55.00, stock: 12, lowStockThreshold: 5 },
      { id: 'v12', productId: '3', sku: 'SNK-WHT-10', barcode: '1234567890012', attributes: { size: '10', color: 'White' }, price: 129.99, cost: 55.00, stock: 8, lowStockThreshold: 5 },
      { id: 'v13', productId: '3', sku: 'SNK-BLK-9', barcode: '1234567890013', attributes: { size: '9', color: 'Black' }, price: 129.99, cost: 55.00, stock: 0, lowStockThreshold: 5 },
      { id: 'v14', productId: '3', sku: 'SNK-RED-10', barcode: '1234567890014', attributes: { size: '10', color: 'Red' }, price: 129.99, cost: 55.00, stock: 6, lowStockThreshold: 5 },
    ],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-22')
  }
];

export const mockSales: Sale[] = [
  {
    id: 's1',
    items: [
      { variantId: 'v1', productName: 'Classic Cotton T-Shirt', variantSku: 'TSH-BLK-S', attributes: { size: 'S', color: 'Black' }, quantity: 2, price: 29.99 },
      { variantId: 'v7', productName: 'Denim Jeans Slim Fit', variantSku: 'JNS-BLU-28', attributes: { waist: '28', color: 'Blue' }, quantity: 1, price: 79.99 }
    ],
    subtotal: 139.97,
    tax: 11.20,
    total: 151.17,
    paymentMethod: 'card',
    timestamp: new Date('2024-01-22T10:30:00'),
    userId: 'user1'
  },
  {
    id: 's2',
    items: [
      { variantId: 'v11', productName: 'Running Sneakers Pro', variantSku: 'SNK-WHT-9', attributes: { size: '9', color: 'White' }, quantity: 1, price: 129.99 }
    ],
    subtotal: 129.99,
    tax: 10.40,
    total: 140.39,
    paymentMethod: 'cash',
    timestamp: new Date('2024-01-22T14:15:00'),
    userId: 'user1'
  }
];

export const mockAdjustments: StockAdjustment[] = [
  {
    id: 'adj1',
    variantId: 'v3',
    productName: 'Classic Cotton T-Shirt',
    variantSku: 'TSH-BLK-L',
    previousStock: 5,
    adjustment: -5,
    newStock: 0,
    reason: 'Damaged goods - water damage in storage',
    userId: 'user1',
    timestamp: new Date('2024-01-21T09:00:00')
  },
  {
    id: 'adj2',
    variantId: 'v5',
    productName: 'Classic Cotton T-Shirt',
    variantSku: 'TSH-WHT-M',
    previousStock: 20,
    adjustment: 8,
    newStock: 28,
    reason: 'New shipment received',
    userId: 'user1',
    timestamp: new Date('2024-01-20T11:30:00')
  }
];
