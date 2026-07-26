import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { Wallet, Banknote, CreditCard, Smartphone, Check, AlertCircle, RefreshCw, Building, Gift, Search, Database, X } from 'lucide-react';
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
  onConfirm?: (payments: PaymentDetails[]) => Promise<void>;
  onSubmit?: (payments: PaymentDetails[]) => Promise<void>; // alias for onConfirm
  isProcessing?: boolean;
  onCancel?: () => void;
  extraActions?: React.ReactNode;
  submitText?: string;
  allowPartialPayment?: boolean;
  initialPayments?: Record<string, { active: boolean; amount: string; reference: string }>;
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
  initialPayments
}: PaymentDialogProps) {
  const { sym } = useCurrency();
  const activeTotalDue = totalDue ?? totalAmount ?? 0;
  const activeSubtitle = subtitle ?? description;
  const activeOnConfirm = onConfirm ?? onSubmit ?? (async () => { });

  // Payment states
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank: { active: false, amount: '', reference: '' },
    complimentary: { active: false, amount: '', reference: '' },
  });

  // MPesa STK Push state
  const [mpesaPhone, setMpesaPhone] = useState(defaultPhone || '');
  const [useStkPush, setUseStkPush] = useState(true);
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('IDLE');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [completedMpesaPayments, setCompletedMpesaPayments] = useState<{ amount: number, reference: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbSearch, setDbSearch] = useState('');

  const fetchDbTransactions = async () => {
    setIsLoadingDb(true);
    try {
      const res = await apiFetch<any[]>('/api/mpesa/transactions');
      setDbTransactions(Array.isArray(res) ? res : []);

      // Automatically search by remaining amount
      const alreadyEntered = Object.entries(paymentMethods)
        .filter(([k]) => k !== 'mobile')
        .reduce((s, [, v]) => s + (v.active && v.amount ? parseFloat(v.amount) || 0 : 0), 0);
      const completedTotal = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = Math.max(0, activeTotalDue - alreadyEntered - completedTotal);
      if (remaining > 0.01) {
        setDbSearch(remaining.toFixed(2));
      } else {
        setDbSearch('');
      }

      setIsDbModalOpen(true);
    } catch (err: any) {
      toast.error('Failed to load M-Pesa transactions: ' + err.message);
    } finally {
      setIsLoadingDb(false);
    }
  };

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

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPaymentMethods({
        cash: initialPayments?.cash || { active: true, amount: activeTotalDue.toFixed(2), reference: '' },
        card: initialPayments?.card || { active: false, amount: '', reference: '' },
        mobile: initialPayments?.mpesa || initialPayments?.mobile || { active: false, amount: '', reference: '' },
        bank: initialPayments?.bank || { active: false, amount: '', reference: '' },
        complimentary: initialPayments?.complimentary || { active: false, amount: '', reference: '' },
      });
      setMpesaPhone(defaultPhone || '');
      setMpesaStatus('IDLE');
      setIsPollingMpesa(false);
      setCheckoutRequestId(null);
      setCompletedMpesaPayments([]);
    }
  }, [open, activeTotalDue, defaultPhone]);

  const handlePaymentMethodToggle = (method: string, checked: boolean) => {
    const alreadyEntered = Object.entries(paymentMethods)
      .filter(([k]) => k !== method)
      .reduce((s, [, v]) => s + (v.active ? parseFloat(v.amount) || 0 : 0), 0);

    // Add completed mpesa payments if we're not toggling mobile (or even if we are, they shouldn't be lost)
    const completedTotal = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);

    // Allow negative remainders for refunds
    const remainder = activeTotalDue - alreadyEntered - completedTotal;

    setPaymentMethods(prev => ({
      ...prev,
      [method]: {
        ...(prev[method] || { active: false, amount: '', reference: '' }),
        active: checked,
        amount: checked ? (remainder !== 0 ? remainder.toFixed(2) : '') : ''
      }
    }));
  };

  const updatePaymentDetail = (method: string, field: 'amount' | 'reference', value: string) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: {
        ...(prev[method] || { active: false, amount: '', reference: '' }),
        [field]: value
      }
    }));
  };

  async function pollMpesaStatus(requestId: string, sessionId?: number) {
    if (sessionId && sessionId !== pollSessionRef.current) return;
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
          setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 3000);
        }
      }
    } catch (error) {
      console.error("Error polling M-Pesa status:", error);
      if (!sessionId || sessionId === pollSessionRef.current) {
        setTimeout(() => pollMpesaStatus(requestId, sessionId || pollSessionRef.current), 5000);
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

    const finalPayments: PaymentDetails[] = [];
    if (enteredCash > 0) finalPayments.push({ method: 'cash', amount: enteredCash, reference: paymentMethods.cash.reference });
    if (enteredCard > 0) finalPayments.push({ method: 'card', amount: enteredCard, reference: paymentMethods.card.reference });
    if (enteredMobile > 0) finalPayments.push({ method: 'mobile', amount: enteredMobile, reference: paymentMethods.mobile.reference });
    if (enteredBank > 0) finalPayments.push({ method: 'bank', amount: enteredBank, reference: paymentMethods.bank?.reference });
    if (enteredComplimentary > 0) finalPayments.push({ method: 'complimentary', amount: enteredComplimentary, reference: paymentMethods.complimentary?.reference });

    completedMpesaPayments.forEach(p => {
      finalPayments.push({ method: 'mobile', amount: p.amount, reference: p.reference });
    });

    try {
      setIsSubmitting(true);
      await activeOnConfirm(finalPayments);

      // Mark used M-Pesa transactions as consumed in DB
      const mpesaRefs = finalPayments
        .filter(p => p.method === 'mobile' && p.reference && p.reference !== 'MPESA-STK')
        .map(p => p.reference);
      if (mpesaRefs.length > 0) {
        try {
          await apiFetch('/api/mpesa/transactions/consume', {
            method: 'POST',
            body: JSON.stringify({ references: mpesaRefs })
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-500" />
            <DialogTitle>{title}</DialogTitle>
          </DialogTitle>
          <DialogDescription>
            {activeSubtitle && <span className="block font-medium text-foreground mb-1">{activeSubtitle}</span>}
            {allowPartialPayment ? 'Outstanding Balance: ' : 'Total due: '}
            <span className="font-semibold text-amber-600">{sym}{activeTotalDue.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="mt-4 pt-4 border-t">
            {/* Payment summary */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">{allowPartialPayment ? 'Outstanding Balance' : 'Total Due'}</div>
                <div className="font-semibold text-amber-600">{sym}{activeTotalDue.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Entered</div>
                <div className={`font-semibold ${allowPartialPayment ? (totalEnteredAmount > 0 && totalEnteredAmount <= activeTotalDue + 0.01 ? 'text-green-600' : 'text-amber-600') : (totalEnteredAmount >= activeTotalDue - 0.01 ? 'text-green-600' : 'text-amber-600')}`}>
                  {sym}{totalEnteredAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{totalEnteredAmount > activeTotalDue ? 'Change' : 'Balance'}</div>
                <div className={`font-semibold ${totalEnteredAmount >= activeTotalDue - 0.01 ? 'text-slate-400' : 'text-red-500'}`}>
                  {sym}{Math.abs(activeTotalDue - totalEnteredAmount).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Payment Methods</Label>

            {/* Payment Method Rows */}
            {(['cash', 'card', 'mobile', 'bank', 'complimentary'] as const).map((method) => (
              <div key={method} className="space-y-2">
                <div className={cn(
                  "grid grid-cols-[160px_120px_1fr] gap-2 items-center p-2 rounded border",
                  paymentMethods[method]?.active ? "border-amber-500/50 bg-amber-50/30" : "border-border"
                )}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={paymentMethods[method]?.active || false}
                      onCheckedChange={(checked) => handlePaymentMethodToggle(method, checked === true)}
                    />
                    <Label className="capitalize flex items-center gap-1.5 cursor-pointer text-sm">
                      {method === 'cash' ? <Banknote className="h-3.5 w-3.5" /> : method === 'card' ? <CreditCard className="h-3.5 w-3.5" /> : method === 'mobile' ? <Smartphone className="h-3.5 w-3.5" /> : method === 'bank' ? <Building className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                      {method === 'complimentary' ? 'Complimentary' : method === 'bank' ? 'Bank Transfer' : method}
                    </Label>
                  </div>
                  <Input
                    type="number"
                    value={paymentMethods[method]?.amount || ''}
                    onChange={(e) => updatePaymentDetail(method, 'amount', e.target.value)}
                    placeholder="Amount"
                    className="h-8 text-sm"
                    disabled={!paymentMethods[method]?.active || (isPollingMpesa && method === 'mobile')}
                  />
                  {/* Reference / Phone */}
                  {method === 'mobile' && paymentMethods[method]?.active && useStkPush ? (
                    <div className="flex gap-1.5">
                      <Input
                        type="text"
                        id="mpesa-phone"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        placeholder="07..."
                        className="h-8 flex-1 text-sm"
                        disabled={isPollingMpesa}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 bg-green-600 hover:bg-green-700 text-white"
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
                      className="h-8 text-sm"
                      disabled={!paymentMethods[method]?.active}
                    />
                  )}
                </div>

                {/* Mobile Extra Options */}
                {method === 'mobile' && paymentMethods[method]?.active && (
                  <div className="flex flex-col gap-2 pl-7 pr-1 py-1.5 bg-muted/40 rounded text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Use M-Pesa STK Push</span>
                      <Switch
                        checked={useStkPush}
                        onCheckedChange={setUseStkPush}
                        className="scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Already in database?</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={fetchDbTransactions}
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
                  <div className="col-span-2 space-y-2 py-2">
                    <div className={`flex items-center justify-center gap-2 text-xs font-medium ${mpesaStatus === 'PENDING' ? 'text-blue-600 animate-pulse' :
                      mpesaStatus === 'SUCCESS' ? 'text-green-600' :
                        mpesaStatus === 'CANCELLED' ? 'text-amber-600' :
                          'text-red-600'
                      }`}>
                      {mpesaStatus === 'PENDING' && <RefreshCw className="h-3 w-3 animate-spin" />}
                      {mpesaStatus === 'SUCCESS' && <Check className="h-3 w-3" />}
                      {mpesaStatus === 'FAILED' && <AlertCircle className="h-3 w-3" />}
                      <span>
                        {mpesaStatus === 'PENDING' && 'Waiting for M-Pesa confirmation...'}
                        {mpesaStatus === 'SUCCESS' && 'Payment Successful!'}
                        {mpesaStatus === 'CANCELLED' && 'Payment Cancelled.'}
                        {mpesaStatus === 'FAILED' && 'Payment Failed.'}
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
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-green-800">Received M-Pesa Payments:</div>
              {completedMpesaPayments.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm text-green-700 bg-green-100/50 px-2 py-1 rounded">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isPollingMpesa}>
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
          >
            {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
          </Button>
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
              Choose an existing M-Pesa or STK push transaction from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 relative flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search amount, ref, phone..."
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
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
              .filter(t => {
                if (!dbSearch) return true;
                const q = dbSearch.toLowerCase().trim();
                const refMatch = t.reference?.toLowerCase().includes(q);
                const phoneMatch = t.phone?.includes(q);
                const senderMatch = t.sender?.toLowerCase().includes(q);
                const amountMatch = t.amount && (
                  String(t.amount).includes(q) ||
                  Math.abs(parseFloat(String(t.amount)) - parseFloat(q)) < 0.05
                );
                return refMatch || phoneMatch || senderMatch || amountMatch;
              })
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
            {dbTransactions.length === 0 && !isLoadingDb && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No M-Pesa transactions found in the database.
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
