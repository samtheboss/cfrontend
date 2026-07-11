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

  return { sym, fmt };
}
