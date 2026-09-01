import type { Product, SystemSettings } from '@/types/inventory';

/**
 * Whether a product may be sold into negative stock.
 *
 * A per-product `negativeStockPolicy` of `ALLOW` / `BLOCK` overrides the global
 * `SystemSettings.allowNegativeStock`; `INHERIT` (or missing) falls back to it.
 */
export function negativeStockAllowed(
  product: Pick<Product, 'negativeStockPolicy'> | null | undefined,
  settings: Pick<SystemSettings, 'allowNegativeStock'> | null | undefined,
): boolean {
  const policy = product?.negativeStockPolicy;
  if (policy === 'ALLOW') return true;
  if (policy === 'BLOCK') return false;
  return settings?.allowNegativeStock ?? false;
}
