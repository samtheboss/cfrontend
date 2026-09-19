import { describe, it, expect } from 'vitest';
import { negativeStockAllowed } from './stock';

describe('negativeStockAllowed', () => {
  it('returns true when the product policy is ALLOW, regardless of the global setting', () => {
    expect(negativeStockAllowed({ negativeStockPolicy: 'ALLOW' }, { allowNegativeStock: false })).toBe(true);
  });

  it('returns false when the product policy is BLOCK, regardless of the global setting', () => {
    expect(negativeStockAllowed({ negativeStockPolicy: 'BLOCK' }, { allowNegativeStock: true })).toBe(false);
  });

  it('falls back to the global setting when the policy is INHERIT', () => {
    expect(negativeStockAllowed({ negativeStockPolicy: 'INHERIT' }, { allowNegativeStock: true })).toBe(true);
    expect(negativeStockAllowed({ negativeStockPolicy: 'INHERIT' }, { allowNegativeStock: false })).toBe(false);
  });

  it('falls back to the global setting when the product has no policy at all', () => {
    expect(negativeStockAllowed({}, { allowNegativeStock: true })).toBe(true);
    expect(negativeStockAllowed(null, { allowNegativeStock: true })).toBe(true);
  });

  it('defaults to false when settings are missing entirely', () => {
    expect(negativeStockAllowed(null, null)).toBe(false);
    expect(negativeStockAllowed({ negativeStockPolicy: 'INHERIT' }, undefined)).toBe(false);
  });
});
