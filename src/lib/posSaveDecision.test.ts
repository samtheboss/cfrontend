import { describe, it, expect } from 'vitest';
import { shouldHoldBeforeSwitch, decideCheckoutAction } from './posSaveDecision';

describe('shouldHoldBeforeSwitch', () => {
  it('returns false for an empty cart', () => {
    expect(shouldHoldBeforeSwitch([])).toBe(false);
  });

  it('returns false when every item is already printed (nothing new to preserve)', () => {
    expect(shouldHoldBeforeSwitch([{ printed: true }, { printed: true }])).toBe(false);
  });

  it('returns true when at least one item is unprinted — the incident case', () => {
    expect(shouldHoldBeforeSwitch([{ printed: true }, { printed: false }])).toBe(true);
  });

  it('returns true when an item has no printed flag at all (freshly added)', () => {
    expect(shouldHoldBeforeSwitch([{}])).toBe(true);
  });
});

describe('decideCheckoutAction', () => {
  it('returns ALREADY_PAID when the loaded sale is already covered by prior payments', () => {
    const action = decideCheckoutAction({ currentSaleId: 1, currentSalePaid: 500, total: 500 });
    expect(action).toBe('ALREADY_PAID');
  });

  it('returns RECEIVE_BALANCE when a partial payment already exists on the loaded sale', () => {
    const action = decideCheckoutAction({ currentSaleId: 1, currentSalePaid: 200, total: 500 });
    expect(action).toBe('RECEIVE_BALANCE');
  });

  it('returns UPDATE_COMPLETE when a sale is loaded but nothing has been paid yet', () => {
    const action = decideCheckoutAction({ currentSaleId: 1, currentSalePaid: 0, total: 500 });
    expect(action).toBe('UPDATE_COMPLETE');
  });

  it('returns CREATE when there is no loaded sale', () => {
    const action = decideCheckoutAction({ currentSaleId: null, currentSalePaid: 0, total: 500 });
    expect(action).toBe('CREATE');
  });

  it('does not treat a zero-total order as already paid even with zero paid', () => {
    // total > 0 guard: a zero-total edge case must not short-circuit to ALREADY_PAID.
    const action = decideCheckoutAction({ currentSaleId: 1, currentSalePaid: 0, total: 0 });
    expect(action).toBe('UPDATE_COMPLETE');
  });
});
