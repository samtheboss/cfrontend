import { Product } from '@/types/inventory';
import { getBaseUrl } from '@/lib/api';

/**
 * Escapes a single CSV cell value according to RFC 4180:
 * Wraps values containing commas, quotes, or newlines in quotes,
 * and doubles any internal quotes.
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a variant's attributes object into "Key:Value;Key2:Value2" format
 * expected by the backend import service.
 */
function formatAttributes(attrs?: Record<string, string>): string {
  if (!attrs || typeof attrs !== 'object') return '';
  return Object.entries(attrs)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k.trim()}:${v.trim()}`)
    .join(';');
}

/**
 * Exports products and their variants to a CSV file that matches
 * the exact column structure required for re-importing.
 */
export function exportProductsToCsv(products: Product[], customFilename?: string): number {
  const headers = [
    'Product Name',
    'Category',
    'SubCategory',
    'Description',
    'SKU',
    'Barcode',
    'Price',
    'Cost',
    'Stock',
    'Attributes',
    'Low Stock Threshold',
  ];

  const rows: string[] = [headers.join(',')];
  let exportedRowCount = 0;

  products.forEach((product) => {
    const activeVariants = product.variants?.filter((v) => v.isActive !== false) || [];

    if (activeVariants.length === 0) {
      // Product without variants (or only legacy single item)
      rows.push(
        [
          escapeCsv(product.name),
          escapeCsv(product.category || ''),
          escapeCsv(product.subcategory || ''),
          escapeCsv(product.description || ''),
          '',
          '',
          '0',
          '0',
          '0',
          '',
          '5',
        ].join(',')
      );
      exportedRowCount++;
    } else {
      activeVariants.forEach((variant) => {
        rows.push(
          [
            escapeCsv(product.name),
            escapeCsv(product.category || ''),
            escapeCsv(product.subcategory || ''),
            escapeCsv(product.description || ''),
            escapeCsv(variant.sku || ''),
            escapeCsv(variant.barcode || ''),
            variant.price ?? 0,
            variant.cost ?? 0,
            variant.stock ?? 0,
            escapeCsv(formatAttributes(variant.attributes)),
            variant.lowStockThreshold ?? 5,
          ].join(',')
        );
        exportedRowCount++;
      });
    }
  });

  // UTF-8 BOM ensures Excel on Windows opens non-ASCII characters cleanly
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');

  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = customFilename || `products_export_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return exportedRowCount;
}

/**
 * Downloads the standard blank/sample import CSV template.
 */
export function downloadProductTemplateCsv() {
  const headers = [
    'Product Name',
    'Category',
    'SubCategory',
    'Description',
    'SKU',
    'Barcode',
    'Price',
    'Cost',
    'Stock',
    'Attributes',
    'Low Stock Threshold',
  ];

  const sampleRows = [
    headers.join(','),
    [
      '"Vanilla Birthday Cake"',
      '"Cakes"',
      '"Birthday"',
      '"Classic sponge cake with vanilla buttercream"',
      '"CAKE-VAN-1KG"',
      '"2000001001"',
      '2500',
      '1400',
      '10',
      '"Weight:1KG;Flavor:Vanilla"',
      '2',
    ].join(','),
    [
      '"Chocolate Cupcake"',
      '"Pastries"',
      '"Cupcakes"',
      '"Rich dark chocolate cupcake with ganache"',
      '"CUP-CHOC"',
      '"2000001002"',
      '350',
      '180',
      '25',
      '"Size:Regular"',
      '5',
    ].join(','),
  ];

  const csvContent = '\uFEFF' + sampleRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Initiates export directly from backend (supports Excel .xlsx or CSV).
 */
export async function downloadBackendExport(format: 'xlsx' | 'csv' = 'xlsx') {
  const token = sessionStorage.getItem('token');
  const response = await fetch(`${getBaseUrl()}/api/products/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `products_export_${dateStr}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
