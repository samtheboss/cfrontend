import { describe, it, expect } from 'vitest';
import { calculatePrice, getActivePromotion, getProductPriceInfo } from './pricing';
import type { Product, ProductVariant, Promotion } from '@/types/inventory';

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    productId: 'p1',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startDate: '2000-01-01',
    endDate: '2999-01-01',
    isActive: true,
    ...overrides,
  };
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    productId: 'p1',
    sku: 'SKU-1',
    barcode: '',
    attributes: {},
    price: 100,
    cost: 50,
    stock: 10,
    locationStock: {},
    lowStockThreshold: 2,
    isActive: true,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    type: 'FINISHED_GOOD',
    description: '',
    category: 'General',
    attributes: [],
    variants: [makeVariant()],
    images: [],
    availableOnline: true,
    isActive: true,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('calculatePrice', () => {
  it('returns the base price when there is no promotion', () => {
    expect(calculatePrice(100, null)).toBe(100);
  });

  it('returns the flat value for FIXED_PRICE', () => {
    const promo = makePromotion({ discountType: 'FIXED_PRICE', discountValue: 75 });
    expect(calculatePrice(100, promo)).toBe(75);
  });

  it('applies a percentage discount for PERCENTAGE', () => {
    const promo = makePromotion({ discountType: 'PERCENTAGE', discountValue: 20 });
    expect(calculatePrice(100, promo)).toBe(80);
  });

  it('subtracts a flat amount for AMOUNT_OFF, never going below zero', () => {
    const promo = makePromotion({ discountType: 'AMOUNT_OFF', discountValue: 30 });
    expect(calculatePrice(100, promo)).toBe(70);
    const bigDiscount = makePromotion({ discountType: 'AMOUNT_OFF', discountValue: 500 });
    expect(calculatePrice(100, bigDiscount)).toBe(0);
  });

  it('accepts a string base price', () => {
    const promo = makePromotion({ discountType: 'AMOUNT_OFF', discountValue: 10 });
    expect(calculatePrice('100', promo)).toBe(90);
  });
});

describe('getActivePromotion', () => {
  it('prefers a variant-specific promotion over a product-level one', () => {
    const productLevel = makePromotion({ id: 1 });
    const variantLevel = makePromotion({ id: 2, variantId: 'v1' });
    const result = getActivePromotion([productLevel, variantLevel], 'p1', 'v1');
    expect(result?.id).toBe(2);
  });

  it('falls back to the product-level promotion when no variant match exists', () => {
    const productLevel = makePromotion({ id: 1 });
    const otherVariant = makePromotion({ id: 2, variantId: 'v2' });
    const result = getActivePromotion([productLevel, otherVariant], 'p1', 'v1');
    expect(result?.id).toBe(1);
  });

  it('ignores a variant-specific promotion for a different variant, even when checking the whole product', () => {
    const variantOnly = makePromotion({ id: 1, variantId: 'v2' });
    expect(getActivePromotion([variantOnly], 'p1')).toBeNull();
  });

  it('excludes an expired promotion', () => {
    const expired = makePromotion({ startDate: '2000-01-01', endDate: '2001-01-01' });
    expect(getActivePromotion([expired], 'p1')).toBeNull();
  });

  it('excludes a promotion that has not started yet', () => {
    const future = makePromotion({ startDate: '2999-01-01', endDate: '3000-01-01' });
    expect(getActivePromotion([future], 'p1')).toBeNull();
  });

  it('excludes a promotion whose active/isActive flag is false', () => {
    expect(getActivePromotion([makePromotion({ isActive: false })], 'p1')).toBeNull();
    expect(getActivePromotion([makePromotion({ active: false })], 'p1')).toBeNull();
  });

  it('treats a promotion with unparsable dates as active (fallback)', () => {
    const malformed = makePromotion({ startDate: 'not-a-date', endDate: 'also-not-a-date' });
    expect(getActivePromotion([malformed], 'p1')?.id).toBe(malformed.id);
  });

  it('returns null when there is no matching promotion at all', () => {
    expect(getActivePromotion([], 'p1')).toBeNull();
  });
});

describe('getProductPriceInfo', () => {
  it('flags isOnSale when an active promotion lowers the price', () => {
    const promo = makePromotion({ variantId: 'v1', discountType: 'PERCENTAGE', discountValue: 25 });
    const product = makeProduct();
    const info = getProductPriceInfo(product, 'v1', [promo]);
    expect(info.currentPrice).toBe(75);
    expect(info.originalPrice).toBe(100);
    expect(info.isOnSale).toBe(true);
  });

  it('is not on sale when there is no applicable promotion', () => {
    const info = getProductPriceInfo(makeProduct(), 'v1', []);
    expect(info.currentPrice).toBe(100);
    expect(info.isOnSale).toBe(false);
  });

  it('returns zeroed info when the variant cannot be found', () => {
    const info = getProductPriceInfo(makeProduct(), 'missing-variant', []);
    expect(info).toEqual({ originalPrice: 0, currentPrice: 0, promotion: null });
  });
});
