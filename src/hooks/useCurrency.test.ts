import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrency } from './useCurrency';
import { useInventory } from '@/contexts/InventoryContext';

vi.mock('@/contexts/InventoryContext', () => ({
  useInventory: vi.fn(),
}));

function mockSettings(settings: Record<string, unknown>) {
  vi.mocked(useInventory).mockReturnValue({ settings } as any);
}

describe('useCurrency', () => {
  describe('computeTax — VAT exclusive (added on top)', () => {
    it('adds tax on top of the amount', () => {
      mockSettings({ currency: 'KES', vatInclusive: false });
      const { result } = renderHook(() => useCurrency());

      const { subtotal, tax, total } = result.current.computeTax(2, 100, 16);

      expect(subtotal).toBe(200);
      expect(tax).toBe(32);
      expect(total).toBe(232);
    });
  });

  describe('computeTax — VAT inclusive (extracted from the amount)', () => {
    it('extracts tax from within the amount, leaving total unchanged', () => {
      mockSettings({ currency: 'KES', vatInclusive: true });
      const { result } = renderHook(() => useCurrency());

      const { subtotal, tax, total } = result.current.computeTax(2, 100, 16);

      expect(total).toBe(200);
      expect(tax).toBeCloseTo(27.586, 3);
      expect(subtotal).toBeCloseTo(172.414, 3);
      expect(subtotal + tax).toBeCloseTo(total, 6);
    });
  });

  describe('fmt', () => {
    it('prepends the configured currency symbol and formats with 2 decimals by default', () => {
      mockSettings({ currency: 'KES' });
      const { result } = renderHook(() => useCurrency());

      expect(result.current.fmt(1234.5)).toBe('KES1,234.50');
    });

    it('respects a custom decimal count', () => {
      mockSettings({ currency: 'KES' });
      const { result } = renderHook(() => useCurrency());

      expect(result.current.fmt(0, 0)).toBe('KES0');
    });

    it('falls back to "$" when no currency is configured', () => {
      mockSettings({});
      const { result } = renderHook(() => useCurrency());

      expect(result.current.sym).toBe('$');
    });
  });
});
