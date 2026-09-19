/**
 * Pure decision logic extracted out of POS.tsx so it's testable without rendering the
 * whole (3600+ line) page. Both functions mirror existing inline conditionals exactly —
 * this is a mechanical extraction, not a behavior change.
 */

/**
 * Whether the current cart has unsaved work worth preserving before switching away from
 * it (loading a different order, navigating home, logging out, starting a new sale).
 *
 * An empty cart, or a loaded order where every line is already `printed` (i.e. already
 * saved to the backend and unchanged since), has nothing new to hold — calling
 * `handleHoldOrder` in that case would just re-PUT an unchanged item list back onto
 * itself. This is exactly what caused a real duplication incident: a client that
 * re-submits an already-saved line with no id looks "new" to the backend's id-based
 * item sync and gets inserted again.
 */
export function shouldHoldBeforeSwitch(cart: { printed?: boolean }[]): boolean {
  return cart.length > 0 && cart.some(item => !item.printed);
}

export type CheckoutAction = 'ALREADY_PAID' | 'RECEIVE_BALANCE' | 'UPDATE_COMPLETE' | 'CREATE';

/** Mirrors handleCheckout's existing branch order exactly. */
export function decideCheckoutAction(params: {
  currentSaleId: number | string | null | undefined;
  currentSalePaid: number;
  total: number;
}): CheckoutAction {
  const { currentSaleId, currentSalePaid, total } = params;

  if (currentSaleId && currentSalePaid >= total - 0.01 && total > 0) {
    return 'ALREADY_PAID';
  }
  if (currentSaleId && currentSalePaid > 0) {
    return 'RECEIVE_BALANCE';
  }
  if (currentSaleId) {
    return 'UPDATE_COMPLETE';
  }
  return 'CREATE';
}
