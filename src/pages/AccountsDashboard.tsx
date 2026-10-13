import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, RotateCcw, Printer, Download, Banknote,
  ArrowUpRight, ArrowDownLeft, FileText, Users, Truck,
  ChevronDown, Filter, SortAsc, SortDesc, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getBaseUrl } from '@/lib/api';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import { PdfPreviewDialog } from '@/components/receipts/PdfPreviewDialog';
import { usePdfPreview } from '@/hooks/usePdfPreview';

interface DashboardRow {
  id: number;
  ledgerNumber: string;
  ledgerName: string;
  opening: number;
  debit: number;
  credit: number;
  unallocated: number;
  closing: number;
}

type SortField = 'ledgerNumber' | 'ledgerName' | 'opening' | 'debit' | 'credit' | 'unallocated' | 'closing';
type SortDirection = 'asc' | 'desc';

export default function AccountsDashboard() {
  const { sym, fmt } = useCurrency();
  const pdfPreview = usePdfPreview();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [customerRows, setCustomerRows] = useState<DashboardRow[]>([]);
  const [supplierRows, setSupplierRows] = useState<DashboardRow[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<SortField>('closing');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  // Statement dialog
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [statementTarget, setStatementTarget] = useState<{ id: number; name: string; type: 'customer' | 'supplier' } | null>(null);
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isPrintingStatement, setIsPrintingStatement] = useState(false);

  // ── Fetch ──
  const fetchCustomerDashboard = async () => {
    setIsLoadingCustomers(true);
    try {
      const res: any = await apiFetch('/api/customer-ledger/dashboard-balances');
      setCustomerRows(res.data || []);
    } catch (err) {
      toast.error('Failed to load customer balances');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchSupplierDashboard = async () => {
    setIsLoadingSuppliers(true);
    try {
      const res: any = await apiFetch('/api/supplier-ledger/dashboard-balances');
      setSupplierRows(res.data || []);
    } catch (err) {
      toast.error('Failed to load supplier balances');
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchCustomerDashboard();
    fetchSupplierDashboard();
  }, []);

  // ── Derived ──
  const currentRows = activeTab === 'customers' ? customerRows : supplierRows;
  const isLoading = activeTab === 'customers' ? isLoadingCustomers : isLoadingSuppliers;

  const filteredRows = useMemo(() => {
    let rows = [...currentRows];
    if (searchText) {
      const term = searchText.toLowerCase();
      rows = rows.filter(r =>
        r.ledgerNumber.toLowerCase().includes(term) ||
        r.ledgerName.toLowerCase().includes(term)
      );
    }
    rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return rows;
  }, [currentRows, searchText, sortField, sortDirection]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        opening: acc.opening + Number(r.opening || 0),
        debit: acc.debit + Number(r.debit || 0),
        credit: acc.credit + Number(r.credit || 0),
        unallocated: acc.unallocated + Number(r.unallocated || 0),
        closing: acc.closing + Number(r.closing || 0),
      }),
      { opening: 0, debit: 0, credit: 0, unallocated: 0, closing: 0 }
    );
  }, [filteredRows]);

  // ── Sort handler ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc'
      ? <SortAsc className="h-3 w-3 ml-0.5 inline text-primary" />
      : <SortDesc className="h-3 w-3 ml-0.5 inline text-primary" />;
  };

  // ── Statement ──
  const handlePrintStatement = async () => {
    if (!statementTarget) return;
    setIsPrintingStatement(true);
    try {
      const base = getBaseUrl();
      const ledgerType = statementTarget.type === 'customer' ? 'customer-ledger' : 'supplier-ledger';
      let url = `${base}/api/${ledgerType}/${statementTarget.id}/statement/pdf`;
      const params = new URLSearchParams();
      if (statementStartDate) params.append('startDate', statementStartDate);
      if (statementEndDate) params.append('endDate', statementEndDate);
      if (params.toString()) url += `?${params}`;

      // Close the statement parameters dialog first to prevent Radix UI dialog conflicts
      setIsStatementDialogOpen(false);
      
      // showPdf fetches the blob and shows the preview dialog directly
      // Add a tiny delay so the first dialog completely unmounts
      setTimeout(async () => {
        await pdfPreview.showPdf(url, { title: `Statement — ${statementTarget.name}`, auto: false });
      }, 150);

    } catch (err: any) {
      toast.error(err.message || 'Failed to print statement');
    } finally {
      setIsPrintingStatement(false);
    }
  };

  const openStatementDialog = (row: DashboardRow) => {
    setStatementTarget({
      id: row.id,
      name: row.ledgerName,
      type: activeTab === 'customers' ? 'customer' : 'supplier',
    });
    setIsStatementDialogOpen(true);
  };

  // ── Navigate to accounts page ──
  const navigateToAccount = (row: DashboardRow, action?: string) => {
    const path = activeTab === 'customers' ? '/customer-accounts' : '/supplier-accounts';
    navigate(`${path}?accountId=${row.id}&action=${action || 'view'}`, {
      state: { accountId: String(row.id), action: action || 'view', ts: Date.now() }
    });
  };

  // ── Export CSV ──
  const handleExport = () => {
    const headers = ['Ledger Number', 'Ledger Name', 'Opening', 'Debit', 'Credit', 'Unallocated', 'Closing'];
    const csvRows = [headers.join(',')];
    filteredRows.forEach(r => {
      csvRows.push([
        r.ledgerNumber,
        `"${r.ledgerName}"`,
        Number(r.opening || 0).toFixed(2),
        Number(r.debit || 0).toFixed(2),
        Number(r.credit || 0).toFixed(2),
        Number(r.unallocated || 0).toFixed(2),
        Number(r.closing || 0).toFixed(2),
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_balances_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const fmtCell = (v: number) => {
    const n = Number(v || 0);
    if (n === 0) return <span className="text-muted-foreground/40">0</span>;
    return (
      <span className={n < 0 ? 'text-red-500' : ''}>
        {n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Overview of all {activeTab === 'customers' ? 'customer receivable' : 'supplier payable'} balances
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (activeTab === 'customers') fetchCustomerDashboard();
                else fetchSupplierDashboard();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="h-9">
              <TabsTrigger value="customers" className="gap-1.5 text-xs px-4">
                <Users className="h-3.5 w-3.5" />
                Customers
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">
                  {customerRows.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-1.5 text-xs px-4">
                <Truck className="h-3.5 w-3.5" />
                Suppliers
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">
                  {supplierRows.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative min-w-[250px]">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ledger number..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Summary Bar */}
          <div className="flex flex-wrap gap-2 mt-3 p-3 bg-gradient-to-r from-muted/30 to-muted/10 border rounded-lg">
            <div className="flex items-center gap-6 flex-1 min-w-0">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Balances</p>
                <p className="text-sm font-bold text-orange-600">{fmt(totals.opening + totals.debit - totals.credit)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Opening</p>
                <p className="text-sm font-bold">{fmt(totals.opening)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Debit</p>
                <p className="text-sm font-bold">{fmt(totals.debit)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Credit</p>
                <p className="text-sm font-bold text-green-600">{fmt(totals.credit)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Unallocated</p>
                <p className="text-sm font-bold text-blue-600">{fmt(totals.unallocated)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort By</span>
              <select
                className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
              >
                <option value="closing">Closing</option>
                <option value="opening">Opening</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="ledgerName">Name</option>
                <option value="ledgerNumber">Number</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDirection === 'asc' ? <SortAsc className="h-3.5 w-3.5" /> : <SortDesc className="h-3.5 w-3.5" />}
              </Button>
              <span className="text-muted-foreground/60 ml-1">{filteredRows.length} records</span>
            </div>
          </div>

          {/* Table */}
          <TabsContent value="customers" className="mt-0">
            {renderTable()}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-0">
            {renderTable()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Statement Dialog */}
      <Dialog open={isStatementDialogOpen} onOpenChange={setIsStatementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" /> Print Statement
            </DialogTitle>
            <DialogDescription>
              Generate a PDF statement for <span className="font-semibold text-foreground">{statementTarget?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={statementStartDate} onChange={e => setStatementStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={statementEndDate} onChange={e => setStatementEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave start date blank to include all history.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatementDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePrintStatement} disabled={isPrintingStatement} className="gap-1.5">
              <Printer className="h-4 w-4" />
              {isPrintingStatement ? 'Generating...' : 'Generate Statement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog
        open={pdfPreview.open}
        onOpenChange={pdfPreview.setOpen}
        url={pdfPreview.url}
        title={pdfPreview.title}
        iframeRef={pdfPreview.iframeRef}
        onPrint={pdfPreview.handlePrint}
        autoPrintOnLoad={pdfPreview.autoPrintOnLoad}
      />
    </AppLayout>
  );

  function renderTable() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (filteredRows.length === 0) {
      return (
        <div className="text-center py-20 border-2 border-dashed rounded-lg mt-3">
          <p className="text-muted-foreground text-sm">No {activeTab} found</p>
          <p className="text-muted-foreground text-xs mt-1">
            {searchText ? 'Try adjusting your search' : 'No ledger balances available'}
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden mt-3">
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 sticky top-0 z-10">
              <tr>
                <th
                  className="text-left py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('ledgerNumber')}
                >
                  LEDGER NUMBER <SortIcon field="ledgerNumber" />
                </th>
                <th
                  className="text-left py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort('ledgerName')}
                >
                  LEDGER NAME <SortIcon field="ledgerName" />
                </th>
                <th
                  className="text-right py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('opening')}
                >
                  OPENING <SortIcon field="opening" />
                </th>
                <th
                  className="text-right py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('debit')}
                >
                  DEBIT <SortIcon field="debit" />
                </th>
                <th
                  className="text-right py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('credit')}
                >
                  CREDIT <SortIcon field="credit" />
                </th>
                <th
                  className="text-right py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('unallocated')}
                >
                  UNALLOCATED <SortIcon field="unallocated" />
                </th>
                <th
                  className="text-right py-2.5 px-3 font-semibold text-primary cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap"
                  onClick={() => handleSort('closing')}
                >
                  CLOSING <SortIcon field="closing" />
                </th>
                <th className="text-center py-2.5 px-3 font-semibold text-primary whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredRows.map((row, idx) => {
                const isSelected = selectedRowId === row.id;
                const closing = Number(row.closing || 0);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRowId(isSelected ? null : row.id)}
                    onDoubleClick={() => navigateToAccount(row, 'view')}
                    title="Double-click to view ledger"
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-primary/10 ring-1 ring-inset ring-primary/20'
                        : idx % 2 === 0
                          ? 'bg-background hover:bg-muted/30'
                          : 'bg-muted/10 hover:bg-muted/30'
                    )}
                  >
                    <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{row.ledgerNumber}</td>
                    <td className="py-2 px-3 font-medium">{row.ledgerName}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.opening)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.debit)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.credit)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.unallocated)}</td>
                    <td className={cn(
                      'py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap',
                      closing > 0 ? 'text-red-500 bg-red-50/50 dark:bg-red-950/10' : closing < 0 ? 'text-green-600 bg-green-50/50 dark:bg-green-950/10' : ''
                    )}>
                      {closing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigateToAccount(row, 'view')} className="gap-2 text-xs">
                            <FileText className="h-3.5 w-3.5" />
                            View Ledger
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigateToAccount(row, 'payment')} className="gap-2 text-xs">
                            <Banknote className="h-3.5 w-3.5" />
                            {activeTab === 'customers' ? 'Receive Payment' : 'Record Payment'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigateToAccount(row, 'credit_note')} className="gap-2 text-xs">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                            Credit Note
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigateToAccount(row, 'debit_note')} className="gap-2 text-xs">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            Debit Note
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openStatementDialog(row)} className="gap-2 text-xs">
                            <Printer className="h-3.5 w-3.5" />
                            Print Statement
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-muted/40 sticky bottom-0 border-t-2 border-primary/20">
              <tr className="font-bold text-xs">
                <td className="py-2.5 px-3" colSpan={2}>
                  <div className="flex items-center gap-3">
                    <span className="text-primary">TOTALS</span>
                    <span className="text-muted-foreground font-normal">({filteredRows.length} accounts)</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {totals.opening.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-green-600">
                  {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {totals.unallocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={cn(
                  'py-2.5 px-3 text-right tabular-nums font-bold',
                  totals.closing > 0 ? 'text-red-500' : totals.closing < 0 ? 'text-green-600' : ''
                )}>
                  {totals.closing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
}
