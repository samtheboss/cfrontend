import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, Banknote, CreditCard, Smartphone, FileText,
  ChevronsUpDown, Check, ArrowUpRight, ArrowDownLeft,
  Wallet, BookOpen, RotateCcw, Receipt, Printer, AlertTriangle
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PdfPreviewDialog } from '@/components/receipts/PdfPreviewDialog';
import { usePdfPreview } from '@/hooks/usePdfPreview';

interface LedgerEntry {
  id: number;
  customer: { id: number; name: string };
  type: string;
  amount: number;
  reference: string;
  notes: string;
  paymentMethod: string;
  saleId: number | null;
  linkedEntryId: number | null;
  timestamp: string;
  createdBy: number | null;
}

interface BalanceSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalDebitNotes: number;
  totalCreditNotes: number;
  totalOpeningBalance: number;
  totalPrepayments: number;
  currentBalance: number;
}

interface OutstandingInvoice {
  id: number;
  type: string;
  amount: number;
  totalApplied: number;
  remaining: number;
  reference: string;
  notes: string;
  saleId: number | null;
  timestamp: string;
  payments: LedgerEntry[];
}

interface UnmatchedCredit {
  id: number;
  type: string;
  amount: number;
  reference: string;
  notes: string;
  paymentMethod: string;
  timestamp: string;
}

interface AgingSummaryRow {
  customerId: number;
  customerName: string;
  buckets: Record<string, number>;
  total: number;
}

interface AgingDetailRow {
  id: number;
  type: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  paid: number;
  balance: number;
  daysOverdue: number;
  bucket: string;
}

const AGING_BUCKETS: { key: string; label: string }[] = [
  { key: 'current', label: 'Current / 0–7 Days' },
  { key: 'd8_21', label: '8–21 Days' },
  { key: 'd22_30', label: '22–30 Days' },
  { key: 'd31_60', label: '31–60 Days' },
  { key: 'd61_90', label: '61–90 Days' },
  { key: 'd91_120', label: '91–120 Days' },
  { key: 'd121_150', label: '121–150 Days' },
  { key: 'd151_180', label: '151–180 Days' },
  { key: 'over180', label: '>180 Days' },
];

type EntryType = 'PAYMENT' | 'DEBIT_NOTE' | 'CREDIT_NOTE' | 'OPENING_BALANCE' | 'PREPAYMENT' | 'CASH_SALE';

const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; description: string; icon: any; color: string; badgeClass: string }> = {
  PAYMENT: {
    label: 'Record Payment',
    description: 'Record a payment received from this customer',
    icon: Banknote,
    color: 'text-green-600',
    badgeClass: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20',
  },
  DEBIT_NOTE: {
    label: 'Debit Note',
    description: 'Increase amount owed (e.g. undercharges, added fees)',
    icon: ArrowUpRight,
    color: 'text-red-600',
    badgeClass: 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20',
  },
  CREDIT_NOTE: {
    label: 'Credit Note',
    description: 'Decrease amount owed (e.g. discount, refund to customer)',
    icon: ArrowDownLeft,
    color: 'text-blue-600',
    badgeClass: 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20',
  },
  OPENING_BALANCE: {
    label: 'Opening Balance',
    description: 'Set the initial outstanding balance for this customer',
    icon: BookOpen,
    color: 'text-amber-600',
    badgeClass: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20',
  },
  PREPAYMENT: {
    label: 'Prepayment',
    description: 'Record an advance payment before invoice',
    icon: Wallet,
    color: 'text-purple-600',
    badgeClass: 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/20',
  },
  CASH_SALE: {
    label: 'Cash Sale',
    description: 'Direct cash sale',
    icon: Receipt,
    color: 'text-orange-600',
    badgeClass: 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/20',
  },
};

const INVOICE_BADGE_CLASS = 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/20';

export default function CustomerAccounts() {
  const { customers } = useInventory();
  const { user, getUserRights } = useAuth();
  const rights = user ? getUserRights(user) : null;
  const can = {
    view: !rights || rights.viewCustomerAccounts !== 'no',
    ledger: !rights || rights.manageCustomerLedger !== 'no',
    pay: !rights || rights.customerReceivePayment !== 'no',
  };
  const { sym, fmt } = useCurrency();
  const pdfPreview = usePdfPreview();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);

  // Aging report
  const [activeView, setActiveView] = useState<'ledger' | 'aging'>('ledger');
  const [agingRows, setAgingRows] = useState<AgingSummaryRow[]>([]);
  const [isLoadingAging, setIsLoadingAging] = useState(false);
  const [agingDrillDown, setAgingDrillDown] = useState<{ customerId: number; customerName: string; bucketLabel: string } | null>(null);
  const [agingDrillDownRows, setAgingDrillDownRows] = useState<AgingDetailRow[]>([]);
  const [isLoadingDrillDown, setIsLoadingDrillDown] = useState(false);

  // Data
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Print statement dialog
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isPrintingStatement, setIsPrintingStatement] = useState(false);

  // Simple entry dialog (debit note, credit note, opening balance, prepayment)
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('DEBIT_NOTE');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryReference, setEntryReference] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState('CASH');
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  // Payment dialog (invoice-based)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [unmatchedCredits, setUnmatchedCredits] = useState<UnmatchedCredit[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<number, string>>({});
  const [paymentMode, setPaymentMode] = useState<'cash_payment' | 'apply_credit'>('cash_payment');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethodSingle, setPaymentMethodSingle] = useState('CASH');
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Split payment
  const [usePaymentSplit, setUsePaymentSplit] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<Record<string, { active: boolean; amount: string; reference: string }>>({
    cash: { active: false, amount: '', reference: '' },
    card: { active: false, amount: '', reference: '' },
    mobile: { active: false, amount: '', reference: '' },
    bank_transfer: { active: false, amount: '', reference: '' },
  });

  const selectedCustomer = useMemo(() =>
    customers.find(c => String(c.id) === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const selectedInvoices = useMemo(() =>
    outstandingInvoices.filter(inv => selectedInvoiceIds.includes(inv.id)),
    [outstandingInvoices, selectedInvoiceIds]
  );

  const selectedCredit = useMemo(() =>
    unmatchedCredits.find(c => c.id === selectedCreditId),
    [unmatchedCredits, selectedCreditId]
  );

  useEffect(() => {
    if (selectedCustomerId) {
      fetchLedgerData(selectedCustomerId);
    } else {
      setLedgerEntries([]);
      setBalance(null);
    }
  }, [selectedCustomerId]);

  const fetchAgingReport = async () => {
    setIsLoadingAging(true);
    try {
      const res = await apiFetch<{ data: AgingSummaryRow[] }>('/api/customer-ledger/aging');
      setAgingRows(res.data || []);
    } catch (error) {
      console.error('Failed to fetch aging report:', error);
      toast.error('Failed to load aging report');
    } finally {
      setIsLoadingAging(false);
    }
  };

  useEffect(() => {
    if (activeView === 'aging') fetchAgingReport();
  }, [activeView]);

  const openAgingDrillDown = async (customerId: number, customerName: string, bucketKey: string, bucketLabel: string) => {
    setAgingDrillDown({ customerId, customerName, bucketLabel });
    setIsLoadingDrillDown(true);
    try {
      const res = await apiFetch<{ data: AgingDetailRow[] }>(`/api/customer-ledger/${customerId}/aging`);
      setAgingDrillDownRows((res.data || []).filter(r => r.bucket === bucketKey));
    } catch (error) {
      console.error('Failed to fetch aging detail:', error);
      toast.error('Failed to load invoices');
    } finally {
      setIsLoadingDrillDown(false);
    }
  };

  const fetchLedgerData = async (customerId: string) => {
    setIsLoading(true);
    try {
      const [entriesRes, balanceRes, invoicesRes, creditsRes] = await Promise.all([
        apiFetch<{ data: LedgerEntry[] }>(`/api/customer-ledger/${customerId}`),
        apiFetch<{ data: BalanceSummary }>(`/api/customer-ledger/${customerId}/balance`),
        apiFetch<{ data: OutstandingInvoice[] }>(`/api/customer-ledger/${customerId}/outstanding-invoices`),
        apiFetch<{ data: UnmatchedCredit[] }>(`/api/customer-ledger/${customerId}/unmatched-credits`),
      ]);
      setLedgerEntries(entriesRes.data || []);
      setBalance(balanceRes.data || null);
      setOutstandingInvoices(invoicesRes.data || []);
      setUnmatchedCredits(creditsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch ledger data:', error);
      toast.error('Failed to load customer statement');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOutstandingData = async () => {
    if (!selectedCustomerId) return;
    setIsLoadingInvoices(true);
    try {
      const [invoicesRes, creditsRes] = await Promise.all([
        apiFetch<{ data: OutstandingInvoice[] }>(`/api/customer-ledger/${selectedCustomerId}/outstanding-invoices`),
        apiFetch<{ data: UnmatchedCredit[] }>(`/api/customer-ledger/${selectedCustomerId}/unmatched-credits`),
      ]);
      setOutstandingInvoices(invoicesRes.data || []);
      setUnmatchedCredits(creditsRes.data || []);
    } catch (error) {
      toast.error('Failed to load outstanding invoices');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Open the Payment dialog fresh - lets the user pick invoice(s) from within the dialog
  const openPaymentDialog = () => {
    setSelectedInvoiceIds([]);
    setInvoiceAllocations({});
    setPaymentMode('cash_payment');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentMethodSingle('CASH');
    setSelectedCreditId(null);
    setUsePaymentSplit(false);
    setPaymentSplits({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' },
      bank_transfer: { active: false, amount: '', reference: '' },
    });
    setIsPaymentDialogOpen(true);
    fetchOutstandingData();
  };

  // Invoice(s) already selected (from the Outstanding Invoices tab) - go straight to payment details
  const handleApprovePayment = () => {
    if (!can.pay) { toast.error('You are not allowed to receive customer payments'); return; }
    if (selectedInvoiceIds.length === 0) {
      toast.error('Please select at least one invoice/debit note');
      return;
    }
    setPaymentMode('cash_payment');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentMethodSingle('CASH');
    setSelectedCreditId(null);
    setUsePaymentSplit(false);
    setPaymentSplits({
      cash: { active: false, amount: '', reference: '' },
      card: { active: false, amount: '', reference: '' },
      mobile: { active: false, amount: '', reference: '' },
      bank_transfer: { active: false, amount: '', reference: '' },
    });
    setIsPaymentDialogOpen(true);
  };

  // Open simple entry dialog (for non-payment types)
  const openEntryDialog = (type: EntryType) => {
    setEntryType(type);
    setEntryAmount('');
    setEntryReference('');
    setEntryNotes('');
    setEntryPaymentMethod('CASH');
    setIsEntryDialogOpen(true);
  };

  const openStatementDialog = () => {
    setStatementStartDate('');
    setStatementEndDate(format(new Date(), 'yyyy-MM-dd'));
    setIsStatementDialogOpen(true);
  };

  const printStatement = async () => {
    if (!selectedCustomerId) return;
    setIsPrintingStatement(true);
    try {
      const params = new URLSearchParams();
      if (statementStartDate) params.set('startDate', statementStartDate);
      if (statementEndDate) params.set('endDate', statementEndDate);
      const url = `${getBaseUrl()}/api/customer-ledger/${selectedCustomerId}/statement/pdf?${params.toString()}`;
      // auto: false - a statement should always be reviewed in the popup first, never silently
      // sent straight to the receipt printer even if autoPrintReceipts is on.
      await pdfPreview.showPdf(url, { title: `Statement - ${selectedCustomer?.name || ''}`, auto: false });
      setIsStatementDialogOpen(false);
    } catch (err) {
      toast.error('Failed to generate statement');
    } finally {
      setIsPrintingStatement(false);
    }
  };

  // Submit simple entry
  const handleSubmitEntry = async () => {
    if (!can.ledger) { toast.error('You are not allowed to post ledger entries'); return; }
    if (!selectedCustomerId) return;
    const amount = parseFloat(entryAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setIsSubmittingEntry(true);
    try {
      await apiFetch('/api/customer-ledger', {
        method: 'POST',
        body: JSON.stringify({
          customer: { id: Number(selectedCustomerId) },
          type: entryType,
          amount,
          reference: entryReference || '',
          notes: entryNotes || '',
          paymentMethod: entryType === 'PREPAYMENT' ? entryPaymentMethod : null,
        }),
      });
      toast.success(`${ENTRY_TYPE_CONFIG[entryType].label} recorded successfully`);
      setIsEntryDialogOpen(false);
      fetchLedgerData(selectedCustomerId);
    } catch (error) {
      toast.error(`Failed to record ${ENTRY_TYPE_CONFIG[entryType].label.toLowerCase()}`);
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  // Submit payment against selected invoices
  const handleSubmitPayment = async () => {
    if (!can.pay) { toast.error('You are not allowed to receive customer payments'); return; }
    if (!selectedCustomerId || selectedInvoiceIds.length === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    const totalAllocated = selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0);
    if (totalAllocated <= 0) {
      toast.error('Please allocate a payment amount to the selected invoice(s)');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (paymentMode === 'apply_credit') {
        if (!selectedCreditId) {
          toast.error('Please select a credit note or prepayment to apply');
          setIsSubmittingPayment(false);
          return;
        }
        let remainingCredit = Number(selectedCredit?.amount || 0);
        if (remainingCredit <= 0.001) {
          toast.error('The selected credit note has no remaining balance.');
          setIsSubmittingPayment(false);
          return;
        }

        for (const id of selectedInvoiceIds) {
          let alloc = parseFloat(invoiceAllocations[id]) || 0;
          if (alloc <= 0) continue;
          if (alloc > remainingCredit) alloc = remainingCredit;

          if (alloc > 0.001) {
            await apiFetch('/api/customer-ledger/match', {
              method: 'POST',
              body: JSON.stringify({
                creditEntryId: selectedCreditId,
                invoiceEntryId: id,
                amountToApply: Number(alloc.toFixed(2)),
              }),
            });
            remainingCredit -= alloc;
          }
          if (remainingCredit <= 0.001) break;
        }
        toast.success('Credit applied to invoice(s) successfully');
      } else if (usePaymentSplit) {
        const activeSplits = Object.entries(paymentSplits)
          .filter(([_, m]) => m.active && (parseFloat(m.amount) || 0) > 0)
          .map(([method, m]) => ({
            method: method.toUpperCase(),
            amount: parseFloat(m.amount) || 0,
            reference: m.reference
          }));

        if (activeSplits.length === 0) {
          toast.error('Please add at least one payment with an amount');
          setIsSubmittingPayment(false);
          return;
        }

        const totalSplit = activeSplits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(totalSplit - totalAllocated) > 0.01) {
          toast.error(`Total split payment (${fmt(totalSplit)}) must match the total allocated amount (${fmt(totalAllocated)})`);
          setIsSubmittingPayment(false);
          return;
        }

        for (const id of selectedInvoiceIds) {
          const alloc = parseFloat(invoiceAllocations[id]) || 0;
          if (alloc <= 0) continue;

          for (const split of activeSplits) {
            const propAmount = (alloc / totalAllocated) * split.amount;
            if (propAmount > 0.001) {
              await apiFetch('/api/customer-ledger', {
                method: 'POST',
                body: JSON.stringify({
                  customer: { id: Number(selectedCustomerId) },
                  type: 'PAYMENT',
                  amount: parseFloat(propAmount.toFixed(2)),
                  reference: split.reference || paymentReference || '',
                  notes: paymentNotes || '',
                  paymentMethod: split.method,
                  linkedEntryId: id,
                }),
              });
            }
          }
        }
        toast.success('Split payments recorded successfully');
      } else {
        for (const id of selectedInvoiceIds) {
          const alloc = parseFloat(invoiceAllocations[id]) || 0;
          if (alloc <= 0) continue;
          await apiFetch('/api/customer-ledger', {
            method: 'POST',
            body: JSON.stringify({
              customer: { id: Number(selectedCustomerId) },
              type: 'PAYMENT',
              amount: alloc,
              reference: paymentReference || '',
              notes: paymentNotes || '',
              paymentMethod: paymentMethodSingle,
              linkedEntryId: id,
            }),
          });
        }
        toast.success('Payments recorded successfully');
      }

      setIsPaymentDialogOpen(false);
      setSelectedInvoiceIds([]);
      setInvoiceAllocations({});
      fetchLedgerData(selectedCustomerId);
    } catch (error) {
      toast.error('Failed to record payments');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try { return format(new Date(dateStr), 'dd MMM yyyy, HH:mm'); } catch { return dateStr; }
  };
  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '—';
    try { return format(new Date(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
  };

  const entriesWithRunningBalance = useMemo(() => {
    const sorted = [...ledgerEntries].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let running = 0;
    const DEBIT_TYPES = ['INVOICE', 'DEBIT_NOTE', 'OPENING_BALANCE'];
    const CREDIT_TYPES = ['PAYMENT', 'CREDIT_NOTE', 'PREPAYMENT'];
    return sorted.map(entry => {
      if (DEBIT_TYPES.includes(entry.type)) {
        running += Number(entry.amount);
      } else if (CREDIT_TYPES.includes(entry.type)) {
        running -= Number(entry.amount);
      }
      // CASH_SALE is settled in full at the point of sale - it never touches the running balance
      return { ...entry, runningBalance: running };
    }).reverse();
  }, [ledgerEntries]);

  const totalSplitAmount = useMemo(() =>
    Object.values(paymentSplits)
      .reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0),
    [paymentSplits]
  );

  if (!can.view) {
    return (
      <AppLayout title="Customer Accounts">
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-6 text-center text-sm text-amber-800 dark:text-amber-300">
            You don't have permission to use Customer Accounts. Ask an administrator for the
            "Customer Accounts: Open Window" right.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Customer Accounts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Balances, payments, and statements for credit sales
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border p-0.5 bg-muted/40 shrink-0">
              <Button variant={activeView === 'ledger' ? 'default' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setActiveView('ledger')}>
                <BookOpen className="h-3.5 w-3.5" /> Customer Ledger
              </Button>
              <Button variant={activeView === 'aging' ? 'default' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setActiveView('aging')}>
                <AlertTriangle className="h-3.5 w-3.5" /> Aging Report
              </Button>
            </div>
            {activeView === 'ledger' && (
          <div className="w-full md:w-96">
            <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={isCustomerPopoverOpen} className="w-full justify-between h-11 text-sm">
                  {selectedCustomer ? selectedCustomer.name : 'Select a customer...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search customers..." />
                  <CommandList>
                    <CommandEmpty>No customers found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map(customer => (
                        <CommandItem key={customer.id} value={customer.name} onSelect={() => { setSelectedCustomerId(String(customer.id)); setIsCustomerPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", String(customer.id) === selectedCustomerId ? "opacity-100" : "opacity-0")} />
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
            )}
          </div>
        </div>

        {activeView === 'ledger' && (
        <>
        {!selectedCustomerId && (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <Search className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Select a Customer</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a customer above to view their statement</p>
          </div>
        )}

        {selectedCustomerId && (
          <>
            {/* Balance Summary Cards */}
            {balance && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-800/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">Total Invoiced</p>
                    <p className="text-xl md:text-2xl font-bold mt-1">{fmt(Number(balance.totalInvoiced || 0))}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Total Paid</p>
                    <p className="text-xl md:text-2xl font-bold mt-1">{fmt(Number(balance.totalPaid || 0))}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Prepayments</p>
                    <p className="text-xl md:text-2xl font-bold mt-1">{fmt(Number(balance.totalPrepayments || 0))}</p>
                  </CardContent>
                </Card>
                <Card className={cn("border-2",
                  Number(balance.currentBalance || 0) > 0 ? "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10 border-red-300 dark:border-red-800/50"
                    : Number(balance.currentBalance || 0) < 0 ? "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-300 dark:border-blue-800/50"
                      : "bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-950/20 dark:to-gray-900/10 border-gray-300 dark:border-gray-800/50"
                )}>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Balance</p>
                    <p className={cn("text-xl md:text-2xl font-bold mt-1",
                      Number(balance.currentBalance || 0) > 0 ? "text-red-600" : Number(balance.currentBalance || 0) < 0 ? "text-blue-600" : ""
                    )}>{fmt(Number(balance.currentBalance || 0))}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {Number(balance.currentBalance || 0) > 0 ? 'Customer owes you' : Number(balance.currentBalance || 0) < 0 ? 'You owe the customer (overpaid)' : 'Fully settled'}
                    </p>
                    {selectedCustomer?.creditLimit != null && selectedCustomer.creditLimit > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Credit limit: {fmt(Number(selectedCustomer.creditLimit))}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Additional balance details */}
            {balance && (Number(balance.totalDebitNotes || 0) > 0 || Number(balance.totalCreditNotes || 0) > 0 || Number(balance.totalOpeningBalance || 0) > 0) && (
              <div className="flex flex-wrap gap-3 text-xs">
                {Number(balance.totalOpeningBalance || 0) > 0 && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">Opening Balance: {fmt(Number(balance.totalOpeningBalance))}</Badge>
                )}
                {Number(balance.totalDebitNotes || 0) > 0 && (
                  <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20">Debit Notes: {fmt(Number(balance.totalDebitNotes))}</Badge>
                )}
                {Number(balance.totalCreditNotes || 0) > 0 && (
                  <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20">Credit Notes: {fmt(Number(balance.totalCreditNotes))}</Badge>
                )}
              </div>
            )}

            <Tabs defaultValue="history" className="w-full space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="history">Statement / Ledger History</TabsTrigger>
                <TabsTrigger value="pending">Outstanding Invoices</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="space-y-4">
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {can.pay && (
                    <Button variant="outline" size="sm" onClick={openPaymentDialog} className="gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-green-600" /> Record Payment
                    </Button>
                  )}
                  {can.ledger && (['DEBIT_NOTE', 'CREDIT_NOTE', 'OPENING_BALANCE', 'PREPAYMENT'] as EntryType[]).map(type => {
                    const config = ENTRY_TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <Button key={type} variant="outline" size="sm" onClick={() => openEntryDialog(type)} className="gap-1.5">
                        <Icon className={cn("h-3.5 w-3.5", config.color)} /> {config.label}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={openStatementDialog} className="gap-1.5 ml-auto">
                    <Printer className="h-3.5 w-3.5" /> Print Statement
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => fetchLedgerData(selectedCustomerId)} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>

                {/* Ledger Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[110px_1fr_1fr_100px_120px] gap-1 px-4 py-2.5 text-xs font-semibold bg-muted uppercase tracking-wider text-muted-foreground border-b">
                    <span>Type</span>
                    <span>Reference / Notes</span>
                    <span>Date</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Balance</span>
                  </div>
                  <div className="divide-y max-h-[55vh] overflow-y-auto">
                    {isLoading && <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>}
                    {!isLoading && entriesWithRunningBalance.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-3" />
                        <p className="text-sm text-muted-foreground">No ledger entries yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Use the action buttons above to get started</p>
                      </div>
                    )}
                    {!isLoading && entriesWithRunningBalance.map((entry) => {
                      const isDebit = ['INVOICE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'CASH_SALE'].includes(entry.type);
                      const config = ENTRY_TYPE_CONFIG[entry.type as EntryType];
                      const badgeClass = config?.badgeClass || INVOICE_BADGE_CLASS;
                      const typeLabel = config?.label || entry.type.replace('_', ' ');
                      return (
                        <div key={entry.id} className="grid grid-cols-[110px_1fr_1fr_100px_120px] gap-1 px-4 py-2.5 text-xs items-center hover:bg-muted/30 transition-colors">
                          <div>
                            <Badge variant="outline" className={cn("text-[9px] font-semibold", badgeClass)}>
                              {entry.type === 'INVOICE' ? 'Invoice' : typeLabel}
                            </Badge>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{entry.reference || '—'}</p>
                            {entry.notes && <p className="text-[10px] text-muted-foreground truncate">{entry.notes}</p>}
                            {entry.paymentMethod && (
                              <p className="text-[10px] text-muted-foreground capitalize">{entry.paymentMethod.toLowerCase().replace('_', ' ')}</p>
                            )}
                          </div>
                          <div className="text-muted-foreground">{formatDate(entry.timestamp)}</div>
                          <div className={cn("text-right font-semibold", isDebit ? "text-red-600" : "text-green-600")}>
                            {isDebit ? '+' : '-'}{fmt(Number(entry.amount))}
                          </div>
                          <div className={cn("text-right font-bold",
                            entry.runningBalance > 0 ? "text-red-600" : entry.runningBalance < 0 ? "text-blue-600" : ""
                          )}>{fmt(entry.runningBalance)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Outstanding Invoices</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Select items and allocate payment amounts</p>
                  </div>
                  {can.pay && (
                    <Button
                      onClick={handleApprovePayment}
                      disabled={selectedInvoiceIds.length === 0}
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold h-9 text-xs"
                    >
                      <Check className="h-4 w-4" /> Receive Payment ({selectedInvoiceIds.length})
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto border rounded-lg p-1.5 bg-background">
                  {isLoadingInvoices && <div className="text-center py-8 text-sm text-muted-foreground">Loading invoices...</div>}
                  {!isLoadingInvoices && outstandingInvoices.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-3" />
                      <p className="text-sm text-muted-foreground">No outstanding invoices or debit notes</p>
                    </div>
                  )}
                  {!isLoadingInvoices && outstandingInvoices.map(inv => {
                    const isSelected = selectedInvoiceIds.includes(inv.id);
                    const toggleSelect = () => {
                      if (isSelected) {
                        setSelectedInvoiceIds(prev => prev.filter(id => id !== inv.id));
                        setInvoiceAllocations(prev => {
                          const next = { ...prev };
                          delete next[inv.id];
                          return next;
                        });
                      } else {
                        setSelectedInvoiceIds(prev => [...prev, inv.id]);
                        setInvoiceAllocations(prev => ({
                          ...prev,
                          [inv.id]: Number(inv.remaining).toFixed(2)
                        }));
                      }
                    };
                    return (
                      <div
                        key={inv.id}
                        onClick={toggleSelect}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md cursor-pointer border transition-all text-xs h-12",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-transparent hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={toggleSelect}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {inv.type === 'OPENING_BALANCE'
                                ? 'Opening Balance'
                                : inv.type === 'DEBIT_NOTE'
                                  ? `Debit Note: ${inv.reference || `#${inv.id}`}`
                                  : `Invoice: ${inv.reference || `#${inv.id}`}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatDateShort(inv.timestamp)}</p>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="flex items-center gap-2 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={invoiceAllocations[inv.id] || ''}
                              onChange={e => setInvoiceAllocations(prev => ({ ...prev, [inv.id]: e.target.value }))}
                              className="w-24 h-8 text-right font-medium text-xs bg-background"
                            />
                            <div className="text-right min-w-[50px]">
                              <p className="font-bold text-[11px]">{fmt(Number(inv.remaining))}</p>
                              <p className="text-[9px] text-muted-foreground">max</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-bold">{fmt(Number(inv.remaining))}</p>
                            <p className="text-[10px] text-muted-foreground">of {fmt(Number(inv.amount))}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedInvoiceIds.length > 0 && (
                  <div className="flex justify-between items-center px-1 text-xs font-bold border-t pt-3">
                    <span>Total Allocated:</span>
                    <span className="text-sm text-green-600">{fmt(
                      selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0)
                    )}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
        </>
        )}

        {activeView === 'aging' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={fetchAgingReport} disabled={isLoadingAging} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {isLoadingAging ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Loading aging report...</div>
                ) : agingRows.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">No outstanding customer balances.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="text-left py-2.5 px-3 sticky left-0 bg-muted/40">Customer</th>
                          {AGING_BUCKETS.map(b => (
                            <th key={b.key} className="text-right py-2.5 px-3 whitespace-nowrap">{b.label}</th>
                          ))}
                          <th className="text-right py-2.5 px-3 font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agingRows.map(row => (
                          <tr key={row.customerId} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-medium sticky left-0 bg-background">{row.customerName}</td>
                            {AGING_BUCKETS.map(b => {
                              const value = row.buckets[b.key] || 0;
                              return (
                                <td key={b.key} className="text-right py-2 px-3">
                                  {value > 0 ? (
                                    <button
                                      className="text-primary hover:underline underline-offset-2"
                                      onClick={() => openAgingDrillDown(row.customerId, row.customerName, b.key, b.label)}
                                    >
                                      {fmt(value)}
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-right py-2 px-3 font-bold">{fmt(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Payment Dialog (Invoice-based) */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" /> Receive Payment
            </DialogTitle>
            <DialogDescription>
              Select an invoice to receive payment against — <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {selectedInvoiceIds.length > 0 ? (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/20 text-xs">
                <Label className="text-xs font-semibold">Invoices / Debit Notes to Pay</Label>
                <div className="space-y-1 divide-y divide-muted/30">
                  {selectedInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center py-1.5">
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground">
                          {inv.type === 'OPENING_BALANCE'
                            ? 'Opening Balance'
                            : inv.type === 'DEBIT_NOTE'
                              ? `Debit Note: ${inv.reference || `#${inv.id}`}`
                              : `Invoice: ${inv.reference || `#${inv.id}`}`}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{formatDateShort(inv.timestamp)}</p>
                      </div>
                      <span className="font-bold text-foreground">{fmt(Number(invoiceAllocations[inv.id] || 0))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 font-bold text-sm text-foreground">
                    <span>Total Payment:</span>
                    <span className="text-green-600">{fmt(
                      selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0)
                    )}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Invoice(s)</Label>
                {isLoadingInvoices && <div className="text-center py-4 text-sm text-muted-foreground">Loading invoices...</div>}
                {!isLoadingInvoices && outstandingInvoices.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">No outstanding invoices</p>
                  </div>
                )}
                {!isLoadingInvoices && outstandingInvoices.length > 0 && (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto border rounded-lg p-1.5">
                    {outstandingInvoices.map(inv => {
                      const isSelected = selectedInvoiceIds.includes(inv.id);
                      const toggleSelect = () => {
                        if (isSelected) {
                          setSelectedInvoiceIds(prev => prev.filter(id => id !== inv.id));
                          setInvoiceAllocations(prev => {
                            const next = { ...prev };
                            delete next[inv.id];
                            return next;
                          });
                        } else {
                          setSelectedInvoiceIds(prev => [...prev, inv.id]);
                          setInvoiceAllocations(prev => ({
                            ...prev,
                            [inv.id]: Number(inv.remaining).toFixed(2)
                          }));
                        }
                      };
                      return (
                        <div
                          key={inv.id}
                          onClick={toggleSelect}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md cursor-pointer border transition-all text-xs h-12",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="pointer-events-none">
                              <Checkbox checked={isSelected} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {inv.type === 'OPENING_BALANCE'
                                  ? 'Opening Balance'
                                  : inv.type === 'DEBIT_NOTE'
                                    ? `Debit Note: ${inv.reference || `#${inv.id}`}`
                                    : `Invoice: ${inv.reference || `#${inv.id}`}`}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{formatDateShort(inv.timestamp)}</p>
                            </div>
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-2 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={invoiceAllocations[inv.id] || ''}
                                onChange={e => setInvoiceAllocations(prev => ({ ...prev, [inv.id]: e.target.value }))}
                                className="w-24 h-8 text-right font-medium text-xs"
                              />
                              <div className="text-right min-w-[50px]">
                                <p className="font-bold text-[11px]">{fmt(Number(inv.remaining))}</p>
                                <p className="text-[9px] text-muted-foreground">max</p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-right shrink-0 ml-2">
                              <p className="font-bold">{fmt(Number(inv.remaining))}</p>
                              <p className="text-[10px] text-muted-foreground">of {fmt(Number(inv.amount))}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedInvoiceIds.length > 0 && (
              <>
                <div className="flex justify-between items-center px-1 text-xs font-bold border-b pb-2">
                  <span>Total Allocated:</span>
                  <span className="text-sm text-green-600">{fmt(
                    selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0)
                  )}</span>
                </div>

                <div className="flex items-center gap-4 border-b pb-2 pt-1">
                  <Label className="text-xs font-semibold shrink-0">Receive via:</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button" size="sm" variant={paymentMode === 'cash_payment' ? 'default' : 'outline'}
                      className="text-xs gap-1" onClick={() => setPaymentMode('cash_payment')}
                    >
                      <Banknote className="h-3.5 w-3.5" /> Cash / Card / Bank
                    </Button>
                    {unmatchedCredits.length > 0 && (
                      <Button
                        type="button" size="sm" variant={paymentMode === 'apply_credit' ? 'default' : 'outline'}
                        className="text-xs gap-1" onClick={() => setPaymentMode('apply_credit')}
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5" /> Apply Credit / Prepayment
                      </Button>
                    )}
                  </div>
                </div>

                {paymentMode === 'cash_payment' && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="use-split-pay" checked={usePaymentSplit} onCheckedChange={(c) => setUsePaymentSplit(c === true)} />
                      <Label htmlFor="use-split-pay" className="text-xs cursor-pointer">Split payment across multiple methods</Label>
                    </div>

                    {!usePaymentSplit && (
                      <>
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold">Payment Method</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'CASH', label: 'Cash', icon: Banknote },
                              { value: 'CARD', label: 'Card', icon: CreditCard },
                              { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
                              { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: FileText },
                            ].map(m => (
                              <Button key={m.value} type="button" variant={paymentMethodSingle === m.value ? 'default' : 'outline'} size="sm" className="justify-start gap-1.5 text-xs" onClick={() => setPaymentMethodSingle(m.value)}>
                                <m.icon className="h-3.5 w-3.5" /> {m.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold">Reference (optional)</Label>
                          <Input placeholder="e.g. CHQ-001, REF-123" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-9 text-sm" />
                        </div>
                      </>
                    )}

                    {usePaymentSplit && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs font-medium border-b pb-2">
                          <div>
                            <span className="text-muted-foreground">Allocated:</span>{" "}
                            <span className="font-bold text-sm">{fmt(
                              selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0)
                            )}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Receiving Now:</span>{" "}
                            <span className="font-bold text-sm text-green-600">{fmt(totalSplitAmount)}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(['cash', 'card', 'mobile', 'bank_transfer'] as const).map(method => {
                            const handleToggle = (active: boolean) => {
                              setPaymentSplits(prev => {
                                const newState = { ...prev };
                                if (active) {
                                  const currentPaid = Object.values(prev).reduce((sum, m) => m.active ? sum + (parseFloat(m.amount) || 0) : sum, 0);
                                  const totalAlloc = selectedInvoiceIds.reduce((sum, id) => sum + (parseFloat(invoiceAllocations[id]) || 0), 0);
                                  const rem = Math.max(0, totalAlloc - currentPaid);
                                  newState[method] = { ...prev[method], active: true, amount: rem > 0 ? rem.toFixed(2) : '' };
                                } else {
                                  newState[method] = { ...prev[method], active: false, amount: '', reference: '' };
                                }
                                return newState;
                              });
                            };
                            return (
                              <div key={method} className="space-y-2 border rounded p-2.5 bg-muted/20">
                                <div className="flex items-center space-x-2">
                                  <Checkbox id={`split-pay-${method}`} checked={paymentSplits[method]?.active} onCheckedChange={c => handleToggle(c === true)} />
                                  <Label htmlFor={`split-pay-${method}`} className="capitalize flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                                    {method === 'cash' && <Banknote className="h-3.5 w-3.5 text-muted-foreground" />}
                                    {method === 'card' && <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
                                    {method === 'mobile' && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                                    {method === 'bank_transfer' && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                                    {method.replace('_', ' ')}
                                  </Label>
                                </div>
                                {paymentSplits[method]?.active && (
                                  <div className="grid grid-cols-1 gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                                    <Input type="number" placeholder="Amount" value={paymentSplits[method].amount} onChange={e => setPaymentSplits(prev => ({ ...prev, [method]: { ...prev[method], amount: e.target.value } }))} className="h-9 text-sm" />
                                    <Input type="text" placeholder="Ref # (optional)" value={paymentSplits[method].reference} onChange={e => setPaymentSplits(prev => ({ ...prev, [method]: { ...prev[method], reference: e.target.value } }))} className="h-9 text-sm" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMode === 'apply_credit' && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold">Select Credit Note / Prepayment to Apply</Label>
                    {unmatchedCredits.length === 0 && (
                      <div className="text-center py-4 border-2 border-dashed rounded-lg">
                        <p className="text-sm text-muted-foreground">No unmatched credits available</p>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto border rounded-lg p-1.5">
                      {unmatchedCredits.map(credit => (
                        <div
                          key={credit.id}
                          onClick={() => setSelectedCreditId(credit.id)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-md cursor-pointer border transition-all text-xs",
                            selectedCreditId === credit.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                              selectedCreditId === credit.id ? "border-primary" : "border-muted-foreground/30"
                            )}>
                              {selectedCreditId === credit.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <div className="min-w-0">
                              <Badge variant="outline" className={cn("text-[9px] font-semibold",
                                credit.type === 'CREDIT_NOTE' ? ENTRY_TYPE_CONFIG.CREDIT_NOTE.badgeClass : ENTRY_TYPE_CONFIG.PREPAYMENT.badgeClass
                              )}>
                                {credit.type === 'CREDIT_NOTE' ? 'Credit Note' : 'Prepayment'}
                              </Badge>
                              <p className="font-medium truncate mt-0.5">{credit.reference || `#${credit.id}`}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDateShort(credit.timestamp)}</p>
                            </div>
                          </div>
                          <p className="font-bold shrink-0 ml-2">{fmt(Number(credit.amount))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold">Notes (optional)</Label>
                  <Textarea placeholder="Additional details..." value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="text-sm min-h-[50px]" />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 mt-2 border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitPayment} disabled={isSubmittingPayment || selectedInvoiceIds.length === 0}>
              {isSubmittingPayment ? 'Recording...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple Entry Dialog (Debit Note, Credit Note, Opening Balance, Prepayment) */}
      <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => { const c = ENTRY_TYPE_CONFIG[entryType]; const I = c.icon; return <><I className={cn("h-5 w-5", c.color)} /> {c.label}</>; })()}
            </DialogTitle>
            <DialogDescription>
              {ENTRY_TYPE_CONFIG[entryType].description} — <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Amount</Label>
              <Input type="number" placeholder="0.00" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} className="h-10 text-base" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Reference Number</Label>
              <Input placeholder="e.g. DN-001, CN-002" value={entryReference} onChange={e => setEntryReference(e.target.value)} className="h-9 text-sm" />
            </div>
            {entryType === 'PREPAYMENT' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CASH', label: 'Cash', icon: Banknote },
                    { value: 'CARD', label: 'Card', icon: CreditCard },
                    { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
                    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: FileText },
                  ].map(m => (
                    <Button key={m.value} type="button" variant={entryPaymentMethod === m.value ? 'default' : 'outline'} size="sm" className="justify-start gap-1.5 text-xs" onClick={() => setEntryPaymentMethod(m.value)}>
                      <m.icon className="h-3.5 w-3.5" /> {m.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Notes (optional)</Label>
              <Textarea placeholder="Additional details..." value={entryNotes} onChange={e => setEntryNotes(e.target.value)} className="text-sm min-h-[60px]" />
            </div>
          </div>

          <DialogFooter className="mt-2 border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEntryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitEntry} disabled={isSubmittingEntry}>
              {isSubmittingEntry ? 'Recording...' : `Record ${ENTRY_TYPE_CONFIG[entryType].label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Statement Dialog */}
      <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" /> Print Statement
            </DialogTitle>
            <DialogDescription>
              Generate a statement for <span className="font-semibold text-foreground">{selectedCustomer?.name}</span> — the balance
              before the start date is carried forward as the opening balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">Start Date</Label>
                <Input type="date" value={statementStartDate} onChange={e => setStatementStartDate(e.target.value)} className="h-9 text-sm" />
                <p className="text-[10px] text-muted-foreground">Leave blank to start from account opening</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-semibold">End Date</Label>
                <Input type="date" value={statementEndDate} onChange={e => setStatementEndDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsStatementDialogOpen(false)}>Cancel</Button>
            <Button onClick={printStatement} disabled={isPrintingStatement} className="gap-1.5">
              <Printer className="h-4 w-4" /> {isPrintingStatement ? 'Generating...' : 'Print Statement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared PDF preview/print popup - used for the statement here */}
      <PdfPreviewDialog
        open={pdfPreview.open}
        onOpenChange={pdfPreview.setOpen}
        url={pdfPreview.url}
        title={pdfPreview.title}
        iframeRef={pdfPreview.iframeRef}
        onPrint={pdfPreview.handlePrint}
      />

      {/* Aging Drill-Down Dialog */}
      <Dialog open={!!agingDrillDown} onOpenChange={(open) => { if (!open) setAgingDrillDown(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {agingDrillDown?.customerName} — {agingDrillDown?.bucketLabel}
            </DialogTitle>
            <DialogDescription>Invoices making up this outstanding balance</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {isLoadingDrillDown ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading invoices...</div>
            ) : agingDrillDownRows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No invoices found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                    <th className="text-left py-2 px-3">Invoice No</th>
                    <th className="text-left py-2 px-3">Invoice Date</th>
                    <th className="text-left py-2 px-3">Due Date</th>
                    <th className="text-right py-2 px-3">Invoice Amount</th>
                    <th className="text-right py-2 px-3">Paid</th>
                    <th className="text-right py-2 px-3">Balance</th>
                    <th className="text-right py-2 px-3">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {agingDrillDownRows.map(row => (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3 font-medium">{row.invoiceNumber || `#${row.id}`}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatDateShort(row.invoiceDate)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatDateShort(row.dueDate)}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.invoiceAmount)}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.paid)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt(row.balance)}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant="outline" className={cn(row.daysOverdue > 30 ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20' : 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20')}>
                          {row.daysOverdue}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-bold">
                    <td colSpan={5} className="py-2 px-3 text-right">Total:</td>
                    <td className="py-2 px-3 text-right">{fmt(agingDrillDownRows.reduce((sum, r) => sum + r.balance, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setAgingDrillDown(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
