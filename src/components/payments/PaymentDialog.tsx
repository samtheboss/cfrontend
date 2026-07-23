import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { Wallet, Banknote, CreditCard, Smartphone, Check, AlertCircle, RefreshCw } from 'lucide-react';
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
  method: 'cash' | 'card' | 'mobile';
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
  const activeOnConfirm = onConfirm ?? onSubmit ?? (async () => {});

  // Payment states
  const [paymentMethods, setPaymentMethods] = useState<Record<'cash' | 'card' | 'mobile', { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
  });

  // MPesa STK Push state
  const [mpesaPhone, setMpesaPhone] = useState(defaultPhone || '');
  const [useStkPush, setUseStkPush] = useState(true);
  const [isPollingMpesa, setIsPollingMpesa] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('IDLE');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [completedMpesaPayments, setCompletedMpesaPayments] = useState<{ amount: number, reference: string }[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollSessionRef = useRef<number>(0);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPaymentMethods({
        cash: initialPayments?.cash || { active: true, amount: activeTotalDue.toFixed(2), reference: '' },
        card: initialPayments?.card || { active: false, amount: '', reference: '' },
        mobile: initialPayments?.mpesa || initialPayments?.mobile || { active: false, amount: '', reference: '' },
      });
      setMpesaPhone(defaultPhone || '');
      setMpesaStatus('IDLE');
      setIsPollingMpesa(false);
      setCheckoutRequestId(null);
      setCompletedMpesaPayments([]);
    }
  }, [open, activeTotalDue, defaultPhone]);

  const handlePaymentMethodToggle = (method: 'cash' | 'card' | 'mobile', checked: boolean) => {
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
        ...prev[method],
        active: checked,
        amount: checked ? (remainder !== 0 ? remainder.toFixed(2) : '') : ''
      }
    }));
  };

  const updatePaymentDetail = (method: 'cash' | 'card' | 'mobile', field: 'amount' | 'reference', value: string) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: {
        ...prev[method],
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
    const completedMobile = completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const totalEntered = enteredCash + enteredCard + enteredMobile + completedMobile;
    
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
    
    completedMpesaPayments.forEach(p => {
       finalPayments.push({ method: 'mobile', amount: p.amount, reference: p.reference });
    });

    try {
      setIsSubmitting(true);
      await activeOnConfirm(finalPayments);
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
                             completedMpesaPayments.reduce((sum, p) => sum + p.amount, 0);


  return (
    <Dialog open={open} onOpenChange={(openVal) => {
      if (!openVal && isPollingMpesa) {
        toast.warning("Cannot close while M-Pesa is processing");
        return;
      }
      onOpenChange(openVal);
    }}>
      <DialogContent className="max-w-md">
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
            {(['cash', 'card', 'mobile'] as const).map((method) => (
              <div key={method} className="space-y-2">
                <div className={cn(
                  "grid grid-cols-[100px_1fr_1fr] gap-2 items-center p-2 rounded border",
                  paymentMethods[method].active ? "border-amber-500/50 bg-amber-50/30" : "border-border"
                )}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={paymentMethods[method].active}
                      onCheckedChange={(checked) => handlePaymentMethodToggle(method, checked === true)}
                    />
                    <Label className="capitalize flex items-center gap-1.5 cursor-pointer text-sm">
                      {method === 'cash' ? <Banknote className="h-3.5 w-3.5" /> : method === 'card' ? <CreditCard className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                      {method}
                    </Label>
                  </div>
                  <Input
                    type="number"
                    value={paymentMethods[method].amount}
                    onChange={(e) => updatePaymentDetail(method, 'amount', e.target.value)}
                    placeholder="Amount"
                    className="h-8 text-sm"
                    disabled={!paymentMethods[method].active || (isPollingMpesa && method === 'mobile')}
                  />
                  {/* Reference / Phone */}
                  {method === 'mobile' && paymentMethods[method].active && useStkPush ? (
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
                      value={paymentMethods[method].reference}
                      onChange={(e) => updatePaymentDetail(method, 'reference', e.target.value)}
                      placeholder={method === 'mobile' ? 'Ref Code' : 'Ref (optional)'}
                      className="h-8 text-sm"
                      disabled={!paymentMethods[method].active}
                    />
                  )}
                </div>

                {/* Mobile Extra Options */}
                {method === 'mobile' && paymentMethods[method].active && (
                  <div className="flex items-center justify-between pl-7 pr-1 py-1 bg-muted/40 rounded text-xs">
                    <span className="text-muted-foreground">Use M-Pesa STK Push</span>
                    <Switch
                      checked={useStkPush}
                      onCheckedChange={setUseStkPush}
                      className="scale-75"
                    />
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
                    <span>{p.reference}</span>
                    <span className="font-semibold">{sym}{p.amount.toFixed(2)}</span>
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
                completedMpesaPayments.length === 0
              )
            }
          >
            {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
