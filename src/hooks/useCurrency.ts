import { useInventory } from '@/contexts/InventoryContext';

/**
 * Returns helper utilities for the system currency symbol.
 *
 * Usage:
 *   const { sym, fmt } = useCurrency();
 *   sym          → 'KES'  (the raw symbol)
 *   fmt(1234.5)  → 'KES 1,234.50'
 *   fmt(0, 0)    → 'KES 0'
 */
export function useCurrency() {
  const ctx = useInventory();
  const sym: string = ctx?.settings?.currency || '$';

  const vatInclusive: boolean = ctx?.settings?.vatInclusive || false;

  /**
   * Format a number with the currency symbol prepended.
   * @param amount  - numeric value
   * @param decimals - decimal places (default 2)
   */
  const fmt = (amount: number, decimals = 2): string => {
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${sym}${formatted}`;
  };

  /**
   * Helper to compute tax based on VAT mode setting
   */
  const computeTax = (qty: number, unitPrice: number, taxRate: number) => {
    const amount = qty * unitPrice;
    const rate = taxRate / 100;
    
    if (vatInclusive) {
      // Amount includes VAT: extract VAT from the total amount
      const tax = amount * (rate / (1 + rate));
      const subtotal = amount - tax;
      return { subtotal, tax, total: amount };
    } else {
      // Amount excludes VAT: add VAT on top
      const tax = amount * rate;
      return { subtotal: amount, tax, total: amount + tax };
    }
  };

  return { sym, fmt, vatInclusive, computeTax };
}
