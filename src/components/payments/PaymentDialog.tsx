import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet, Banknote, CreditCard, Smartphone, Check, AlertCircle, RefreshCw, Building, Gift, Search, Database, X, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PaymentDetails {
  method: 'cash' | 'card' | 'mobile' | 'bank' | 'complimentary' | string;
  amount: number;
  reference?: string;
  glAccountId?: number;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  description?: string; // alias for subtitle
  totalDue?: number;
  totalAmount?: number; // alias for totalDue
  defaultPhone?: string;
  // May return the journal/invoice number of the order just posted, so any consumed
  // M-Pesa transactions can be stamped with what consumed them.
  onConfirm?: (payments: PaymentDetails[]) => Promise<void | string | { journalNumber?: string }>;
  onSubmit?: (payments: PaymentDetails[]) => Promise<void | string | { journalNumber?: string }>; // alias for onConfirm
  isProcessing?: boolean;
  onCancel?: () => void;
  extraActions?: React.ReactNode;
  submitText?: string;
  allowPartialPayment?: boolean;
  initialPayments?: Record<string, { active: boolean; amount: string; reference: string }>;
  module?: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title = "Receive Payment",
  subtitle,
  description,
  totalDue,
  totalAmount,
  defaultPhone,
  onConfirm,
  onSubmit,
  isProcessing = false,
  onCancel,
  extraActions,
  submitText,
  allowPartialPayment = false,
  initialPayments,
  module
}: PaymentDialogProps) {
  const { sym } = useCurrency();
  const activeTotalDue = totalDue ?? totalAmount ?? 0;
  const activeSubtitle = subtitle ?? description;
  const activeOnConfirm = onConfirm ?? onSubmit ?? (async () => { });

  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;

  const canChangeAccount = rights?.changePaymentAccount !== 'no';

  // Resolve module-specific method permissions
  const getMethodPermission = (methodName: string) => {
    if (!rights) return true; // Default allow if no rights system
    if (!module) return true; // Global/fallback allow

    // Normalize module names
    const m = module.toUpperCase();
    const isPOS = m === 'POS';
    const isProperty = m === 'PROPERTY';
    const isAccommodation = m === 'ACCOMMODATION';
    const isExpense = m === 'PMS_EXPENSE' || m === 'ACCOMMODATION_EXPENSE';
    const isPurchase = m === 'PURCHASE';

    if (methodName === 'cash') {
      if (isPOS) return rights.posReceiveCash !== 'no';
      if (isProperty) return rights.propertyReceiveCash !== 'no';
      if (isAccommodation) return rights.accommodationReceiveCash !== 'no';
      if (isExpense) return rights.expenseReceiveCash !== 'no';
      if (isPurchase) return rights.purchaseReceiveCash !== 'no';
    }
    if (methodName === 'bank' || methodName === 'card') {
      if (isPOS) return rights.posReceiveBank !== 'no';
      if (isProperty) return rights.propertyReceiveBank !== 'no';
      if (isAccommodation) return rights.accommodationReceiveBank !== 'no';
      if (isExpense) return rights.expenseReceiveBank !== 'no';
      if (isPurchase) return rights.purchaseReceiveBank !== 'no';
    }
    if (methodName === 'mobile') {
      if (isPOS) return rights.posReceiveMobile !== 'no';
      if (isProperty) return rights.propertyReceiveMobile !== 'no';
      if (isAccommodation) return rights.accommodationReceiveMobile !== 'no';
      if (isExpense) return rights.expenseReceiveMobile !== 'no';
      if (isPurchase) return rights.purchaseReceiveMobile !== 'no';
    }
    if (methodName === 'complimentary') {
      if (isPOS) return rights.posReceiveComplimentary !== 'no';
      if (isProperty) return rights.propertyReceiveComplimentary !== 'no';
      if (isAccommodation) return rights.accommodationReceiveComplimentary !== 'no';
      if (isExpense) return rights.expenseReceiveComplimentary !== 'no';
      if (isPurchase) return rights.purchaseReceiveComplimentary !== 'no';
    }
    return true; // Unknown module/method pair defaults to allow
  };

  const [paymentMethods, setPaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string; accountId?: string }>>({
    cash: { active: false, amount: '', reference: '', accountId: '' },
    card: { active: false, amount: '', reference: '', accountId: '' },
    mobile: { active: false, amount: '', reference: '', accountId: '' },
    bank: { active: false, amount: '', reference: '', accountId: '' },
    complimentary: { active: false, amount: '', reference: '', accountId: '' },
  });

  // MPesa STK Push state
  const [mpesaPhone, setMpesaPhone] = useState(defaultPhone || '');
  const [useStkPush, setUseStkPush] = useState(true);
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'>('IDLE');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [completedMpesaPayments, setCompletedMpesaPayments] = useState<{ amount: number, reference: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbSearch, setDbSearch] = useState('');

  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [moduleDefaults, setModuleDefaults] = useState<any[]>([]);

  // Look up a payment by amount / phone / reference. Never lists everything - a blank
  // term returns nothing so an unrelated past payment can't be picked by accident.
  const searchDbTransactions = async (term: string) => {
    const q = (term || '').trim();
    if (!q) {
      setDbTransactions([]);
      return;
    }
    setIsLoadingDb(true);
    try {
      const res = await apiFetch<any[]>(`/api/mpesa/transactions?search=${encodeURIComponent(q)}`);
      setDbTransactions(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast.error('Failed to search M-Pesa transactions: ' + err.message);
      setDbTransactions([]);
    } finally {
      setIsLoadingDb(false);
    }
  };

  const openDbModal = () => {
    const alreadyEntered = Object.entries(paymentMethods)
      .filter(([k]) => k !== 'mobile')
      .reduce((s, [, v]) => s + (v.active && v.amount ? parseFloat(v.amount) || 0 : 0), 0);
    const completedTotal = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, activeTotalDue - alreadyEntered - completedTotal);
    // Prefill with the outstanding amount so the common case is one tap.
    setDbSearch(remaining > 0.01 ? remaining.toFixed(2) : '');
    setDbTransactions([]);
    setIsDbModalOpen(true);
  };

  // Debounced server search whenever the term changes while the picker is open.
  useEffect(() => {
    if (!isDbModalOpen) return;
    const h = setTimeout(() => searchDbTransactions(dbSearch), 350);
    return () => clearTimeout(h);
  }, [dbSearch, isDbModalOpen]);

  const selectDbTransaction = (t: any) => {
    if (completedMpesaPayments.some(p => p.reference === t.reference)) {
      toast.error(`Transaction ${t.reference} is already added!`);
      return;
    }
    setUseStkPush(false);

    const amt = parseFloat(String(t.amount)) || 0;
    const newPayment = { amount: amt, reference: t.reference || '' };
    const newCompleted = [...completedMpesaPayments, newPayment];
    setCompletedMpesaPayments(newCompleted);

    // Make sure mobile payment method is active in UI
    setPaymentMethods(prev => ({
      ...prev,
      mobile: {
        ...(prev.mobile || { active: false, amount: '', reference: '' }),
        active: true,
        reference: '',
        amount: ''
      }
    }));

    const alreadyEntered = Object.entries(paymentMethods)
      .filter(([k]) => k !== 'mobile')
      .reduce((s, [, v]) => s + (v.active && v.amount ? parseFloat(v.amount) || 0 : 0), 0);
    const newTotal = alreadyEntered + newCompleted.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, activeTotalDue - newTotal);

    if (remaining <= 0.01) {
      toast.success(`Added ${t.reference} (${sym}${amt.toFixed(2)}). Full value reached!`);
      setIsDbModalOpen(false);
    } else {
      toast.success(`Added ${t.reference} (${sym}${amt.toFixed(2)}). Need ${sym}${remaining.toFixed(2)} more.`);
      setDbSearch(remaining.toFixed(2));
    }
  };

  const pollSessionRef = useRef<number>(0);

  // Reset and fetch data when opened
  useEffect(() => {
    if (open) {
      Promise.all([
        apiFetch<any[]>('/api/accounting/accounts').catch(() => []),
        module ? apiFetch<any[]>(`/api/accounting/accounts/payment-defaults/${module}`).catch(() => []) : Promise.resolve([])
      ]).then(([accounts, defaults]) => {
        setGlAccounts(Array.isArray(accounts) ? accounts : []);
        setModuleDefaults(Array.isArray(defaults) ? defaults : []);

        const getAcct = (method: string) => {
          const norm = method === 'cash' ? 'CASH' : method === 'card' || method === 'bank' ? 'BANK' : method === 'mobile' ? 'MOBILE_MONEY' : '';
          const def = (Array.isArray(defaults) ? defaults : []).find(d => d.paymentMethod === norm);
          return def?.glAccount?.id?.toString() || '';
        };

        const canCash = getMethodPermission('cash');
        const canCard = getMethodPermission('card');
        const canMobile = getMethodPermission('mobile');
        const canBank = getMethodPermission('bank');
        const canComplimentary = getMethodPermission('complimentary');

        let defCash = false, defCard = false, defMobile = false, defBank = false, defComplimentary = false;

        setPaymentMethods({
          cash: { active: initialPayments?.cash?.active ?? defCash, amount: (initialPayments?.cash?.active ?? defCash) ? (initialPayments?.cash?.amount || activeTotalDue.toFixed(2)) : '', reference: initialPayments?.cash?.reference || '', accountId: getAcct('cash') },
          card: { active: initialPayments?.card?.active || defCard, amount: (initialPayments?.card?.active || defCard) ? (initialPayments?.card?.amount || activeTotalDue.toFixed(2)) : '', reference: initialPayments?.card?.reference || '', accountId: getAcct('card') },
          mobile: { active: (initialPayments?.mpesa?.active || initialPayments?.mobile?.active) || defMobile, amount: ((initialPayments?.mpesa?.active || initialPayments?.mobile?.active) || defMobile) ? ((initialPayments?.mpesa?.amount || initialPayments?.mobile?.amount) || activeTotalDue.toFixed(2)) : '', reference: (initialPayments?.mpesa?.reference || initialPayments?.mobile?.reference) || '', accountId: getAcct('mobile') },
          bank: { active: initialPayments?.bank?.active || defBank, amount: (initialPayments?.bank?.active || defBank) ? (initialPayments?.bank?.amount || activeTotalDue.toFixed(2)) : '', reference: initialPayments?.bank?.reference || '', accountId: getAcct('bank') },
          complimentary: { active: initialPayments?.complimentary?.active || defComplimentary, amount: (initialPayments?.complimentary?.active || defComplimentary) ? (initialPayments?.complimentary?.amount || activeTotalDue.toFixed(2)) : '', reference: initialPayments?.complimentary?.reference || '', accountId: '' },
        });
      });

      setMpesaPhone(defaultPhone || '');
      setMpesaStatus('IDLE');
      setIsPollingMpesa(false);
      setCheckoutRequestId(null);
      setCompletedMpesaPayments([]);
    }
  }, [open, activeTotalDue, defaultPhone, module]);

  const handlePaymentMethodToggle = (method: string, checked: boolean) => {
    if (!checked) {
      setPaymentMethods(prev => ({
        ...prev,
        [method]: {
          ...(prev[method] || { active: false, amount: '', reference: '', accountId: '' }),
          active: false,
          amount: ''
        }
      }));
      return;
    }

    setPaymentMethods(prev => {
      let updated = { ...prev };

      let otherTotal = 0;
      let fullMethodKey = '';

      Object.entries(updated).forEach(([k, v]) => {
        if (k !== method && v.active) {
          const amt = parseFloat(v.amount) || 0;
          otherTotal += amt;
          if (Math.abs(amt - activeTotalDue) < 0.01) {
            fullMethodKey = k;
          }
        }
      });

      const completedTotal = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);
      let remainder = activeTotalDue - otherTotal - completedTotal;

      // If another single method was taking up the full amount, deactivate it so the new method takes over
      if (fullMethodKey) {
        updated[fullMethodKey] = {
          ...updated[fullMethodKey],
          active: false,
          amount: ''
        };
        remainder = activeTotalDue - completedTotal;
      }

      const targetAmount = Math.max(0, remainder);

      return {
        ...updated,
        [method]: {
          ...(updated[method] || { active: false, amount: '', reference: '', accountId: '' }),
          active: true,
          amount: targetAmount > 0 ? targetAmount.toFixed(2) : ''
        }
      };
    });
  };

  const updatePaymentDetail = (method: string, field: 'amount' | 'reference' | 'accountId', value: string) => {
    setPaymentMethods(prev => {
      let finalValue = value;

      if (field === 'amount' && method !== 'cash') {
        const otherTotal = Object.entries(prev)
          .filter(([k, v]) => k !== method && v.active)
          .reduce((s, [, v]) => s + (parseFloat(v.amount) || 0), 0);
        const completedTotal = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);
        const maxAllowed = Math.max(0, activeTotalDue - otherTotal - completedTotal);

        const numVal = parseFloat(value) || 0;
        if (numVal > maxAllowed + 0.001) {
          finalValue = maxAllowed > 0 ? maxAllowed.toFixed(2) : '';
          toast.warning(`Non-cash payment cannot exceed remaining balance of ${sym}${maxAllowed.toFixed(2)}`);
        }
      }

      return {
        ...prev,
        [method]: {
          ...(prev[method] || { active: false, amount: '', reference: '', accountId: '' }),
          [field]: finalValue
        }
      };
    });
  };

  async function pollMpesaStatus(requestId: string, sessionId?: number, deadline?: number) {
    if (sessionId && sessionId !== pollSessionRef.current) return;
    const dl = deadline ?? Date.now() + 45_000;
    if (Date.now() >= dl) {
      setIsPollingMpesa(false);
      setMpesaStatus('TIMEOUT');
      toast.info('M-Pesa is taking longer than usual. Tap "Check Again" once the customer approves the prompt.');
      return;
    }
    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush/status/${requestId}`);
      if (data.status === 'COMPLETED' || data.resultCode === "0") {
        setIsPollingMpesa(false);
        setMpesaStatus('SUCCESS');
        const receipt = data.mpesaReceiptNumber || data.MpesaReceiptNumber;
        toast.success(`Payment of KES ${data.amount} received successfully!`);

        // Add to completed list
        setCompletedMpesaPayments(prev => {
          const exists = prev.find(p => p.reference === receipt);
          if (exists) return prev;
          return [...prev, { amount: data.amount, reference: receipt }];
        });

        // Disable STK push input
        setMpesaStatus('IDLE');
        setMpesaPhone('');

      } else if (data.status === 'FAILED' || (data.resultCode && data.resultCode !== "0")) {
        setIsPollingMpesa(false);
        setMpesaStatus('FAILED');
        toast.error(`Payment failed: ${data.resultDesc || 'Transaction was not completed'}`);
      } else if (data.status === 'CANCELLED') {
        setIsPollingMpesa(false);
        setMpesaStatus('CANCELLED');
        toast.error(`Payment cancelled by user`);
      } else {
        if (!sessionId || sessionId === pollSessionRef.current) {
          setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current, dl), 3000);
        }
      }
    } catch (error) {
      console.error("Error polling M-Pesa status:", error);
      if (!sessionId || sessionId === pollSessionRef.current) {
        setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current, dl), 5000);
      }
    }
  }

  async function manualQueryMpesa(requestId: string) {
    setIsPollingMpesa(true);
    setMpesaStatus('PENDING');
    try {
      await apiFetch(`/api/mpesa/stkpush/query/${requestId}`);
      const currentSession = Date.now();
      pollSessionRef.current = currentSession;
      await pollMpesaStatus(requestId, currentSession);
    } catch (error: any) {
      setIsPollingMpesa(false);
      setMpesaStatus('FAILED');
      toast.error(error.message || 'Failed to query M-Pesa status');
    }
  }

  const handleMpesaPush = async () => {
    if (!mpesaPhone) {
      toast.error("Please enter a valid M-Pesa phone number");
      return;
    }
    const amount = parseFloat(paymentMethods.mobile.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount for M-Pesa");
      return;
    }

    setIsPollingMpesa(true);
    setMpesaStatus('PENDING');
    try {
      const data = await apiFetch<any>(`/api/mpesa/stkpush`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: amount,
          accountReference: 'Cakes App',
          transactionDesc: 'Payment for order'
        })
      });

      const requestId = data.CheckoutRequestID || data.checkoutRequestID;
      setCheckoutRequestId(requestId);
      toast.success("STK Push sent to customer's phone");

      const currentSession = Date.now();
      pollSessionRef.current = currentSession;
      pollMpesaStatus(requestId, currentSession);

    } catch (error: any) {
      setIsPollingMpesa(false);
      setMpesaStatus('FAILED');
      toast.error(error.message || 'Failed to initiate STK push');
    }
  };

  const handleConfirm = async () => {
    // Validate total
    const enteredCash = paymentMethods.cash.active ? parseFloat(paymentMethods.cash.amount) || 0 : 0;
    const enteredCard = paymentMethods.card.active ? parseFloat(paymentMethods.card.amount) || 0 : 0;
    const enteredMobile = paymentMethods.mobile.active && !useStkPush ? parseFloat(paymentMethods.mobile.amount) || 0 : 0;
    const enteredBank = paymentMethods.bank?.active ? parseFloat(paymentMethods.bank.amount) || 0 : 0;
    const enteredComplimentary = paymentMethods.complimentary?.active ? parseFloat(paymentMethods.complimentary.amount) || 0 : 0;
    const completedMobile = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalEntered = enteredCash + enteredCard + enteredMobile + enteredBank + enteredComplimentary + completedMobile;

    if (allowPartialPayment) {
      if (totalEntered > activeTotalDue + 0.01) {
        toast.error(`Payment cannot exceed the outstanding balance of ${sym}${activeTotalDue.toFixed(2)}.`);
        return;
      }
      if (totalEntered <= 0.01) {
        toast.error(`Please enter a valid payment amount.`);
        return;
      }
    } else {
      // We allow slight overpayment if it's cash (change will be given)
      // But we should warn if underpayment
      if (totalEntered < activeTotalDue - 0.01) {
        toast.error(`Insufficient payment. Need ${sym}${(activeTotalDue - totalEntered).toFixed(2)} more.`);
        return;
      }
    }

    // The gross cash tendered is sent as-is; the backend strips any change from the
    // recorded CASH line and from amountPaid so change never lands in a GL/deposit
    // account or the payments report. Non-cash overpayment is already blocked above.
    const finalPayments: PaymentDetails[] = [];
    if (enteredCash > 0) finalPayments.push({ method: 'cash', amount: enteredCash, reference: paymentMethods.cash.reference, glAccountId: paymentMethods.cash.accountId ? parseInt(paymentMethods.cash.accountId) : undefined });
    if (enteredCard > 0) finalPayments.push({ method: 'card', amount: enteredCard, reference: paymentMethods.card.reference, glAccountId: paymentMethods.card.accountId ? parseInt(paymentMethods.card.accountId) : undefined });
    if (enteredMobile > 0) finalPayments.push({ method: 'mobile', amount: enteredMobile, reference: paymentMethods.mobile.reference, glAccountId: paymentMethods.mobile.accountId ? parseInt(paymentMethods.mobile.accountId) : undefined });
    if (enteredBank > 0) finalPayments.push({ method: 'bank', amount: enteredBank, reference: paymentMethods.bank?.reference, glAccountId: paymentMethods.bank?.accountId ? parseInt(paymentMethods.bank.accountId) : undefined });
    if (enteredComplimentary > 0) finalPayments.push({ method: 'complimentary', amount: enteredComplimentary, reference: paymentMethods.complimentary?.reference, glAccountId: paymentMethods.complimentary?.accountId ? parseInt(paymentMethods.complimentary.accountId) : undefined });

    completedMpesaPayments.forEach(p => {
      finalPayments.push({ method: 'mobile', amount: p.amount, reference: p.reference, glAccountId: paymentMethods.mobile.accountId ? parseInt(paymentMethods.mobile.accountId) : undefined });
    });

    try {
      setIsSubmitting(true);
      const confirmResult = await activeOnConfirm(finalPayments);
      const consumedJournalNumber = typeof confirmResult === 'string'
        ? confirmResult
        : (confirmResult && typeof confirmResult === 'object' ? confirmResult.journalNumber : undefined);

      // Only reconcile M-Pesa payments that actually came from the DB (picked via
      // "Select from DB" or confirmed by an STK push) - a manually typed reference must
      // never hit the M-Pesa tables.
      const mpesaRefs = completedMpesaPayments
        .map(p => p.reference)
        .filter(r => r && r !== 'MPESA-STK');
      if (mpesaRefs.length > 0) {
        try {
          await apiFetch('/api/mpesa/transactions/consume', {
            method: 'POST',
            body: JSON.stringify({ references: mpesaRefs, journalNumber: consumedJournalNumber })
          });
        } catch (err) {
          console.error('Failed to update M-Pesa transaction status:', err);
        }
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalEnteredAmount = (paymentMethods.cash.active ? parseFloat(paymentMethods.cash.amount) || 0 : 0) +
    (paymentMethods.card.active ? parseFloat(paymentMethods.card.amount) || 0 : 0) +
    (paymentMethods.mobile.active && !useStkPush ? parseFloat(paymentMethods.mobile.amount) || 0 : 0) +
    (paymentMethods.bank?.active ? parseFloat(paymentMethods.bank.amount) || 0 : 0) +
    (paymentMethods.complimentary?.active ? parseFloat(paymentMethods.complimentary.amount) || 0 : 0) +
    completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);


  return (
    <Dialog open={open} onOpenChange={(openVal) => {
      if (!openVal && isPollingMpesa) {
        toast.warning("Cannot close while M-Pesa is processing");
        return;
      }
      onOpenChange(openVal);
    }}>
      <DialogContent className="max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-500 shrink-0" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {activeSubtitle && <span className="block font-medium text-foreground mb-0.5">{activeSubtitle}</span>}
            {allowPartialPayment ? 'Outstanding Balance: ' : 'Total due: '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">{sym}{activeTotalDue.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 my-1 scrollbar-thin">
          {/* Payment summary */}
          <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-muted/40 rounded-lg border border-border/50">
            <div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">{allowPartialPayment ? 'Outstanding' : 'Total Due'}</div>
              <div className="font-semibold text-xs sm:text-sm text-amber-600 dark:text-amber-400">{sym}{activeTotalDue.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">Entered</div>
              <div className={`font-semibold text-xs sm:text-sm ${allowPartialPayment ? (totalEnteredAmount > 0 && totalEnteredAmount <= activeTotalDue + 0.01 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400') : (totalEnteredAmount >= activeTotalDue - 0.01 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}`}>
                {sym}{totalEnteredAmount.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs text-muted-foreground">{totalEnteredAmount > activeTotalDue ? 'Change' : 'Balance'}</div>
              <div className={`font-semibold text-xs sm:text-sm ${totalEnteredAmount >= activeTotalDue - 0.01 ? 'text-slate-400' : 'text-red-500'}`}>
                {sym}{Math.abs(activeTotalDue - totalEnteredAmount).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-semibold">Payment Methods</Label>

            {/* Payment Method Rows */}
            {(['cash', 'card', 'mobile', 'bank', 'complimentary'] as const).map((method) => (
              <div key={method} className="space-y-1.5">
                <div className={cn(
                  "grid grid-cols-1 sm:grid-cols-[140px_110px_1fr] gap-2 items-center p-2 sm:p-2.5 rounded-lg border transition-all",
                  paymentMethods[method]?.active ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20" : "border-border/60 hover:border-border"
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    {(() => {
                      const hasPerm = getMethodPermission(method);
                      return (
                        <>
                          <Checkbox
                            checked={paymentMethods[method]?.active || false}
                            onCheckedChange={(checked) => handlePaymentMethodToggle(method, checked === true)}
                            disabled={!hasPerm}
                            id={`chk-${method}`}
                          />
                          <Label htmlFor={`chk-${method}`} className={cn(
                            "capitalize flex items-center gap-1.5 text-xs sm:text-sm font-medium select-none truncate",
                            hasPerm ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                          )}>
                            {method === 'cash' ? <Banknote className="h-4 w-4 shrink-0 text-amber-600" /> :
                             method === 'card' ? <CreditCard className="h-4 w-4 shrink-0 text-blue-600" /> :
                             method === 'mobile' ? <Smartphone className="h-4 w-4 shrink-0 text-green-600" /> :
                             method === 'bank' ? <Building className="h-4 w-4 shrink-0 text-purple-600" /> :
                             <Gift className="h-4 w-4 shrink-0 text-pink-600" />}
                            <span>{method === 'complimentary' ? 'Complimentary' : method === 'bank' ? 'Bank Transfer' : method}</span>
                            {!hasPerm && <Lock className="h-3 w-3 ml-1 text-muted-foreground shrink-0" />}
                          </Label>
                        </>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 sm:contents gap-2 w-full">
                    <Input
                      type="number"
                      value={paymentMethods[method]?.amount || ''}
                      onChange={(e) => updatePaymentDetail(method, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="h-8 text-xs sm:text-sm"
                      disabled={!paymentMethods[method]?.active || (isPollingMpesa && method === 'mobile')}
                    />
                    {/* Reference / Phone */}
                    {method === 'mobile' && paymentMethods[method]?.active && useStkPush ? (
                      <div className="flex gap-1 min-w-0">
                        <Input
                          type="text"
                          id="mpesa-phone"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="07..."
                          className="h-8 flex-1 text-xs sm:text-sm min-w-0"
                          disabled={isPollingMpesa}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
                          onClick={handleMpesaPush}
                          disabled={isPollingMpesa}
                        >
                          {isPollingMpesa ? '...' : 'Push'}
                        </Button>
                      </div>
                    ) : (
                      <Input
                        value={paymentMethods[method]?.reference || ''}
                        onChange={(e) => updatePaymentDetail(method, 'reference', e.target.value)}
                        placeholder={method === 'mobile' ? 'Ref Code' : 'Ref (optional)'}
                        className="h-8 text-xs sm:text-sm"
                        disabled={!paymentMethods[method]?.active}
                      />
                    )}
                  </div>
                </div>

                {paymentMethods[method]?.active && (
                  <div className="pl-2 sm:pl-7 pr-2 py-1 flex flex-wrap sm:flex-nowrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap text-[11px] sm:text-xs">Deposit Account:</span>
                    <select
                      value={paymentMethods[method]?.accountId || ''}
                      onChange={(e) => updatePaymentDetail(method, 'accountId', e.target.value)}
                      disabled={!canChangeAccount}
                      className="bg-background border border-muted-foreground/20 rounded px-2 py-1 text-xs w-full sm:w-auto flex-1 max-w-full sm:max-w-[280px] dark:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {moduleDefaults.some(d => d.paymentMethod === (method === 'cash' ? 'CASH' : method === 'card' || method === 'bank' ? 'BANK' : method === 'mobile' ? 'MOBILE_MONEY' : ''))
                          ? 'Global Default (Override)'
                          : 'Default mapped account'}
                      </option>
                      {glAccounts
                        .filter((acc: any) => acc.type === 'ASSET' && acc.active)
                        .map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Mobile Extra Options */}
                {method === 'mobile' && paymentMethods[method]?.active && (
                  <div className="flex flex-col gap-1.5 pl-2 sm:pl-7 pr-2 py-1.5 bg-muted/40 rounded-lg text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px] sm:text-xs">Use M-Pesa STK Push</span>
                      <Switch
                        checked={useStkPush}
                        onCheckedChange={setUseStkPush}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground text-[11px] sm:text-xs">Already in database?</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={openDbModal}
                        disabled={isLoadingDb}
                        className="h-6 px-2 text-[11px] bg-white dark:bg-slate-900 gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                      >
                        <Search className="h-3 w-3" />
                        {isLoadingDb ? 'Loading...' : 'Select from DB'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* M-Pesa Polling UI */}
                {method === 'mobile' && (isPollingMpesa || mpesaStatus !== 'IDLE') && (
                  <div className="space-y-2 py-2">
                    <div className={`flex items-center justify-center gap-2 text-xs font-medium ${mpesaStatus === 'PENDING' ? 'text-blue-600 animate-pulse' :
                      mpesaStatus === 'SUCCESS' ? 'text-green-600' :
                        mpesaStatus === 'CANCELLED' || mpesaStatus === 'TIMEOUT' ? 'text-amber-600' :
                          'text-red-600'
                      }`}>
                      {mpesaStatus === 'PENDING' && <RefreshCw className="h-3 w-3 animate-spin" />}
                      {mpesaStatus === 'SUCCESS' && <Check className="h-3 w-3" />}
                      {(mpesaStatus === 'FAILED' || mpesaStatus === 'TIMEOUT') && <AlertCircle className="h-3 w-3" />}
                      <span>
                        {mpesaStatus === 'PENDING' && 'Waiting for M-Pesa confirmation...'}
                        {mpesaStatus === 'SUCCESS' && 'Payment Successful!'}
                        {mpesaStatus === 'CANCELLED' && 'Payment Cancelled.'}
                        {mpesaStatus === 'FAILED' && 'Payment Failed.'}
                        {mpesaStatus === 'TIMEOUT' && 'Still waiting - use Check Again.'}
                      </span>
                      {mpesaStatus !== 'SUCCESS' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-2 text-[10px] ml-2"
                          onClick={() => checkoutRequestId && manualQueryMpesa(checkoutRequestId)}
                          disabled={isPollingMpesa}
                        >
                          {isPollingMpesa ? 'Checking...' : 'Check Again'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>

          {/* Completed MPESA transactions */}
          {completedMpesaPayments.length > 0 && (
            <div className="p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-1.5">
              <div className="text-xs font-semibold text-green-800 dark:text-green-300">Received M-Pesa Payments:</div>
              {completedMpesaPayments.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-xs text-green-700 dark:text-green-400 bg-green-100/50 dark:bg-green-900/30 px-2 py-1 rounded">
                  <span className="font-mono font-bold">{p.reference}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{sym}{p.amount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedMpesaPayments(prev => prev.filter((_, idx) => idx !== i));
                        toast.info(`Removed ${p.reference}`);
                      }}
                      className="text-red-500 hover:text-red-700 p-0.5"
                      title="Remove transaction"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t flex flex-col-reverse sm:flex-row sm:justify-between gap-2 w-full">
          <div className="w-full sm:w-auto flex justify-start">
            {extraActions}
          </div>
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isPollingMpesa} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                isPollingMpesa ||
                (
                  !paymentMethods.cash.active &&
                  !paymentMethods.card.active &&
                  !paymentMethods.mobile.active &&
                  !paymentMethods.bank?.active &&
                  !paymentMethods.complimentary?.active &&
                  completedMpesaPayments.length === 0
                )
              }
              className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {isSubmitting ? 'Confirming...' : (submitText || 'Confirm Payment')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* DB Transaction Selector Dialog */}
      <Dialog open={isDbModalOpen} onOpenChange={setIsDbModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-4 z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              Select M-Pesa Transaction from DB
            </DialogTitle>
            <DialogDescription className="text-xs">
              Search by amount or phone number to find the customer's payment.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 relative flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Amount or phone number..."
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>
            {dbSearch && (
              <Button type="button" variant="outline" size="sm" onClick={() => setDbSearch('')} className="h-9 px-2 text-xs">
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
            {dbTransactions
              .map((t, idx) => {
                const isAlreadyAdded = completedMpesaPayments.some(p => p.reference === t.reference);
                return (
                  <div
                    key={idx}
                    onClick={() => !isAlreadyAdded && selectDbTransaction(t)}
                    className={cn(
                      "p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2",
                      isAlreadyAdded
                        ? "border-slate-100 bg-slate-100 dark:bg-slate-900 opacity-60 cursor-not-allowed"
                        : "border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-200">
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">{t.reference}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                          {t.type || 'MPESA'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.sender || t.phone || 'Unknown Sender'} {t.phone ? `(${t.phone})` : ''}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {t.date ? String(t.date).replace('T', ' ') : ''}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {sym}{t.amount ? parseFloat(String(t.amount)).toFixed(2) : '0.00'}
                      </div>
                      <span className={cn("text-[10px] font-semibold", isAlreadyAdded ? "text-slate-400" : "text-primary underline")}>
                        {isAlreadyAdded ? 'Added' : 'Select'}
                      </span>
                    </div>
                  </div>
                );
              })}
            {isLoadingDb && (
              <div className="text-center py-6 text-xs text-muted-foreground">Searching...</div>
            )}
            {dbTransactions.length === 0 && !isLoadingDb && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {dbSearch.trim()
                  ? 'No matching M-Pesa payment found.'
                  : 'Enter an amount or phone number to find a payment.'}
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDbModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
