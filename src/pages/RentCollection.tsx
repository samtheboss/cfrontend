import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Property, PropertyUnit, PropertyLease, PropertyRentInvoice, PropertyRentPayment } from '@/types/inventory';
import { PaymentDialog, PaymentDetails } from '@/components/payments/PaymentDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  User,
  CreditCard,
  Printer,
  TrendingUp,
  AlertCircle,
  FileCheck,
  CheckCircle,
  ChevronsUpDown,
  Check,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function RentCollection() {
  const { customers } = useInventory();
  const { user } = useAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [leases, setLeases] = useState<PropertyLease[]>([]);
  const [invoices, setInvoices] = useState<PropertyRentInvoice[]>([]);
  const [payments, setPayments] = useState<PropertyRentPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isBillingRunOpen, setIsBillingRunOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PropertyRentInvoice | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<any>(null);

  // Statement states
  const [activeTab, setActiveTab] = useState<'collections' | 'statements'>('collections');
  const [statementTenantId, setStatementTenantId] = useState<string>('');
  const [isTenantPopoverOpen, setIsTenantPopoverOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  // Form states
  const [billingForm, setBillingForm] = useState({
    billingPeriod: '',
    dueDate: '',
  });

  const [inlinePayForm, setInlinePayForm] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const propRes = await apiFetch<{ data: Property[] }>('/api/pms/properties');
      const unitRes = await apiFetch<{ data: PropertyUnit[] }>('/api/pms/units');
      const leaseRes = await apiFetch<{ data: PropertyLease[] }>('/api/pms/leases');
      const invRes = await apiFetch<{ data: PropertyRentInvoice[] }>('/api/pms/invoices');
      const payRes = await apiFetch<{ data: PropertyRentPayment[] }>('/api/pms/payments');
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setLeases(leaseRes.data || []);
      setInvoices(invRes.data || []);
      setPayments(payRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Billing Run
  const handleBillingRun = async () => {
    if (!billingForm.billingPeriod || !billingForm.dueDate) {
      toast.error('Please specify billing period and due date');
      return;
    }

    try {
      await apiFetch(
        `/api/pms/invoices/run-billing?billingPeriod=${encodeURIComponent(
          billingForm.billingPeriod
        )}&dueDate=${billingForm.dueDate}`,
        { method: 'POST' }
      );
      toast.success('Billing run completed successfully');
      setIsBillingRunOpen(false);
      setBillingForm({ billingPeriod: '', dueDate: '' });
      fetchData();
    } catch (err: any) {
      toast.error('Billing run failed: ' + err.message);
    }
  };

  // Handle Record Payments via PaymentDialog
  const handleRecordPayments = async (paymentsList: PaymentDetails[]) => {
    if (!selectedInvoice) return;

    try {
      let lastPaymentRes: any = null;
      let totalAmountPaid = 0;

      for (const p of paymentsList) {
        if (p.amount <= 0) continue;

        let method = p.method.toUpperCase();
        if (method === 'MOBILE') method = 'MOBILE_MONEY';

        const payload = {
          invoiceId: selectedInvoice.id,
          amount: p.amount,
          paymentMethod: method,
          referenceNumber: p.reference || '',
          notes: 'Rent Payment via Payment Dialog',
          createdBy: user?.name || user?.username || 'System',
          glAccountId: p.glAccountId,
        };

        const res = await apiFetch<{ data: PropertyRentPayment }>('/api/pms/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        lastPaymentRes = res.data;
        totalAmountPaid += p.amount;
      }

      toast.success('Payments recorded successfully');

      if (lastPaymentRes) {
        setReceiptToPrint({
          ...lastPaymentRes,
          amount: totalAmountPaid,
          invoiceNumber: selectedInvoice.invoiceNumber,
          tenantName: getTenantName(getLease(selectedInvoice.leaseId)?.tenantId),
          unitName: getUnitName(getLease(selectedInvoice.leaseId)?.unitId),
        });
      }

      setIsRecordPaymentOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to record payments: ' + err.message);
    }
  };

  const handleInlinePaymentSubmit = async () => {
    if (!inlinePayForm.invoiceId || !inlinePayForm.amount) return;
    try {
      const payload = {
        invoiceId: parseInt(inlinePayForm.invoiceId),
        amount: parseFloat(inlinePayForm.amount),
        paymentMethod: inlinePayForm.paymentMethod,
        referenceNumber: inlinePayForm.referenceNumber || '',
        notes: 'Direct ledger payment',
        createdBy: user?.name || user?.username || 'System',
      };
      await apiFetch('/api/pms/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Payment recorded successfully!');
      setInlinePayForm({
        invoiceId: '',
        amount: '',
        paymentMethod: 'CASH',
        referenceNumber: '',
      });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save payment: ' + err.message);
    }
  };

  // Helpers
  const getLease = (leaseId: number) => {
    return leases.find((l) => l.id === leaseId);
  };

  const getTenantName = (tenantId?: number) => {
    if (!tenantId) return 'N/A';
    const c = customers.find((cust) => cust.id === tenantId.toString() || cust.id === tenantId);
    return c ? c.name : `Tenant #${tenantId}`;
  };

  const getTenantPhone = (leaseId?: number) => {
    if (!leaseId) return '';
    const lease = getLease(leaseId);
    if (!lease) return '';
    const cust = customers.find(c => c.id === lease.tenantId.toString() || c.id === lease.tenantId);
    return cust ? cust.phone || '' : '';
  };

  const getUnitName = (unitId?: number) => {
    if (!unitId) return 'N/A';
    const u = units.find((unit) => unit.id === unitId);
    if (!u) return `Unit #${unitId}`;
    const p = properties.find((prop) => prop.id === u.propertyId);
    return p ? `${p.name} - Unit ${u.unitNumber}` : `Unit ${u.unitNumber}`;
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Partial</Badge>;
      case 'UNPAID':
        return <Badge variant="destructive">Unpaid</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const printReceipt = () => {
    const printContent = document.getElementById('receipt-print-area')?.innerHTML;
    if (!printContent) return;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = 'Print' + uniqueName;
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            body { font-family: monospace; padding: 20px; text-align: center; }
            .receipt-header { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .receipt-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
            .receipt-footer { border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; font-size: 12px; }
            h2 { margin: 0 0 5px 0; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const lease = getLease(inv.leaseId);
    const tenantName = getTenantName(lease?.tenantId).toLowerCase();
    const unitName = getUnitName(lease?.unitId).toLowerCase();
    const invNo = inv.invoiceNumber.toLowerCase();
    const billingPeriod = inv.billingPeriod.toLowerCase();
    const q = searchQuery.toLowerCase();
    return tenantName.includes(q) || unitName.includes(q) || invNo.includes(q) || billingPeriod.includes(q);
  });

  return (
    <AppLayout title="Rent Collection">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('collections')}
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-all ${activeTab === 'collections'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            Invoices & Collections
          </button>
          <button
            onClick={() => setActiveTab('statements')}
            className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition-all ${activeTab === 'statements'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            Client Ledger & Statements
          </button>
        </div>

        {activeTab === 'collections' ? (
          <>
            <div className="flex items-center justify-between">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices by tenant, unit, invoice #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button onClick={() => setIsBillingRunOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Run Billing
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Invoices & Collections</CardTitle>
                <CardDescription>
                  Process monthly rent charges and record tenant payments.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount Due</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => {
                      const lease = getLease(inv.leaseId);
                      const tenantId = lease?.tenantId;
                      const unitId = lease?.unitId;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                          <TableCell className="font-medium">{getTenantName(tenantId)}</TableCell>
                          <TableCell>{getUnitName(unitId)}</TableCell>
                          <TableCell>{inv.billingPeriod}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="font-semibold">KES {inv.amountDue.toLocaleString()}</TableCell>
                          <TableCell className="text-emerald-600 font-semibold">
                            KES {inv.amountPaid.toLocaleString()}
                          </TableCell>
                          <TableCell className={`font-semibold ${inv.amountDue - inv.amountPaid > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            KES {(inv.amountDue - inv.amountPaid).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.createdAt ? format(new Date(inv.createdAt), 'dd MMM yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                            {inv.createdBy || 'System'}
                          </TableCell>
                          <TableCell>{getInvoiceStatusBadge(inv.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {inv.status !== 'PAID' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setIsRecordPaymentOpen(true);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-700"
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                          No invoices found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Client Statement Card rendered inline */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-650" />
                Client Ledger & Statements
              </CardTitle>
              <CardDescription>
                Select a tenant client to view their complete billing history, invoice logs, and payment records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5 max-w-sm">
                <Label htmlFor="statementTenant">Select Tenant *</Label>
                <Popover open={isTenantPopoverOpen} onOpenChange={setIsTenantPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="statementTenant"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isTenantPopoverOpen}
                      className="w-full justify-between"
                    >
                      {statementTenantId
                        ? customers.find(c => c.id.toString() === statementTenantId || c.id === parseInt(statementTenantId))?.name
                        : 'Choose a client...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search tenants..." />
                      <CommandList>
                        <CommandEmpty>No tenants found.</CommandEmpty>
                        <CommandGroup>
                          {customers
                            .filter(c => c.customerType === 'TENANT' || c.customerType === 'BOTH')
                            .map(t => (
                              <CommandItem
                                key={t.id}
                                value={t.name.toLowerCase()}
                                onSelect={() => {
                                  setStatementTenantId(t.id.toString());
                                  setIsTenantPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    t.id.toString() === statementTenantId ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div>
                                  <p className="font-medium text-sm">{t.name}</p>
                                  {t.phone && <p className="text-xs text-muted-foreground">{t.phone}</p>}
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {statementTenantId ? (() => {
                const tenant = customers.find(c => c.id.toString() === statementTenantId || c.id === parseInt(statementTenantId));
                if (!tenant) return null;

                const tenantLeases = leases.filter(l => l.tenantId.toString() === statementTenantId || l.tenantId === parseInt(statementTenantId));
                const tenantLeaseIds = tenantLeases.map(l => l.id);
                const tenantInvoices = invoices.filter(inv => tenantLeaseIds.includes(inv.leaseId));
                const tenantPayments = payments.filter(pay => tenantInvoices.map(inv => inv.id).includes(pay.invoiceId));

                const totalInvoiced = tenantInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
                const totalPaid = totalInvoiced ? tenantInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0) : 0;
                const balance = totalInvoiced - totalPaid;
                const unpaidInvoices = tenantInvoices.filter(inv => inv.status !== 'PAID');

                return (
                  <div className="space-y-6">
                    {/* Tenant Profile Mini-card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border">
                      <div>
                        <span className="text-muted-foreground text-xs block font-semibold uppercase tracking-wider">Tenant Profile</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-lg mt-0.5">{tenant.name}</span>
                        <span className="text-xs text-muted-foreground block">{tenant.email || 'No email registered'}</span>
                        <span className="text-xs text-muted-foreground block">{tenant.phone || 'No phone registered'}</span>
                      </div>
                      <div className="md:border-l md:pl-4 space-y-1">
                        <span className="text-muted-foreground text-xs block font-semibold uppercase tracking-wider">Active Leases</span>
                        {tenantLeases.length === 0 ? (
                          <span className="text-xs text-amber-500 font-semibold block">No active lease agreement</span>
                        ) : (
                          tenantLeases.map(l => (
                            <div key={l.id} className="flex items-center justify-between py-1 border-b last:border-0">
                              <span className="text-xs font-mono font-semibold text-indigo-650 dark:text-indigo-400">
                                {l.leaseNumber} ({getUnitName(l.unitId)})
                              </span>
                              {l.status === 'ACTIVE' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={async () => {
                                    try {
                                      await apiFetch(`/api/pms/leases/${l.id}/generate-invoice`, { method: 'POST' });
                                      toast.success('Invoice generated successfully!');
                                      fetchData();
                                    } catch (err: any) {
                                      toast.error('Failed to generate invoice: ' + err.message);
                                    }
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Create Invoice
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="md:border-l md:pl-4">
                        <span className="text-muted-foreground text-xs block font-semibold uppercase tracking-wider">Financial Summary</span>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-center">
                            <span className="text-[10px] text-muted-foreground block">Invoiced</span>
                            <span className="font-bold text-xs">KES {totalInvoiced.toLocaleString()}</span>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-center">
                            <span className="text-[10px] text-muted-foreground block">Balance</span>
                            <span className={`font-bold text-xs ${balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                              KES {balance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Invoices List */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            Invoice Log ({tenantInvoices.length})
                          </h4>
                          {tenantLeases.filter(l => l.status === 'ACTIVE').length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={async () => {
                                const activeLease = tenantLeases.find(l => l.status === 'ACTIVE');
                                if (!activeLease) return;
                                try {
                                  await apiFetch(`/api/pms/leases/${activeLease.id}/generate-invoice`, { method: 'POST' });
                                  toast.success('Invoice generated successfully!');
                                  fetchData();
                                } catch (err: any) {
                                  toast.error('Failed to generate invoice: ' + err.message);
                                }
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Create Invoice
                            </Button>
                          )}
                        </div>
                        <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2 text-xs">Invoice #</TableHead>
                                <TableHead className="py-2 text-xs">Period</TableHead>
                                <TableHead className="py-2 text-xs text-right">Due</TableHead>
                                <TableHead className="py-2 text-xs text-right">Paid</TableHead>
                                <TableHead className="py-2 text-xs text-right">Balance</TableHead>
                                <TableHead className="py-2 text-xs text-right font-medium">Status</TableHead>
                                <TableHead className="py-2 text-xs text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tenantInvoices.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-4 text-xs text-muted-foreground">
                                    No invoices generated.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                tenantInvoices.map(inv => (
                                  <TableRow key={inv.id}>
                                    <TableCell className="font-mono text-xs py-2">{inv.invoiceNumber}</TableCell>
                                    <TableCell className="text-xs py-2">{inv.billingPeriod}</TableCell>
                                    <TableCell className="text-xs text-right py-2 font-semibold">KES {inv.amountDue.toLocaleString()}</TableCell>
                                    <TableCell className="text-xs text-right py-2 text-emerald-600 font-semibold">KES {inv.amountPaid.toLocaleString()}</TableCell>
                                    <TableCell className={`text-xs text-right py-2 font-semibold ${inv.amountDue - inv.amountPaid > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                      KES {(inv.amountDue - inv.amountPaid).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right py-2">{getInvoiceStatusBadge(inv.status)}</TableCell>
                                    <TableCell className="text-right py-2">
                                      {inv.status !== 'PAID' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-indigo-650 hover:text-indigo-700"
                                          onClick={() => {
                                            setSelectedInvoice(inv);
                                            setIsRecordPaymentOpen(true);
                                          }}
                                          title="Record Payment"
                                        >
                                          <CreditCard className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Payments List */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 border-b pb-2 flex justify-between">
                          <span>Payment Records ({tenantPayments.length})</span>
                          <span className="text-xs font-normal text-muted-foreground">Total Paid: KES {totalPaid.toLocaleString()}</span>
                        </h4>
                        <div className="max-h-[480px] overflow-y-auto border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="py-2 text-xs">Receipt #</TableHead>
                                <TableHead className="py-2 text-xs">Method</TableHead>
                                <TableHead className="py-2 text-xs">Reference</TableHead>
                                <TableHead className="py-2 text-xs text-right">Amount Paid</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tenantPayments.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-4 text-xs text-muted-foreground">
                                    No payments recorded.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                tenantPayments.map(p => (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-mono text-xs py-2">{p.receiptNumber}</TableCell>
                                    <TableCell className="text-xs py-2 capitalize">{p.paymentMethod.replace('_', ' ').toLowerCase()}</TableCell>
                                    <TableCell className="text-xs py-2 font-mono">{p.referenceNumber || '—'}</TableCell>
                                    <TableCell className="text-xs text-right py-2 font-bold text-emerald-600">KES {p.amount.toLocaleString()}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                      </div>
                    </div>
                    </div>

                    {/* Direct/Inline Payment Section */}
                    {unpaidInvoices.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-5 mt-6 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <CreditCard className="h-5 w-5 text-indigo-600" />
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                            Quick Payment Processor (Direct Inline Payment)
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor="inlineInvoiceSelect" className="text-xs font-semibold">Select Invoice to Pay</Label>
                            <Select
                              value={inlinePayForm.invoiceId}
                              onValueChange={(val) => {
                                const inv = tenantInvoices.find(i => i.id.toString() === val);
                                if (inv) {
                                  setInlinePayForm({
                                    invoiceId: val,
                                    amount: String(inv.amountDue - inv.amountPaid),
                                    paymentMethod: 'CASH',
                                    referenceNumber: '',
                                  });
                                }
                              }}
                            >
                              <SelectTrigger id="inlineInvoiceSelect" className="bg-white dark:bg-slate-950 h-9 text-xs">
                                <SelectValue placeholder="Choose unpaid invoice..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unpaidInvoices.map(inv => (
                                  <SelectItem key={inv.id} value={inv.id.toString()}>
                                    {inv.invoiceNumber} ({inv.billingPeriod}) - Bal: KES {(inv.amountDue - inv.amountPaid).toLocaleString()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="inlineAmount" className="text-xs font-semibold">Payment Amount *</Label>
                            <Input
                              id="inlineAmount"
                              type="number"
                              value={inlinePayForm.amount}
                              onChange={(e) => setInlinePayForm(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="Amount"
                              className="bg-white dark:bg-slate-950 h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="inlineMethod" className="text-xs font-semibold">Payment Method</Label>
                            <Select
                              value={inlinePayForm.paymentMethod}
                              onValueChange={(val) => setInlinePayForm(prev => ({ ...prev, paymentMethod: val }))}
                            >
                              <SelectTrigger id="inlineMethod" className="bg-white dark:bg-slate-950 h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CASH">Cash</SelectItem>
                                <SelectItem value="CARD">Card</SelectItem>
                                <SelectItem value="MOBILE_MONEY">Mobile Money (M-Pesa)</SelectItem>
                                <SelectItem value="BANK">Bank Transfer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="inlineRef" className="text-xs font-semibold">Ref / Code (Optional)</Label>
                            <div className="flex gap-2">
                              <Input
                                id="inlineRef"
                                value={inlinePayForm.referenceNumber}
                                onChange={(e) => setInlinePayForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                                placeholder="Ref Number"
                                className="bg-white dark:bg-slate-950 h-9 text-xs"
                              />
                              <Button 
                                onClick={handleInlinePaymentSubmit}
                                size="sm"
                                className="h-9 px-4 text-xs font-semibold"
                                disabled={!inlinePayForm.invoiceId || !inlinePayForm.amount || parseFloat(inlinePayForm.amount) <= 0 || loading}
                              >
                                {loading ? 'Saving...' : 'Submit'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-950">
                  <User className="h-10 w-10 text-muted-foreground mb-2 stroke-1" />
                  <p className="text-sm text-muted-foreground">Choose a client from the dropdown list above to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Run Billing Dialog */}
        <Dialog open={isBillingRunOpen} onOpenChange={setIsBillingRunOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Run Monthly Billing</DialogTitle>
              <DialogDescription>
                Generate invoices for all ACTIVE leases for a specific period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="billPeriod">Billing Period / Month *</Label>
                <Input
                  id="billPeriod"
                  value={billingForm.billingPeriod}
                  onChange={(e) =>
                    setBillingForm((prev) => ({ ...prev, billingPeriod: e.target.value }))
                  }
                  placeholder="E.g., August 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billDueDate">Due Date *</Label>
                <Input
                  id="billDueDate"
                  type="date"
                  value={billingForm.dueDate}
                  onChange={(e) =>
                    setBillingForm((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBillingRunOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBillingRun}>Generate Invoices</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        {selectedInvoice && (
          <PaymentDialog
            open={isRecordPaymentOpen}
            onOpenChange={setIsRecordPaymentOpen}
            title={`Record Payment for ${selectedInvoice.invoiceNumber}`}
            subtitle={`Invoice Amount: KES ${selectedInvoice.amountDue.toLocaleString()} (Paid: KES ${selectedInvoice.amountPaid.toLocaleString()})`}
            totalDue={selectedInvoice.amountDue - selectedInvoice.amountPaid}
            defaultPhone={getTenantPhone(selectedInvoice.leaseId)}
            onConfirm={handleRecordPayments}
            allowPartialPayment={true}
          />
        )}

        {/* Print Receipt Dialog */}
        <Dialog open={receiptToPrint !== null} onOpenChange={() => setReceiptToPrint(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Receipt Recorded</DialogTitle>
              <DialogDescription>Your payment was logged. Print receipt below.</DialogDescription>
            </DialogHeader>
            {receiptToPrint && (
              <div className="py-4">
                <div
                  id="receipt-print-area"
                  className="p-4 bg-slate-50 dark:bg-slate-900 border border-dashed rounded font-mono text-sm leading-tight text-slate-800 dark:text-slate-200"
                >
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-base">RENT RECEIPT</h3>
                    <p className="text-xs text-muted-foreground">Smart Properties Ltd</p>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between">
                      <span>Receipt:</span>
                      <span className="font-semibold">{receiptToPrint.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invoice:</span>
                      <span>{receiptToPrint.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{format(new Date(), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div className="border-t border-b border-dashed py-2 space-y-1.5 mb-4">
                    <div className="flex justify-between">
                      <span>Tenant:</span>
                      <span className="font-semibold truncate max-w-[150px]">{receiptToPrint.tenantName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unit:</span>
                      <span>{receiptToPrint.unitName}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-4 text-right">
                    <div className="flex justify-between font-bold text-base">
                      <span>Paid Amount:</span>
                      <span>KES {receiptToPrint.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Method:</span>
                      <span>{receiptToPrint.paymentMethod}</span>
                    </div>
                    {receiptToPrint.referenceNumber && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Ref No:</span>
                        <span>{receiptToPrint.referenceNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-xs border-t border-dashed pt-3 text-muted-foreground">
                    Thank you for your payment!
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setReceiptToPrint(null)}>
                    Dismiss
                  </Button>
                  <Button onClick={printReceipt}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
